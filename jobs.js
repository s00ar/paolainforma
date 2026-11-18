import {languageField,languagePayload,attachTranslation,createSearch} from './content-language.js';
import { t, locale } from './i18n.js';
let moderator = false;
window.addEventListener('site-role', event => { moderator = event.detail.admin; render(); });
import { jobsEnabled } from './rides-settings.js?v=20261118-i18n';
const byId = id => document.getElementById(id);
const form = byId('job-form'), dialog = byId('job-dialog'), status = byId('job-status');
let api, db, user, askLogin, stop, entries = [], error = '', generation = 0;
const day = 86400000;
const node = (tag, text, className) => { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; };
const button = (label, action) => { const el = node('button', label, 'outline'); el.type = 'button'; el.onclick = action; return el; };
const multilingualSearch=createSearch('webJobOffers',byId('job-list'),()=>render());
function render() {
  const active = multilingualSearch.filter(entries).filter(item => item.expiresAt > Date.now());
  status.textContent = !jobsEnabled ? t('msg.ef2300bd23')
    : !user ? t('msg.6726ff4d6a') : error || (active.length ? '' : t('msg.eea45706b5'));
  byId('jobs-login').hidden = Boolean(user);
  byId('job-list').replaceChildren(...active.map(item => {
    const row = node('li', '', 'job-offer');
    row.append(node('h3', item.title), node('p', item.company + ' · ' + item.location, 'job-meta'), node('p', item.description, 'job-description'));
    row.append(node('small', t('msg.bbe2540e74') + new Intl.DateTimeFormat(locale, {timeZone:'Europe/Rome'}).format(item.createdAt) + t('msg.e4dd179755')));
    const actions = node('div', '', 'job-actions');
    const contact = node('a', t('msg.f9b77bb86f'), 'wa');
    contact.href = 'https://wa.me/' + item.phone.slice(1); contact.target = '_blank'; contact.rel = "noopener noreferrer";
    actions.append(contact);
    if ((item.owner === user?.uid || moderator)) actions.append(button(t('msg.6b1a66df68'), () => openForm(item)), button(t('msg.cdd3bed473'), async () => {
      if (!confirm(t('msg.7a772d6af3'))) return;
      try { await api.deleteDoc(api.doc(db, 'webJobOffers', item.id)); }
      catch { status.textContent = t('msg.ca67ccb08e'); }
    }));
    attachTranslation(row,'webJobOffers/'+item.id,item,{title:row.querySelector('h3'),description:row.querySelector('.job-description')});row.append(actions); return row;
  }));
}
function openForm(item) {
  if (!user) { askLogin?.(() => openForm()); return; }
  form.reset();languageField(form,item);
  form.dataset.editId = item?.id || '';
  byId('job-dialog-title').textContent = item ? t('msg.a1c0b67ae3') : t('ui.12bff2ac86');
  for (const field of ['title', 'company', 'location', 'description', 'phone']) form.elements[field].value = item?.[field] || '';
  form.querySelector('.form-status').textContent = jobsEnabled ? '' : t('msg.6e5f898e08');
  dialog.showModal();
}
byId('publish-job').onclick = () => openForm();
byId('jobs-login').onclick = () => askLogin?.();
export function connectJobs(firestore, database, openAuth) { api = firestore; db = database; askLogin = openAuth; }
export function setJobsSession(account) {
  user = account; generation++; stop?.(); stop = null; entries = []; error = ''; dialog.close();
  if (user && jobsEnabled && api) {
    const version = generation;
    error = t('ui.005a25f0ef');
    stop = api.onSnapshot(api.query(api.collection(db, 'webJobOffers'), api.where('expiresAt', '>', Date.now()), api.orderBy('expiresAt'), api.limit(50)), snapshot => {
      if (version !== generation) return;
      entries = snapshot.docs.map(doc => ({...doc.data(), id:doc.id})); error = ''; render();
    }, () => { if (version !== generation) return; entries = []; error = t('msg.3626f679ab'); render(); });
  }
  render();
}
form.onsubmit = async event => {
  event.preventDefault();
  const feedback = form.querySelector('.form-status');
  if (!jobsEnabled) { feedback.textContent = t('msg.d6a392847b'); return; }
  if (!user || !api) { feedback.textContent = t('msg.4b55d42551'); return; }
  const submit = form.querySelector('[type="submit"]'); if (submit.disabled) return;
  const values = Object.fromEntries(['title', 'company', 'location', 'description', 'phone'].map(name => [name, form.elements[name].value.trim()]));
  Object.assign(values,languagePayload(form));
  values.phone = values.phone.replace(/[\s().-]/g, '');
  if (Object.values(values).some(value => !value) || !/^\+[1-9]\d{7,14}$/.test(values.phone) || !form.elements.consent.checked) {
    feedback.textContent = t('msg.1a609d4526'); return;
  }
  const version = generation, id = form.dataset.editId;
  submit.disabled = true; feedback.textContent = t('common.saving');
  try {
    if (id) await api.updateDoc(api.doc(db, 'webJobOffers', id), values);
    else { const now = Date.now(); await api.addDoc(api.collection(db, 'webJobOffers'), {...values, owner:user.uid, createdAt:now, expiresAt:now + 30*day}); }
    if (version === generation) dialog.close();
  } catch { if (version === generation) feedback.textContent = t('msg.f2f2c46aaf'); }
  finally { submit.disabled = false; }
};
setInterval(() => { if (entries.some(item => item.expiresAt <= Date.now())) { entries = multilingualSearch.filter(entries).filter(item => item.expiresAt > Date.now()); render(); } }, 15000);
render();
