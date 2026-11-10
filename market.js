let moderator = false;
window.addEventListener('site-role', event => { moderator = event.detail.admin; render(); });
import { marketEnabled } from './rides-settings.js?v=20261110-4';
const byId = id => document.getElementById(id);
const form = byId('market-form'), dialog = byId('market-dialog'), status = byId('market-status');
let api, db, user, askLogin, stop, entries = [], error = '', generation = 0;
const day = 86400000;
const node = (tag, text, className) => { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; };
const button = (label, action) => { const el = node('button', label, 'outline'); el.type = 'button'; el.onclick = action; return el; };
function render() {
  const active = entries.filter(item => item.expiresAt > Date.now());
  status.textContent = !marketEnabled ? 'La publicación de publicaciones está pendiente de activar sus permisos.'
    : !user ? 'Ingresá con Google para consultar y publicar productos.' : error || (active.length ? '' : 'Todavía no hay productos. Podés publicar la primera.');
  byId('market-login').hidden = Boolean(user);
  byId('market-list').replaceChildren(...active.map(item => {
    const row = node('li', '', 'job-offer');
    row.append(node('h3', item.title), node('p', item.price + ' € · ' + item.location, 'job-meta'), node('p', item.description, 'job-description'));
    row.append(node('small', 'Publicado el ' + new Intl.DateTimeFormat('es', {timeZone:'Europe/Rome'}).format(item.createdAt) + ' · Vigencia: 30 días'));
    const actions = node('div', '', 'job-actions');
    const contact = node('a', 'Contactar por WhatsApp', 'wa');
    contact.href = 'https://wa.me/' + item.phone.slice(1); contact.target = '_blank'; contact.rel = 'noopener noreferrer';
    actions.append(contact);
    if ((item.owner === user?.uid || moderator)) actions.append(button('Editar publicación', () => openForm(item)), button('Eliminar publicación', async () => {
      if (!confirm('¿Eliminar esta producto?')) return;
      try { await api.deleteDoc(api.doc(db, 'webMarketOffers', item.id)); }
      catch { status.textContent = 'No se pudo eliminar la publicación. Revisá tu conexión y volvé a intentar.'; }
    }));
    row.append(actions); return row;
  }));
}
function openForm(item) {
  if (!user) { askLogin?.(() => openForm()); return; }
  form.reset();
  form.dataset.editId = item?.id || '';
  byId('market-dialog-title').textContent = item ? 'Editar producto' : 'Publicar un producto';
  for (const field of ['title', 'price', 'location', 'description', 'phone']) form.elements[field].value = item?.[field] || '';
  form.querySelector('.form-status').textContent = marketEnabled ? '' : 'Podés completar el formulario. Para guardarlo falta activar los permisos de productos.';
  dialog.showModal();
}
byId('publish-market').onclick = () => openForm();
byId('market-login').onclick = () => askLogin?.();
export function connectMarket(firestore, database, openAuth) { api = firestore; db = database; askLogin = openAuth; }
export function setMarketSession(account) {
  user = account; generation++; stop?.(); stop = null; entries = []; error = ''; dialog.close();
  if (user && marketEnabled && api) {
    const version = generation;
    error = 'Cargando productos…';
    stop = api.onSnapshot(api.query(api.collection(db, 'webMarketOffers'), api.where('expiresAt', '>', Date.now()), api.orderBy('expiresAt'), api.limit(50)), snapshot => {
      if (version !== generation) return;
      entries = snapshot.docs.map(doc => ({...doc.data(), id:doc.id})); error = ''; render();
    }, () => { if (version !== generation) return; entries = []; error = 'No se pudieron cargar las publicaciones. Revisá tu conexión o volvé a iniciar sesión.'; render(); });
  }
  render();
}
form.onsubmit = async event => {
  event.preventDefault();
  const feedback = form.querySelector('.form-status');
  if (!marketEnabled) { feedback.textContent = 'Falta publicar los permisos de productos para habilitar el guardado.'; return; }
  if (!user || !api) { feedback.textContent = 'Ingresá con Google para publicar.'; return; }
  const submit = form.querySelector('[type="submit"]'); if (submit.disabled) return;
  const values = Object.fromEntries(['title', 'price', 'location', 'description', 'phone'].map(name => [name, form.elements[name].value.trim()]));
  values.phone = values.phone.replace(/[\s().-]/g, '');
  if (Object.values(values).some(value => !value) || !/^\+[1-9]\d{7,14}$/.test(values.phone) || !form.elements.consent.checked) {
    feedback.textContent = 'Completá los campos, ingresá el WhatsApp con prefijo internacional y aceptá compartirlo.'; return;
  }
  const version = generation, id = form.dataset.editId;
  submit.disabled = true; feedback.textContent = 'Guardando…';
  try {
    if (id) await api.updateDoc(api.doc(db, 'webMarketOffers', id), values);
    else { const now = Date.now(); await api.addDoc(api.collection(db, 'webMarketOffers'), {...values, owner:user.uid, createdAt:now, expiresAt:now + 30*day}); }
    if (version === generation) dialog.close();
  } catch { if (version === generation) feedback.textContent = 'No se pudo guardar la publicación. Revisá la conexión y tus permisos e intentá de nuevo.'; }
  finally { submit.disabled = false; }
};
setInterval(() => { if (entries.some(item => item.expiresAt <= Date.now())) { entries = entries.filter(item => item.expiresAt > Date.now()); render(); } }, 15000);
render();
