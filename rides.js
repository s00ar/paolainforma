import { ridesEnabled } from './rides-settings.js?v=20261110-4';
export function setupRides(state,openAuth,toast){
const byId=id=>document.getElementById(id);
const driverForm = byId('driver-form');
const tripForm = byId('trip-form');
const stopDriver = byId('stop-driver');
const hour = 3600000;
const dateFormat = new Intl.DateTimeFormat('es-IT', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Rome',
});
let subscriptions = [];
let drivers = [], trips = [];
let driverError = '', tripError = '';
let siteModerator=false;
window.addEventListener('site-role',e=>{siteModerator=e.detail.admin;renderLists();});
let contactRequest=0;
function requireRides(action) {
  if (!ridesEnabled) {
    toast('Los viajes compartidos estarán disponibles cuando se habilite el servicio.');
    return;
  }
  if (!state.user) openAuth(action);
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
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'mobility-icon mobility-whatsapp-icon');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#mobility-whatsapp-symbol');
    svg.append(use);
    button.prepend(svg);
    item.append(icon, details, badge, button);
  } else item.append(heading, description, button);
  return item;
}

function renderLists() {
  const now = Date.now();
  const active = drivers.filter(driver => driver.expiresAt > now);
  const planned = trips.filter(trip => trip.departure > now);
  const count = byId('driver-count');
  count.hidden = !ridesEnabled || !state.user || Boolean(driverError);
  count.textContent = active.length + (active.length === 1 ? ' disponible' : ' disponibles');
  byId('driver-list').replaceChildren(...active.map(driver =>
    card(driver.name, 'Disponible hasta ' + formatDate(driver.expiresAt), () => loadContact(driver.name, 'webDriverProfiles', driver.id), null, true)));
  byId('trip-list').replaceChildren(...planned.map(trip => card(
    trip.origin + ' → ' + trip.destination,
    formatDate(trip.departure) + ' (hora de Italia) · ' + trip.seats + (trip.seats === 1 ? ' lugar libre' : ' lugares libres'),
    () => loadContact(trip.origin + ' → ' + trip.destination, 'webTripContacts', trip.id),
    (trip.owner === state.user?.uid || siteModerator) ? () => removeTrip(trip.id) : null,
  )));

  [...byId('trip-list').children].forEach((row,index)=>{
    const trip=planned[index];if(trip.owner!==state.user?.uid&&!siteModerator)return;
    const edit=document.createElement('button');edit.className='outline';edit.textContent='Editar viaje';
    edit.onclick=async()=>{try{const contact=await state.api.getDocFromServer(state.api.doc(state.db,'webTripContacts',trip.id));tripForm.reset();tripForm.dataset.editId=trip.id;tripForm.dataset.owner=trip.owner;
      for(const field of ['origin','destination','seats'])tripForm.elements[field].value=trip[field];
      const d=new Date(trip.departure);tripForm.elements.departure.value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);tripForm.elements.phone.value=contact.data()?.phone||'';byId('trip-dialog').showModal();
    }catch{toast('No se pudo abrir el viaje.');}};row.append(edit);
  });
  const unavailable = !ridesEnabled ? 'El servicio de viajes está pendiente de activación.'
    : !state.user ? 'Ingresá con Google para consultar y publicar.' : '';
  byId('driver-status').textContent = unavailable || driverError || (active.length ? '' : 'No hay choferes disponibles en este momento.');
  byId('trip-status').textContent = unavailable || tripError || (planned.length ? '' : 'No hay viajes programados.');
  for (const [kind, error, entries] of [['driver', driverError, active], ['trip', tripError, planned]]) {
    const state = unavailable ? 'unavailable' : error.startsWith('Cargando') ? 'loading'
      : error ? 'error' : entries.length ? 'ready' : 'empty';
    byId(kind + '-status').dataset.state = state;
    byId(kind + '-list').setAttribute('aria-busy', String(state === 'loading'));
    if (kind === 'driver') byId('conductores-activos').dataset.state = state;
  }
}

function observeLists() {
  subscriptions.forEach(unsubscribe => unsubscribe());
  subscriptions = [];
  drivers = [];
  trips = [];
  driverError = tripError = '';
  if (state.user && ridesEnabled) {
    driverError = 'Cargando disponibilidad…';
    tripError = 'Cargando viajes…';
    const upcoming = (name, field) => state.api.query(state.api.collection(state.db, name),
      state.api.where(field, '>', Date.now()), state.api.orderBy(field), state.api.limit(50));
    const rows = snapshot => snapshot.docs.map(row => ({ ...row.data(), id: row.id }));
    subscriptions = [
      state.api.onSnapshot(upcoming('webAvailableDrivers', 'expiresAt'), snapshot => {
        drivers = rows(snapshot);
        driverError = '';
        renderLists();
      }, () => {
        drivers = [];
        driverError = 'No pudimos consultar los choferes. Volvé a iniciar sesión e intentá de nuevo.';
        renderLists();
      }),
      state.api.onSnapshot(upcoming('webPlannedTrips', 'departure'), snapshot => {
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
    const profile = await state.api.getDocFromServer(state.api.doc(state.db, collection, id));
    if (!profile.exists()) throw new Error();
    if (request === contactRequest) showContact(title, phoneNumber(profile.data().phone));
  } catch {
    if (request === contactRequest) {
      byId('contact-status').textContent = 'Este contacto ya no está disponible o no se pudo cargar.';
    }
  }
}

async function openDriverForm() {
  const user = state.user;
  try {
    const blocked = await state.api.getDocFromServer(state.api.doc(state.db, 'webDriverBlocks', user.uid));
    if (blocked.exists()) {
      toast('Tu perfil de chofer fue retirado. Contactá a la administración si necesitás ayuda.');
      return;
    }
    const profile = await state.api.getDocFromServer(state.api.doc(state.db, 'webDriverProfiles', user.uid));
    const listing = await state.api.getDocFromServer(state.api.doc(state.db, 'webAvailableDrivers', user.uid));
    if (state.user?.uid !== user.uid) return;
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
  tripForm.reset();delete tripForm.dataset.editId;delete tripForm.dataset.owner;
  tripForm.querySelector('.form-status').textContent = '';
  byId('trip-dialog').showModal();
});

async function saveForm(form, action, success) {
  const status = form.querySelector('.form-status');
  const buttons = [...form.querySelectorAll('button')].filter(button => !button.matches('[data-close]'));
  if (buttons.some(button => button.disabled) || !state.user || !ridesEnabled) return;
  buttons.forEach(button => { button.disabled = true; });
  status.textContent = 'Guardando…';
  try {
    await action(state.user.uid);
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
    if (!name || !form.has('consent')) throw new Error('Completá el nombre y confirmá que sos chofer de Remis.');
    const batch = state.api.writeBatch(state.db);
    batch.set(state.api.doc(state.db, 'webDriverProfiles', uid), { name, phone });
    batch.set(state.api.doc(state.db, 'webAvailableDrivers', uid), {
      name, expiresAt: Date.now() + Number(form.get('hours')) * hour,
    });
    await batch.commit();
  }, 'Ya figurás como disponible.');
};
stopDriver.onclick = () => saveForm(driverForm, uid =>
  state.api.deleteDoc(state.api.doc(state.db, 'webAvailableDrivers', uid)), 'Ya no figurás como disponible.');

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
    const trip = tripForm.dataset.editId ? state.api.doc(state.db,'webPlannedTrips',tripForm.dataset.editId) : state.api.doc(state.api.collection(state.db, 'webPlannedTrips'));
    const batch = state.api.writeBatch(state.db);
    batch.set(trip, { owner: tripForm.dataset.owner || uid, origin, destination, departure, seats });
    batch.set(state.api.doc(state.db, 'webTripContacts', trip.id), { phone });
    await batch.commit();
  }, 'Tu viaje quedó publicado.');
};

async function removeTrip(id) {
  try {
    const batch = state.api.writeBatch(state.db);
    batch.delete(state.api.doc(state.db, 'webPlannedTrips', id));
    batch.delete(state.api.doc(state.db, 'webTripContacts', id));
    await batch.commit();
    toast('Viaje retirado.');
  } catch {
    toast('No se pudo retirar el viaje.');
  }
}


renderLists();
setInterval(()=>{if(drivers.some(d=>d.expiresAt<=Date.now())||trips.some(t=>t.departure<=Date.now()))observeLists();},15000);
return {refresh:observeLists, clear:()=>{contactRequest++;for(const id of ['contact-dialog','trip-dialog','driver-dialog'])byId(id).close();}};
}