import {firebaseConfig} from './firebase-config.js?v=20261110-4';
import {connectEditorial,setEditorialSession} from './editorial.js?v=20261110-4';
const jobs=document.getElementById('trabajo')?await import('./jobs.js?v=20261110-4'):null;
const market=document.getElementById('tienda')?await import('./market.js?v=20261110-4'):null;
const rentals=document.getElementById('alquileres')?await import('./rentals.js?v=20261110-4'):null;
const directory=document.getElementById('viajes')?await import('./directory.js?v=20261110-4'):null;
const byId = id => document.getElementById(id);
const authDialog = byId('authDialog');
const googleButton = byId('googleLogin');
const authStatus = byId('auth-status');
byId('auth-retry').onclick = () => location.reload();
const login = byId('login');
const logout = byId('logout');
const menu = byId('menu');
const nav = byId('nav');
let api,auth,db,currentUser,afterLogin,toastTimer;
const state={};
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
jobs?.connectJobs(undefined, undefined, openAuth);
market?.connectMarket(undefined, undefined, openAuth);
rentals?.connectRentals(undefined, undefined, openAuth);
const rides=document.getElementById('viajes')?(await import('./rides.js?v=20261110-4')).setupRides(state,openAuth,toast):null;
const mobilityAuth = [...document.querySelectorAll('[data-mobility-auth]')];
mobilityAuth.forEach(button => { button.onclick = () => openAuth(); });
byId('closeDialog').onclick = () => authDialog.close();
document.querySelectorAll('[data-close]').forEach(button => {
  button.onclick = () => button.closest('dialog').close();
});
authDialog.addEventListener('close', () => {
  if (!authDialog.open) afterLogin = undefined;
});

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
  state.api=api;state.db=db;
  connectEditorial(api, db);
  directory?.connectDirectory(api, db);
  jobs?.connectJobs(api, db, openAuth);
  market?.connectMarket(api, db, openAuth);
  rentals?.connectRentals(api, db, openAuth);
  const provider = new authSdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  authSdk.onAuthStateChanged(auth, user => {
    currentUser = user;state.user=user;
    setEditorialSession(user);
    jobs?.setJobsSession(user);
    market?.setMarketSession(user);
    rentals?.setRentalsSession(user);
    directory?.setDirectorySession(user);
    login.textContent = user ? 'Mi cuenta' : 'Ingresar';
    googleButton.hidden = Boolean(user);
    mobilityAuth.forEach(button => { button.hidden = Boolean(user); });
    logout.hidden = !user;
    authStatus.textContent = user ? 'Sesión iniciada.' : '';
    if (!user) {
      rides?.clear();
    }
    rides?.refresh();
  });
  googleButton.onclick = async () => {
    const action = afterLogin;
    googleButton.disabled = true;
    try {
      const { user } = await authSdk.signInWithPopup(auth, provider);
      currentUser = user;state.user=user;
      authDialog.close();
      action?.();
      api.setDoc(api.doc(db, 'users', user.uid), {
        uid: user.uid, displayName: user.displayName || '', email: user.email || '',
        photoURL: user.photoURL || '', provider: 'google', lastLoginAt: api.serverTimestamp(),
      }, { merge: true }).catch(error => console.error('Perfil de Paola y alrededores informa', error.code));
    } catch (error) {
      const messages = {
        'auth/unauthorized-domain': 'El dominio debe autorizarse en Firebase Authentication.',
        'auth/operation-not-allowed': 'El inicio de sesión con Google aún no está habilitado.',
        'auth/network-request-failed': 'No se pudo conectar con Google. Revisá tu conexión y volvé a intentar.',
        'auth/web-storage-unsupported': 'Permití el almacenamiento del navegador para iniciar sesión.',
        'auth/popup-blocked': 'Permití la ventana emergente de Google y volvé a intentar.',
        'auth/popup-closed-by-user': 'Se cerró la ventana de Google. Podés volver a intentar.',
      };
      const message = messages[error.code] || 'No se pudo iniciar sesión con Google. Revisá la conexión y volvé a intentar.';
      authStatus.textContent = message;
      toast(message);
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
  authStatus.textContent = '';
}


googleButton.disabled = true;
initFirebase().catch(() => {
  googleButton.disabled = true;
  authStatus.textContent = 'No se pudo conectar con Google. Revisá tu conexión y reintentá. Si abriste el sitio desde otra aplicación, probá abrirlo en Safari o Chrome.';
  byId('auth-retry').hidden = false;
});
