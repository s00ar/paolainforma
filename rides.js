import {languageField,languagePayload,attachTranslation} from './content-language.js';
import { t, locale } from './i18n.js';
import { ridesEnabled } from './rides-settings.js?v=20261118-i18n';
export function setupRides(state,openAuth,toast){
const byId=id=>document.getElementById(id);
const driverForm = byId('driver-form');
const tripForm = byId('trip-form');
const stopDriver = byId('stop-driver');
const hour = 3600000;
const dateFormat = new Intl.DateTimeFormat(locale, {
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
    toast(t('msg.46dab0f213'));
    return;
  }
  if (!state.user) openAuth(action);
  else action();
}

function phoneNumber(value) {
  const phone = value.trim().replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error(t('msg.7d3cdcf4f1'));
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
  button.textContent = remove ? t('msg.375ca8bf60') : t('msg.f9b77bb86f');
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
    badge.textContent = t('msg.4e0948fb78');
    button.className = 'mobility-whatsapp';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', "mobility-icon mobility-whatsapp-icon");
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
  count.textContent = t('drivers.count',{count:active.length});
  byId('driver-list').replaceChildren(...active.map(driver =>
    card(driver.name, t('msg.f630d46c25') + formatDate(driver.expiresAt), () => loadContact(driver.name, 'webDriverProfiles', driver.id), null, true)));
  byId('trip-list').replaceChildren(...planned.map(trip => card(
    trip.origin + ' → ' + trip.destination,
    formatDate(trip.departure) + t('msg.f991c4ca15') + t('trip.seats',{count:trip.seats}),
    () => loadContact(trip.origin + ' → ' + trip.destination, 'webTripContacts', trip.id),
    (trip.owner === state.user?.uid || siteModerator) ? () => removeTrip(trip.id) : null,
  )));

  [...byId('trip-list').children].forEach((row,index)=>{
    const trip=planned[index];if(trip.owner!==state.user?.uid&&!siteModerator)return;
    const edit=document.createElement('button');edit.className='outline';edit.textContent=t('msg.0e58483609');
    edit.onclick=async()=>{try{const contact=await state.api.getDocFromServer(state.api.doc(state.db,'webTripContacts',trip.id));tripForm.reset();languageField(tripForm,trip);tripForm.dataset.editId=trip.id;tripForm.dataset.owner=trip.owner;
      for(const field of ['origin','destination','seats'])tripForm.elements[field].value=trip[field];
      const d=new Date(trip.departure);tripForm.elements.departure.value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);tripForm.elements.phone.value=contact.data()?.phone||'';byId('trip-dialog').showModal();
    }catch{toast(t('msg.93b1a58634'));}};row.append(edit);
  });
  const unavailable = !ridesEnabled ? t('msg.95d78657d6')
    : !state.user ? t('msg.1f17364ce0') : '';
  byId('driver-status').textContent = unavailable || driverError || (active.length ? '' : t('msg.9c886557f5'));
  byId('trip-status').textContent = unavailable || tripError || (planned.length ? '' : t('msg.590b1548f7'));
  for (const [kind, error, entries] of [['driver', driverError, active], ['trip', tripError, planned]]) {
    const state = unavailable ? 'unavailable' : [t('ui.734ce7dc6a'),t('ui.1f8a457a29')].includes(error) ? 'loading'
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
    driverError = t('ui.734ce7dc6a');
    tripError = t('ui.1f8a457a29');
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
        driverError = t('msg.f4bd73139c');
        renderLists();
      }),
      state.api.onSnapshot(upcoming('webPlannedTrips', 'departure'), snapshot => {
        trips = rows(snapshot);
        tripError = '';
        renderLists();
      }, () => {
        trips = [];
        tripError = t('msg.2c6679a1aa');
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
  byId('contact-status').textContent = phone || t('msg.50124e23f1');
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
      byId('contact-status').textContent = t('msg.c58316ab89');
    }
  }
}

async function openDriverForm() {
  const user = state.user;
  try {
    const blocked = await state.api.getDocFromServer(state.api.doc(state.db, 'webDriverBlocks', user.uid));
    if (blocked.exists()) {
      toast(t('msg.c4743e2cdd'));
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
    byId('my-driver-status').textContent = stopDriver.hidden ? t('msg.9691ef3b9d')
      : t('msg.6a03a56965') + formatDate(activeUntil) + '.';
    driverForm.querySelector('.form-status').textContent = '';
    byId('driver-dialog').showModal();
  } catch {
    toast(t('msg.ee5a76f40f'));
  }
}

byId('manage-driver').onclick = () => requireRides(openDriverForm);
byId('publish-trip').onclick = () => requireRides(() => {
  tripForm.reset();languageField(tripForm);delete tripForm.dataset.editId;delete tripForm.dataset.owner;
  tripForm.querySelector('.form-status').textContent = '';
  byId('trip-dialog').showModal();
});

async function saveForm(form, action, success) {
  const status = form.querySelector('.form-status');
  const buttons = [...form.querySelectorAll('button')].filter(button => !button.matches('[data-close]'));
  if (buttons.some(button => button.disabled) || !state.user || !ridesEnabled) return;
  buttons.forEach(button => { button.disabled = true; });
  status.textContent = t('common.saving');
  try {
    await action(state.user.uid);
    form.closest('dialog').close();
    toast(success);
  } catch (error) {
    status.textContent = error.code ? t('msg.96da124bb9') : error.message;
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
    if (!name || !form.has('consent')) throw new Error(t('msg.b97a8eac9f'));
    const batch = state.api.writeBatch(state.db);
    batch.set(state.api.doc(state.db, 'webDriverProfiles', uid), { name, phone });
    batch.set(state.api.doc(state.db, 'webAvailableDrivers', uid), {
      name, expiresAt: Date.now() + Number(form.get('hours')) * hour,
    });
    await batch.commit();
  }, t('msg.21021f8846'));
};
stopDriver.onclick = () => saveForm(driverForm, uid =>
  state.api.deleteDoc(state.api.doc(state.db, 'webAvailableDrivers', uid)), t('msg.45efa0a746'));

tripForm.onsubmit = event => {
  event.preventDefault();
  saveForm(tripForm, async uid => {
    const form = new FormData(tripForm);
    const origin = form.get('origin').trim();
    const destination = form.get('destination').trim();
    const departure = new Date(form.get('departure')).getTime();
    const seats = Number(form.get('seats'));
    const phone = phoneNumber(form.get('phone'));
    if (!origin || !destination || !form.has('consent')) throw new Error(t('msg.66d6320d4b'));
    if (!Number.isFinite(departure) || departure <= Date.now()) throw new Error(t('msg.9067f86920'));
    if (!Number.isInteger(seats) || seats < 1 || seats > 8) throw new Error(t('msg.15c7bb3a9b'));
    const trip = tripForm.dataset.editId ? state.api.doc(state.db,'webPlannedTrips',tripForm.dataset.editId) : state.api.doc(state.api.collection(state.db, 'webPlannedTrips'));
    const batch = state.api.writeBatch(state.db);
    batch.set(trip, { owner: tripForm.dataset.owner || uid, origin, destination, departure, seats, ...languagePayload(tripForm) });
    batch.set(state.api.doc(state.db, 'webTripContacts', trip.id), { phone });
    await batch.commit();
  }, t('msg.735deee52c'));
};

async function removeTrip(id) {
  try {
    const batch = state.api.writeBatch(state.db);
    batch.delete(state.api.doc(state.db, 'webPlannedTrips', id));
    batch.delete(state.api.doc(state.db, 'webTripContacts', id));
    await batch.commit();
    toast(t('msg.8f00f9023e'));
  } catch {
    toast(t('msg.dd907405b1'));
  }
}


renderLists();
setInterval(()=>{if(drivers.some(d=>d.expiresAt<=Date.now())||trips.some(t=>t.departure<=Date.now()))observeLists();},15000);
return {refresh:observeLists, clear:()=>{contactRequest++;for(const id of ['contact-dialog','trip-dialog','driver-dialog'])byId(id).close();}};
}