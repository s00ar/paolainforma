import { setEditorialSession, connectEditorial } from './editorial.js';
import { firebaseConfig } from './firebase-config.js';
import { ridesEnabled } from './rides-settings.js';

const byId = id => document.getElementById(id);
const authDialog = byId('authDialog');
const googleButton = byId('googleLogin');
const login = byId('login');
const logout = byId('logout');
const menu = byId('menu');
const nav = byId('nav');
const driverForm = byId('driver-form');
const tripForm = byId('trip-form');
const stopDriver = byId('stop-driver');
const hour = 3600000;
const dateFormat = new Intl.DateTimeFormat('es-IT', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Rome',
});
let api, auth, db, currentUser, afterLogin;
let subscriptions = [];
let drivers = [], trips = [];
let driverError = '', tripError = '';
let toastTimer;
let contactRequest = 0;

function toast(message) {
  const element = byId('toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 4500);
}

function toggleMenu(open) {
  nav.classList.toggle('open', open);
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
}
menu.onclick = () => toggleMenu(!nav.classList.contains('open'));
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => toggleMenu(false)));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav.classList.contains('open')) {
    toggleMenu(false);
    menu.focus();
  }
});
function openAuth(next) {
  afterLogin = next;
  toggleMenu(false);
  if (!authDialog.open) authDialog.showModal();
}
login.onclick = () => openAuth();
const mobilityAuth = [...document.querySelectorAll('[data-mobility-auth]')];
mobilityAuth.forEach(button => { button.onclick = () => openAuth(); });
byId('driver-example-contact').onclick = () => toast('Este perfil muestra cómo funciona la lista. Elegí un conductor activo para contactarlo.');
document.querySelectorAll('[data-auth]').forEach(button => {
  button.onclick = () => currentUser ? toast('La publicación de oportunidades todavía no está disponible.') : openAuth();
});
byId('closeDialog').onclick = () => authDialog.close();
document.querySelectorAll('[data-close]').forEach(button => {
  button.onclick = () => button.closest('dialog').close();
});
authDialog.addEventListener('close', () => {
  if (!authDialog.open) afterLogin = undefined;
});

function requireRides(action) {
  if (!ridesEnabled) {
    toast('Los viajes compartidos estarán disponibles cuando se habilite el servicio.');
    return;
  }
  if (!currentUser) openAuth(action);
  else action();
}

function phoneNumber(value) {
  const phone = value.trim().replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Ingresá un número internacional, por ejemplo +39 seguido del número.');
  return phone;
}

function formatDate(timestamp) {
  return dateFormat.format(timestamp);
}

function card(title, text, contact, remove, driver = false) {
  const item = document.createElement('li');
  item.className = 'ride-item';
  const heading = document.createElement('h4');
  heading.textContent = title;
  const description = document.createElement('p');
  description.textContent = text;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'outline';
  button.textContent = remove ? 'Retirar viaje' : 'Contactar por WhatsApp';
  button.onclick = remove || contact;
  if (driver) {
    item.classList.add('mobility-driver-row');
    const icon = document.createElement('span');
    icon.className = 'mobility-car';
    icon.textContent = title.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
    icon.setAttribute('aria-hidden', 'true');
    const details = document.createElement('div');
    details.className = 'mobility-driver-details';
    details.append(heading, description);
    const badge = document.createElement('span');
    badge.className = 'mobility-badge';
    badge.textContent = 'Disponible ahora';
    button.className = 'mobility-whatsapp';
    item.append(icon, details, badge, button);
  } else item.append(heading, description, button);
  return item;
}

function renderLists() {
  const now = Date.now();
  const active = drivers.filter(driver => driver.expiresAt > now);
  const planned = trips.filter(trip => trip.departure > now);
  const count = byId('driver-count');
  count.hidden = active.length === 0;
  byId('driver-example').hidden = active.length > 0;
  count.textContent = active.length + (active.length === 1 ? ' disponible' : ' disponibles');
  byId('driver-list').replaceChildren(...active.map(driver =>
    card(driver.name, 'Disponible hasta ' + formatDate(driver.expiresAt), () => loadContact(driver.name, 'webDriverProfiles', driver.id), null, true)));
  byId('trip-list').replaceChildren(...planned.map(trip => card(
    trip.origin + ' → ' + trip.destination,
    formatDate(trip.departure) + ' (hora de Italia) · ' + trip.seats + (trip.seats === 1 ? ' lugar libre' : ' lugares libres'),
    () => loadContact(trip.origin + ' → ' + trip.destination, 'webTripContacts', trip.id),
    trip.owner === currentUser?.uid ? () => removeTrip(trip.id) : null,
  )));

  const unavailable = !ridesEnabled ? 'El servicio de viajes está pendiente de activación.'
    : !currentUser ? 'Ingresá con Google para consultar y publicar.' : '';
  byId('driver-status').textContent = unavailable || driverError || (active.length ? '' : 'No hay choferes disponibles en este momento.');
  byId('trip-status').textContent = unavailable || tripError || (planned.length ? '' : 'No hay viajes programados.');
}

function observeLists() {
  subscriptions.forEach(unsubscribe => unsubscribe());
  subscriptions = [];
  drivers = [];
  trips = [];
  driverError = tripError = '';
  if (currentUser && ridesEnabled) {
    driverError = 'Cargando disponibilidad…';
    tripError = 'Cargando viajes…';
    const upcoming = (name, field) => api.query(api.collection(db, name),
      api.where(field, '>', Date.now()), api.orderBy(field), api.limit(50));
    const rows = snapshot => snapshot.docs.map(row => ({ ...row.data(), id: row.id }));
    subscriptions = [
      api.onSnapshot(upcoming('webAvailableDrivers', 'expiresAt'), snapshot => {
        drivers = rows(snapshot);
        driverError = '';
        renderLists();
      }, () => {
        drivers = [];
        driverError = 'No pudimos consultar los choferes. Volvé a iniciar sesión e intentá de nuevo.';
        renderLists();
      }),
      api.onSnapshot(upcoming('webPlannedTrips', 'departure'), snapshot => {
        trips = rows(snapshot);
        tripError = '';
        renderLists();
      }, () => {
        trips = [];
        tripError = 'No pudimos consultar los viajes. Volvé a iniciar sesión e intentá de nuevo.';
        renderLists();
      }),
    ];
  }
  renderLists();
}

function showContact(title, phone) {
  const dialog = byId('contact-dialog');
  const link = byId('contact-link');
  byId('contact-title').textContent = title;
  byId('contact-status').textContent = phone || 'Consultando disponibilidad…';
  link.hidden = !phone;
  if (phone) link.href = 'https://wa.me/' + phone.slice(1);
  else link.removeAttribute('href');
  if (!dialog.open) dialog.showModal();
}

byId('contact-dialog').addEventListener('close', () => { contactRequest++; });

async function loadContact(title, collection, id) {
  const request = ++contactRequest;
  showContact(title);
  try {
    const profile = await api.getDocFromServer(api.doc(db, collection, id));
    if (!profile.exists()) throw new Error();
    if (request === contactRequest) showContact(title, phoneNumber(profile.data().phone));
  } catch {
    if (request === contactRequest) {
      byId('contact-status').textContent = 'Este contacto ya no está disponible o no se pudo cargar.';
    }
  }
}

async function openDriverForm() {
  const user = currentUser;
  try {
    const blocked = await api.getDocFromServer(api.doc(db, 'webDriverBlocks', user.uid));
    if (blocked.exists()) {
      toast('Tu perfil de chofer fue retirado. Contactá a la administración si necesitás ayuda.');
      return;
    }
    const profile = await api.getDocFromServer(api.doc(db, 'webDriverProfiles', user.uid));
    const listing = await api.getDocFromServer(api.doc(db, 'webAvailableDrivers', user.uid));
    if (currentUser?.uid !== user.uid) return;
    const activeUntil = listing.data()?.expiresAt || 0;
    driverForm.reset();
    driverForm.elements.name.value = profile.data()?.name || user.displayName || '';
    driverForm.elements.phone.value = profile.data()?.phone || '';
    stopDriver.hidden = activeUntil <= Date.now();
    byId('my-driver-status').textContent = stopDriver.hidden ? 'Ahora no figurás como disponible.'
      : 'Figurás como disponible hasta ' + formatDate(activeUntil) + '.';
    driverForm.querySelector('.form-status').textContent = '';
    byId('driver-dialog').showModal();
  } catch {
    toast('No pudimos cargar tu disponibilidad.');
  }
}

byId('manage-driver').onclick = () => requireRides(openDriverForm);
byId('publish-trip').onclick = () => requireRides(() => {
  tripForm.reset();
  tripForm.querySelector('.form-status').textContent = '';
  byId('trip-dialog').showModal();
});

async function saveForm(form, action, success) {
  const status = form.querySelector('.form-status');
  const buttons = [...form.querySelectorAll('button')].filter(button => !button.matches('[data-close]'));
  if (buttons.some(button => button.disabled) || !currentUser || !ridesEnabled) return;
  buttons.forEach(button => { button.disabled = true; });
  status.textContent = 'Guardando…';
  try {
    await action(currentUser.uid);
    form.closest('dialog').close();
    toast(success);
  } catch (error) {
    status.textContent = error.code ? 'No se pudo guardar. Revisá la conexión e intentá de nuevo.' : error.message;
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

driverForm.onsubmit = event => {
  event.preventDefault();
  saveForm(driverForm, async uid => {
    const form = new FormData(driverForm);
    const name = form.get('name').trim();
    const phone = phoneNumber(form.get('phone'));
    if (!name || !form.has('consent')) throw new Error('Completá el nombre y confirmá que sos chofer de Remix.');
    const batch = api.writeBatch(db);
    batch.set(api.doc(db, 'webDriverProfiles', uid), { name, phone });
    batch.set(api.doc(db, 'webAvailableDrivers', uid), {
      name, expiresAt: Date.now() + Number(form.get('hours')) * hour,
    });
    await batch.commit();
  }, 'Ya figurás como disponible.');
};
stopDriver.onclick = () => saveForm(driverForm, uid =>
  api.deleteDoc(api.doc(db, 'webAvailableDrivers', uid)), 'Ya no figurás como disponible.');

tripForm.onsubmit = event => {
  event.preventDefault();
  saveForm(tripForm, async uid => {
    const form = new FormData(tripForm);
    const origin = form.get('origin').trim();
    const destination = form.get('destination').trim();
    const departure = new Date(form.get('departure')).getTime();
    const seats = Number(form.get('seats'));
    const phone = phoneNumber(form.get('phone'));
    if (!origin || !destination || !form.has('consent')) throw new Error('Completá los datos y aceptá compartir tu contacto.');
    if (!Number.isFinite(departure) || departure <= Date.now()) throw new Error('Elegí una fecha y hora futuras.');
    if (!Number.isInteger(seats) || seats < 1 || seats > 8) throw new Error('Indicá entre 1 y 8 lugares.');
    const trip = api.doc(api.collection(db, 'webPlannedTrips'));
    const batch = api.writeBatch(db);
    batch.set(trip, { owner: uid, origin, destination, departure, seats });
    batch.set(api.doc(db, 'webTripContacts', trip.id), { phone });
    await batch.commit();
  }, 'Tu viaje quedó publicado.');
};

async function removeTrip(id) {
  try {
    const batch = api.writeBatch(db);
    batch.delete(api.doc(db, 'webPlannedTrips', id));
    batch.delete(api.doc(db, 'webTripContacts', id));
    await batch.commit();
    toast('Viaje retirado.');
  } catch {
    toast('No se pudo retirar el viaje.');
  }
}

async function initFirebase() {
  const [appSdk, authSdk, firestoreSdk] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js'),
  ]);
  api = firestoreSdk;
  const app = appSdk.initializeApp(firebaseConfig);
  auth = authSdk.getAuth(app);
  db = api.getFirestore(app);
  connectEditorial(api, db);
  const provider = new authSdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  authSdk.onAuthStateChanged(auth, user => {
    currentUser = user;
    setEditorialSession(user);
    login.textContent = user ? 'Mi cuenta' : 'Ingresar';
    googleButton.hidden = Boolean(user);
    mobilityAuth.forEach(button => { button.hidden = Boolean(user); });
    logout.hidden = !user;
    if (!user) {
      contactRequest++;
      for (const id of ['contact-dialog', 'trip-dialog', 'driver-dialog']) byId(id).close();
    }
    observeLists();
  });
  googleButton.onclick = async () => {
    const action = afterLogin;
    googleButton.disabled = true;
    try {
      const { user } = await authSdk.signInWithPopup(auth, provider);
      currentUser = user;
      authDialog.close();
      action?.();
      api.setDoc(api.doc(db, 'users', user.uid), {
        uid: user.uid, displayName: user.displayName || '', email: user.email || '',
        photoURL: user.photoURL || '', provider: 'google', lastLoginAt: api.serverTimestamp(),
      }, { merge: true }).catch(error => console.error('Perfil de Paola Informa', error.code));
    } catch (error) {
      const messages = {
        'auth/unauthorized-domain': 'El dominio debe autorizarse en Firebase Authentication.',
        'auth/operation-not-allowed': 'El inicio de sesión con Google aún no está habilitado.',
        'auth/popup-blocked': 'Permití la ventana emergente de Google y volvé a intentar.',
        'auth/popup-closed-by-user': 'Se cerró la ventana de Google. Podés volver a intentar.',
      };
      toast(messages[error.code] || 'No se pudo iniciar sesión con Google.');
    } finally {
      googleButton.disabled = false;
    }
  };
  logout.onclick = async () => {
    try {
      await authSdk.signOut(auth);
      authDialog.close();
    } catch {
      toast('No se pudo cerrar la sesión.');
    }
  };
  googleButton.disabled = false;
}

renderLists();
setInterval(() => {
  const now = Date.now();
  if (drivers.some(driver => driver.expiresAt <= now) || trips.some(trip => trip.departure <= now)) {
    observeLists();
  }
}, 15000);
googleButton.disabled = true;
initFirebase().catch(() => {
  googleButton.textContent = 'Acceso con Google no disponible';
});
