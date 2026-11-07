import { editorialEnabled } from './rides-settings.js';

const byId = id => document.getElementById(id);
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const dayMs = 86400000;
const romeDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
});
const romeTime = new Intl.DateTimeFormat('es-IT', {
  timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const dateLabel = new Intl.DateTimeFormat('es', { dateStyle: 'long', timeZone: 'UTC' });
const monthLabel = new Intl.DateTimeFormat('es', { year: 'numeric', month: 'long', timeZone: 'UTC' });
const currentMonth = () => new Date(romeDate.format(new Date()).slice(0, 7) + '-01T00:00:00Z');
const dateKey = date => date.toISOString().slice(0, 10);
const calendarSeed = [{
  date: '2026-11-07',
  title: 'San Martino en el Quartiere Rocchetta',
  location: 'Quartiere Rocchetta, Paola',
  description: 'Degustación de vinos, gastronomía, música en vivo y DJ set.',
  href: '#san-martino-2026',
}];

let api, db, month = currentMonth(), selectedDay = '';
let monthStops = [];
const calendarSources = new Map();
const calendarFailed = new Set();
const calendarLoading = new Set();

function renderCalendar() {
  const grid = byId('calendar-grid');
  const current = romeDate.format(new Date());
  const monthKey = dateKey(month).slice(0, 7);
  const all = [calendarSeed, ...calendarSources.values()].flat()
    .filter(item => item.date?.startsWith(monthKey))
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  byId('calendar-month').textContent = monthLabel.format(month);
  const cells = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => el('span', day, 'calendar-weekday'));
  for (let i = 0; i < (month.getUTCDay() + 6) % 7; i++) cells.push(el('span'));
  const last = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  for (let day = 1; day <= last; day++) {
    const key = monthKey + '-' + String(day).padStart(2, '0');
    const count = all.filter(event => event.date === key).length;
    const cell = el(count ? 'button' : 'span', day, 'calendar-day');
    if (key === current) cell.setAttribute('aria-current', 'date');
    if (count) {
      cell.type = 'button';
      cell.setAttribute('aria-label', dateLabel.format(new Date(key)) + ', eventos: ' + count);
      cell.setAttribute('aria-pressed', String(selectedDay === key));
      cell.onclick = () => {
        selectedDay = selectedDay === key ? '' : key;
        renderCalendar();
        grid.querySelector('[data-date="' + key + '"]')?.focus();
      };
      cell.dataset.date = key;
    }
    cells.push(cell);
  }
  grid.replaceChildren(...cells);
  byId('calendar-clear').hidden = !selectedDay;
  byId('calendar-selection').textContent = selectedDay ? dateLabel.format(new Date(selectedDay)) : 'Eventos del mes';
  const visible = selectedDay ? all.filter(item => item.date === selectedDay) : all;
  byId('calendar-status').textContent = calendarLoading.size ? 'Actualizando la agenda…'
    : calendarFailed.size ? 'No se pudieron consultar todas las fuentes de la agenda.'
    : visible.length ? '' : 'No hay eventos registrados para este período.';
  byId('calendar-events').replaceChildren(...visible.map(event => {
    const item = el('li');
    const heading = el('h4');
    if (event.href) {
      const link = el('a', event.title);
      link.href = event.href;
      heading.append(link);
    } else heading.textContent = event.title;
    item.append(el('small', dateLabel.format(new Date(event.date)) + (event.time ? ' · ' + event.time : '')), heading);
    if (event.location) item.append(el('p', event.location));
    if (event.description) item.append(el('p', event.description));
    return item;
  }));
}

function rows(snapshot) {
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

function loadMonth() {
  monthStops.forEach(stop => stop());
  monthStops = [];
  calendarSources.clear();
  calendarFailed.clear();
  calendarLoading.clear();
  if (api) {
    const next = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
    const legacy = (item, field, titleField, withTime) => {
      const date = item[field]?.toDate?.();
      if (!date || !Number.isFinite(date.getTime())) return null;
      return { date: romeDate.format(date), time: withTime ? romeTime.format(date) : '',
        title: item[titleField] || 'Evento', description: item.description || '' };
    };
    const sources = [
      ['webCalendarEvents', 'date', dateKey(month), dateKey(next), item => item],
      ['events', 'scheduledAt', new Date(month.getTime() - dayMs), new Date(next.getTime() + dayMs),
        item => legacy(item, 'scheduledAt', 'name', true)],
      ['calendarEvents', 'date', new Date(month.getTime() - dayMs), new Date(next.getTime() + dayMs),
        item => legacy(item, 'date', 'title', false)],
    ];
    for (const [name, field, from, to, map] of sources) {
      calendarLoading.add(name);
      const query = api.query(api.collection(db, name), api.where(field, '>=', from), api.where(field, '<', to));
      monthStops.push(api.onSnapshot(query, snapshot => {
        calendarSources.set(name, rows(snapshot).map(map).filter(Boolean));
        calendarLoading.delete(name);
        renderCalendar();
      }, () => {
        calendarLoading.delete(name);
        calendarFailed.add(name);
        renderCalendar();
      }));
    }
  }
  renderCalendar();
}

function moveMonth(offset) {
  selectedDay = '';
  month = offset ? new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + offset, 1)) : currentMonth();
  loadMonth();
}
byId('calendar-prev').onclick = () => moveMonth(-1);
byId('calendar-next').onclick = () => moveMonth(1);
byId('calendar-today').onclick = () => moveMonth(0);
byId('calendar-clear').onclick = () => {
  selectedDay = '';
  renderCalendar();
};
renderCalendar();

const adminDialog = byId('editorial-dialog');
const openAdmin = byId('open-editorial');
const status = byId('editorial-status');
const forms = {
  blog: byId('blog-form'),
  event: byId('event-form'),
  admin: byId('admin-form'),
};
let isOwner = false;
let isAdmin = false;
let sessionVersion = 0;
let adminStops = [];

const reference = (collection, id) => api.doc(db, collection, id);

export function connectEditorial(firestore, database) {
  if (!editorialEnabled) return;
  api = firestore;
  db = database;
  loadMonth();
  api.onSnapshot(api.query(api.collection(db, 'webBlogPosts'), api.where('published', '==', true)), snapshot => {
    const posts = rows(snapshot).sort((a, b) => b.updatedAt - a.updatedAt);
    byId('blog-posts').replaceChildren(...posts.map(post => {
      const card = el('article', undefined, 'news-card card-copy');
      const details = el('details');
      details.append(el('summary', 'Leer artículo'), el('p', post.body, 'blog-body'));
      card.append(el('small', 'BLOG'), el('h3', post.title), el('p', post.summary), details);
      return card;
    }));
  }, () => { byId('blog-posts').replaceChildren(); });
}

export async function setEditorialSession(user) {
  const version = ++sessionVersion;
  openAdmin.hidden = true;
  isOwner = isAdmin = false;
  adminDialog.close();
  if (!user?.emailVerified || !user.email || !api) return;
  const read = ref => api.getDocFromServer(ref).then(result => result.exists(), () => false);
  const [owns, member] = await Promise.all([
    read(reference('webAdminConfig', 'owner')),
    read(reference('webAdmins', user.email.toLowerCase())),
  ]);
  if (version !== sessionVersion) return;
  isOwner = owns;
  isAdmin = owns || member;
  openAdmin.hidden = !isAdmin;
  byId('editorial-admins').hidden = !isOwner;
}

const operations = {
  blog: {
    collection: 'webBlogPosts',
    fields: ['title', 'summary', 'body'],
    label: item => item.title + (item.published ? ' · Publicado' : ' · Borrador'),
    payload: (form, data) => ({ ...data, published: form.elements.published.checked, updatedAt: Date.now() }),
  },
  event: {
    collection: 'webCalendarEvents',
    fields: ['title', 'date', 'time', 'location', 'description'],
    label: item => item.date + ' · ' + item.title,
    payload: (_, data) => data,
  },
  admin: {
    collection: 'webAdmins',
    fields: ['name'],
    label: item => item.name + ' · ' + item.id,
    payload: (_, data) => data,
  },
};

function action(label, run) {
  const button = el('button', label, 'outline');
  button.type = 'button';
  button.onclick = async () => {
    button.disabled = true;
    try { await run(); }
    finally { button.disabled = false; }
  };
  return button;
}

function resetForm(form) {
  form.reset();
  delete form.dataset.editId;
  if (form.elements.email) form.elements.email.readOnly = false;
}

function editForm(kind, item) {
  const form = forms[kind];
  resetForm(form);
  form.dataset.editId = item.id;
  for (const name of operations[kind].fields) form.elements[name].value = item[name] || '';
  if (kind === 'blog') form.elements.published.checked = item.published;
  if (kind === 'admin') {
    form.elements.email.value = item.id;
    form.elements.email.readOnly = true;
  }
  form.querySelector('input').focus();
}

async function write(task, success) {
  if (!isAdmin) return false;
  status.textContent = 'Guardando…';
  try {
    await task();
    status.textContent = success;
    return true;
  } catch {
    status.textContent = 'No se pudo guardar. Comprobá tu acceso y volvé a intentar.';
    return false;
  }
}

for (const [kind, config] of Object.entries(operations)) {
  const form = forms[kind];
  form.addEventListener('reset', () => {
    delete form.dataset.editId;
    if (form.elements.email) form.elements.email.readOnly = false;
  });
  form.onsubmit = async event => {
    event.preventDefault();
    if (kind === 'admin' && !isOwner) return;
    const submit = form.querySelector('[type="submit"]');
    if (submit.disabled) return;
    const data = Object.fromEntries(config.fields.map(name => [name, form.elements[name].value.trim()]));
    if (['title', 'summary', 'body', 'name'].some(name => name in data && !data[name])) {
      status.textContent = 'Completá los campos obligatorios.';
      return;
    }
    const id = form.dataset.editId;
    const values = config.payload(form, data);
    submit.disabled = true;
    const saved = await write(async () => {
      if (kind === 'admin') {
        if (id) await api.updateDoc(reference(config.collection, id), values);
        else {
          const email = form.elements.email.value.trim().toLowerCase();
          const ref = reference(config.collection, email);
          await api.runTransaction(db, async transaction => {
            if ((await transaction.get(ref)).exists()) throw new Error('Ya existe');
            transaction.set(ref, values);
          });
        }
      } else if (id) await api.updateDoc(reference(config.collection, id), values);
      else await api.addDoc(api.collection(db, config.collection), values);
    }, 'Cambios guardados.');
    if (saved) resetForm(form);
    submit.disabled = false;
  };
}

function renderRecords(kind, items) {
  const config = operations[kind];
  const list = byId('editorial-' + kind + '-list');
  list.replaceChildren(...items.map(item => {
    const row = el('li');
    const buttons = el('div', undefined, 'editorial-actions');
    buttons.append(action('Editar', () => editForm(kind, item)), action('Eliminar', async () => {
      if (!window.confirm('¿Eliminar ' + config.label(item) + '?')) return;
      await write(() => api.deleteDoc(reference(config.collection, item.id)), 'Registro eliminado.');
    }));
    row.append(el('strong', config.label(item)), buttons);
    return row;
  }));
  if (!items.length) list.append(el('li', 'No hay registros.'));
}

let driverProfiles = [], driverBlocks = [];
function renderDrivers() {
  const list = byId('editorial-driver-list');
  list.replaceChildren(...driverProfiles.map(driver => {
    const row = el('li', driver.name);
    row.append(el('div', undefined, 'editorial-actions'));
    row.lastChild.append(action('Eliminar chofer', async () => {
      if (!window.confirm('¿Retirar y bloquear a ' + driver.name + '?')) return;
      await write(async () => {
        const batch = api.writeBatch(db);
        batch.set(reference('webDriverBlocks', driver.id), { name: driver.name });
        batch.delete(reference('webAvailableDrivers', driver.id));
        batch.delete(reference('webDriverProfiles', driver.id));
        await batch.commit();
      }, 'Chofer retirado y bloqueado.');
    }));
    return row;
  }), ...driverBlocks.map(driver => {
    const row = el('li', driver.name + ' · Bloqueado');
    const buttons = el('div', undefined, 'editorial-actions');
    buttons.append(action('Quitar bloqueo', () =>
      write(() => api.deleteDoc(reference('webDriverBlocks', driver.id)), 'Bloqueo quitado.')));
    row.append(buttons);
    return row;
  }));
  if (!driverProfiles.length && !driverBlocks.length) list.append(el('li', 'No hay choferes registrados.'));
}

function observeAdmin(collection, update) {
  adminStops.push(api.onSnapshot(api.collection(db, collection), snapshot => update(rows(snapshot)), () => {
    status.textContent = 'No se pudieron cargar todos los datos de administración.';
  }));
}

openAdmin.onclick = () => {
  if (!isAdmin) return;
  byId('authDialog').close();
  status.textContent = '';
  Object.values(forms).forEach(resetForm);
  driverProfiles = [];
  driverBlocks = [];
  for (const id of ['blog', 'event', 'admin', 'driver']) {
    byId('editorial-' + id + '-list').replaceChildren(el('li', 'Cargando…'));
  }
  adminDialog.showModal();
  for (const [kind, config] of Object.entries(operations)) {
    if (kind !== 'admin' || isOwner) observeAdmin(config.collection, items => renderRecords(kind, items));
  }
  observeAdmin('webDriverProfiles', items => { driverProfiles = items; renderDrivers(); });
  observeAdmin('webDriverBlocks', items => { driverBlocks = items; renderDrivers(); });
};
adminDialog.addEventListener('close', () => {
  adminStops.forEach(stop => stop());
  adminStops = [];
  for (const id of ['blog', 'event', 'admin', 'driver']) byId('editorial-' + id + '-list').replaceChildren();
});
