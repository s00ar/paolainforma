import {languageField,languagePayload,attachTranslation,createSearch} from './content-language.js';
import { t, locale } from './i18n.js';
let moderator = false;
window.addEventListener('site-role', event => { moderator = event.detail.admin; render(); });
import { marketEnabled } from './rides-settings.js?v=20261118-i18n';
const byId = id => document.getElementById(id);
const form = byId('market-form'), dialog = byId('market-dialog'), status = byId('market-status');
let api, db, user, askLogin, stop, entries = [], error = '', generation = 0;
const day = 86400000;
const node = (tag, text, className) => { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; };
const button = (label, action) => { const el = node('button', label, 'outline'); el.type = 'button'; el.onclick = action; return el; };
const multilingualSearch=createSearch('webMarketOffers',byId('market-list'),()=>render());
function render() {
  const active = multilingualSearch.filter(entries).filter(item => item.expiresAt > Date.now());
  status.textContent = !marketEnabled ? t('msg.961d99b61e')
    : !user ? t('msg.5f8350dfc5') : error || (active.length ? '' : t('msg.a60816729a'));
  byId('market-login').hidden = Boolean(user);
  byId('market-list').replaceChildren(...active.map(item => {
    const row = node('li', '', 'job-offer');
    row.append(node('h3', item.title), node('p', new Intl.NumberFormat(locale,{style:'currency',currency:'EUR'}).format(Number(item.price)) + ' · ' + item.location, 'job-meta'), node('p', item.description, 'job-description'));
    row.append(node('small', t('msg.bbe2540e74') + new Intl.DateTimeFormat(locale, {timeZone:'Europe/Rome'}).format(item.createdAt) + t('msg.e4dd179755')));
    const actions = node('div', '', 'job-actions');
    const contact = node('a', t('msg.f9b77bb86f'), 'wa');
    contact.href = 'https://wa.me/' + item.phone.slice(1); contact.target = '_blank'; contact.rel = "noopener noreferrer";
    actions.append(contact);
    if ((item.owner === user?.uid || moderator)) actions.append(button(t('msg.8797dfc346'), () => openForm(item)), button(t('msg.c9e49a8dc8'), async () => {
      if (!confirm(t('msg.6319e45747'))) return;
      try { await api.deleteDoc(api.doc(db, 'webMarketOffers', item.id)); }
      catch { status.textContent = t('msg.c7a9a6caaa'); }
    }));
    attachTranslation(row,'webMarketOffers/'+item.id,item,{title:row.querySelector('h3'),description:row.querySelector('.job-description')});row.append(actions); return row;
  }));
}
function openForm(item) {
  if (!user) { askLogin?.(() => openForm()); return; }
  form.reset();languageField(form,item);
  form.dataset.editId = item?.id || '';
  byId('market-dialog-title').textContent = item ? t('msg.f9f34dad55') : t('ui.fce1e9f96a');
  for (const field of ['title', 'price', 'location', 'description', 'phone']) form.elements[field].value = item?.[field] || '';
  form.querySelector('.form-status').textContent = marketEnabled ? '' : t('msg.e6cdb51ec4');
  dialog.showModal();
}
byId('publish-market').onclick = () => openForm();
byId('market-login').onclick = () => askLogin?.();
export function connectMarket(firestore, database, openAuth) { api = firestore; db = database; askLogin = openAuth; }
export function setMarketSession(account) {
  user = account; generation++; stop?.(); stop = null; entries = []; error = ''; dialog.close();
  if (user && marketEnabled && api) {
    const version = generation;
    error = t('msg.595d87c6ca');
    stop = api.onSnapshot(api.query(api.collection(db, 'webMarketOffers'), api.where('expiresAt', '>', Date.now()), api.orderBy('expiresAt'), api.limit(50)), snapshot => {
      if (version !== generation) return;
      entries = snapshot.docs.map(doc => ({...doc.data(), id:doc.id})); error = ''; render();
    }, () => { if (version !== generation) return; entries = []; error = t('msg.030058f915'); render(); });
  }
  render();
}
form.onsubmit = async event => {
  event.preventDefault();
  const feedback = form.querySelector('.form-status');
  if (!marketEnabled) { feedback.textContent = t('msg.1627bf09bf'); return; }
  if (!user || !api) { feedback.textContent = t('msg.4b55d42551'); return; }
  const submit = form.querySelector('[type="submit"]'); if (submit.disabled) return;
  const values = Object.fromEntries(['title', 'price', 'location', 'description', 'phone'].map(name => [name, form.elements[name].value.trim()]));
  Object.assign(values,languagePayload(form));
  values.phone = values.phone.replace(/[\s().-]/g, '');
  if (Object.values(values).some(value => !value) || !/^\+[1-9]\d{7,14}$/.test(values.phone) || !form.elements.consent.checked) {
    feedback.textContent = t('msg.1a609d4526'); return;
  }
  const version = generation, id = form.dataset.editId;
  submit.disabled = true; feedback.textContent = t('common.saving');
  try {
    if (id) await api.updateDoc(api.doc(db, 'webMarketOffers', id), values);
    else { const now = Date.now(); await api.addDoc(api.collection(db, 'webMarketOffers'), {...values, owner:user.uid, createdAt:now, expiresAt:now + 30*day}); }
    if (version === generation) dialog.close();
  } catch { if (version === generation) feedback.textContent = t('msg.431ecae112'); }
  finally { submit.disabled = false; }
};
setInterval(() => { if (entries.some(item => item.expiresAt <= Date.now())) { entries = multilingualSearch.filter(entries).filter(item => item.expiresAt > Date.now()); render(); } }, 15000);
render();
