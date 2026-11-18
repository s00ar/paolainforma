import {languageField,languagePayload,attachTranslation} from './content-language.js';
import {editTranslations} from './editorial-languages.js';
import {languageMetadataEnabled} from './content-settings.js';
import { t, locale } from './i18n.js';
import { editorialEnabled } from './rides-settings.js?v=20261118-i18n';

const byId = id => document.getElementById(id);
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
let api, db;
const rows = snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

const adminDialog = byId('editorial-dialog');
const openAdmin = byId('open-editorial');
const status = byId('editorial-status');
const forms = {
  blog: byId('blog-form'),
  event: byId('event-form'),
  admin: byId('admin-form'),
};
const kindLabel=document.createElement('label');kindLabel.textContent=t('editorial.kind');
const kindSelect=document.createElement('select');kindSelect.name='contentKind';kindSelect.disabled=!languageMetadataEnabled;
for(const [value,key] of [['article','editorial.article'],['news','editorial.news'],['guide','editorial.guide']]){const option=document.createElement('option');option.value=value;option.textContent=t(key);kindSelect.append(option);}
kindLabel.append(kindSelect);forms.blog.prepend(kindLabel);
let isOwner = false;
let isAdmin = false;
let sessionVersion = 0;
let adminStops = [];

const reference = (collection, id) => api.doc(db, collection, id);

export function connectEditorial(firestore, database) {
  if (!editorialEnabled) return;
  api = firestore;
  db = database;
  if (byId('blog-posts')) api.onSnapshot(api.query(api.collection(db, 'webBlogPosts'), api.where('published', '==', true)), snapshot => {
    const posts = rows(snapshot).sort((a, b) => b.updatedAt - a.updatedAt);
    byId('blog-posts').replaceChildren(...posts.map(post => {
      const card = el('article', undefined, "news-card card-copy");
      const details = el('details');
      details.append(el('summary', t('msg.1078b4db9b')), el('p', post.body, 'blog-body'));
      card.append(el('small', 'BLOG'), el('h3', post.title), el('p', post.summary), details);
      attachTranslation(card,'webBlogPosts/'+post.id,post,{title:card.querySelector('h3'),summary:card.querySelector(':scope > p'),body:card.querySelector('.blog-body')},{editorial:true});
      return card;
    }));
  }, () => { byId('blog-posts').replaceChildren(); });
}

export async function setEditorialSession(user) {
  const version = ++sessionVersion;
  openAdmin.hidden = true;
  isOwner = isAdmin = false;
  window.dispatchEvent(new CustomEvent('site-role', {detail:{admin:false}}));
  adminDialog.close();
  if (!user?.emailVerified || !user.email || !api) return;
  const read = ref => api.getDocFromServer(ref).then(result => result.exists(), () => false);
  const [owns, member] = await Promise.all([
    read(reference('webAdminConfig', 'owner')),
    read(reference('webAdmins', user.email.toLowerCase())),
  ]);
  if (version !== sessionVersion) return;
  isOwner = user.emailVerified && user.email.toLowerCase() === 'leston.s.h@gmail.com';
  isAdmin = isOwner || member;
  window.dispatchEvent(new CustomEvent('site-role', {detail:{admin:isAdmin}}));
  openAdmin.hidden = !isAdmin;
  byId('editorial-admins').hidden = !isOwner;
}

const operations = {
  blog: {
    collection: 'webBlogPosts',
    fields: ['title', 'summary', 'body'],
    label: item => item.title + (item.published ? ' · '+t('common.published') : ' · '+t('common.draft')),
    payload: (form, data) => ({ ...data, published: form.elements.published.checked, updatedAt: Date.now(),...(languageMetadataEnabled?{contentKind:form.elements.contentKind.value}:{}) }),
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
  form.reset();if(form!==forms.admin)languageField(form);
  delete form.dataset.editId;
  if (form.elements.email) form.elements.email.readOnly = false;
}

function editForm(kind, item) {
  const form = forms[kind];
  resetForm(form);
  form.dataset.editId = item.id;if(kind!=='admin')languageField(form,item);
  for (const name of operations[kind].fields) form.elements[name].value = item[name] || '';
  if (kind === 'blog') {form.elements.published.checked = item.published;form.elements.contentKind.value=item.contentKind||'article';}
  if (kind === 'admin') {
    form.elements.email.value = item.id;
    form.elements.email.readOnly = true;
  }
  form.querySelector('input').focus();
}

async function write(task, success) {
  if (!isAdmin) return false;
  status.textContent = t('common.saving');
  try {
    await task();
    status.textContent = success;
    return true;
  } catch {
    status.textContent = t('msg.caf3390e7d');
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
      status.textContent = t('msg.5520e89637');
      return;
    }
    const id = form.dataset.editId;
    const values = {...config.payload(form, data),...(kind!=='admin'?languagePayload(form):{})};
    submit.disabled = true;
    const saved = await write(async () => {
      if (kind === 'admin') {
        if (id) await api.updateDoc(reference(config.collection, id), values);
        else {
          const email = form.elements.email.value.trim().toLowerCase();
          const ref = reference(config.collection, email);
          await api.runTransaction(db, async transaction => {
            if ((await transaction.get(ref)).exists()) throw new Error(t('msg.815d2204de'));
            transaction.set(ref, values);
          });
        }
      } else if (id) await api.updateDoc(reference(config.collection, id), values);
      else await api.addDoc(api.collection(db, config.collection), values);
    }, t('msg.2398046c36'));
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
    buttons.append(action(t('common.edit'), () => editForm(kind, item)), action(t('common.delete'), async () => {
      if (!window.confirm(t('msg.d3ae1175dd') + config.label(item) + '?')) return;
      await write(() => api.deleteDoc(reference(config.collection, item.id)), t('msg.9f954be348'));
    }));
    if(kind!=='admin')buttons.append(action(t('editorial.translations'),()=>editTranslations(config.collection,item)));
    row.append(el('strong', config.label(item)), buttons);
    return row;
  }));
  if (!items.length) list.append(el('li', t('msg.290ebb624c')));
}

let driverProfiles = [], driverBlocks = [];
function renderDrivers() {
  const list = byId('editorial-driver-list');
  list.replaceChildren(...driverProfiles.map(driver => {
    const row = el('li', driver.name);
    row.append(el('div', undefined, 'editorial-actions'));
    row.lastChild.append(action(t('msg.a71b858d4f'), async () => {
      const name=prompt(t('msg.0b4fa8672d'),driver.name);if(name===null)return;
      const phone=prompt(t('ui.306d85ffd0'),driver.phone);if(phone===null)return;
      await write(()=>api.updateDoc(reference('webDriverProfiles',driver.id),{name:name.trim(),phone:phone.trim()}),t('msg.6dce2956f0'));
    }), action(t('msg.9f6e59080b'), async () => {
      if (!window.confirm(t('msg.a3628f7c8c') + driver.name + '?')) return;
      await write(async () => {
        const batch = api.writeBatch(db);
        batch.set(reference('webDriverBlocks', driver.id), { name: driver.name });
        batch.delete(reference('webAvailableDrivers', driver.id));
        batch.delete(reference('webDriverProfiles', driver.id));
        await batch.commit();
      }, t('msg.52c1e9fc33'));
    }));
    return row;
  }), ...driverBlocks.map(driver => {
    const row = el('li', driver.name + ' · '+t('common.blocked'));
    const buttons = el('div', undefined, 'editorial-actions');
    buttons.append(action(t('msg.32d8509684'), () =>
      write(() => api.deleteDoc(reference('webDriverBlocks', driver.id)), t('msg.22b4982145'))));
    row.append(buttons);
    return row;
  }));
  if (!driverProfiles.length && !driverBlocks.length) list.append(el('li', t('msg.f8302374c5')));
}

function observeAdmin(collection, update) {
  adminStops.push(api.onSnapshot(api.collection(db, collection), snapshot => update(rows(snapshot)), () => {
    status.textContent = t('msg.3fa0fe2bfe');
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
    byId('editorial-' + id + '-list').replaceChildren(el('li', t('common.loading')));
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
