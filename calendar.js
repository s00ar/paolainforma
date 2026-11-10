import { firebaseConfig } from './firebase-config.js?v=20261110-4';
import { editorialEnabled } from './rides-settings.js?v=20261110-4';

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
  description: 'VIII edición. Degustación de vinos, puestos gastronómicos, música en vivo, DJ set y Danza di San Martino.',
  href: './noticias.html#san-martino-2026',
}];

const requested = new URLSearchParams(location.search).get('fecha') || '';
const requestedDay = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(requested) ? new Date(requested) : null;
let selectedDay = requestedDay && Number.isFinite(requestedDay.getTime()) && dateKey(requestedDay) === requested ? requested : '';
let api, db, month = selectedDay ? new Date(selectedDay.slice(0, 7) + '-01T00:00:00Z') : currentMonth();
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


if (editorialEnabled) {
  Promise.all([
    import('https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js'),
  ]).then(([appSdk, firestoreSdk]) => {
    api = firestoreSdk;
    db = api.getFirestore(appSdk.initializeApp(firebaseConfig));
    loadMonth();
  }).catch(() => {
    calendarFailed.add('firebase');
    renderCalendar();
  });
}
