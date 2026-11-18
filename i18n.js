import {languages,languageNames,formatMessage,localizedURL} from './i18n-core.js';
export {languages,languageNames};
export const locale = languages.includes(document.documentElement.lang) ? document.documentElement.lang : 'it';
const messages = JSON.parse(document.getElementById('locale-messages').textContent);
export const t = (key, values) => formatMessage(messages,locale,key,values);
const dirty = new Set();
document.addEventListener('input', event => {
  const input=event.target;
  if (input.form?.closest('dialog')) dirty.add(input.form);
  if (input.setCustomValidity) input.setCustomValidity('');
});
document.addEventListener('invalid', event => {
  const input=event.target;
  if(input.setCustomValidity) input.setCustomValidity(t(input.validity.valueMissing?'form.required':'form.invalid'));
},true);
document.addEventListener('reset',event=>dirty.delete(event.target),true);
document.addEventListener('close',event=>event.target.querySelectorAll?.('form').forEach(f=>dirty.delete(f)),true);
const hasChanges=()=>[...dirty].some(f=>f.isConnected&&f.closest('dialog')?.open);
let leaving=false;
window.addEventListener('beforeunload',e=>{if(!leaving&&hasChanges()){e.preventDefault();e.returnValue='';}});
document.querySelectorAll('[data-language]').forEach(link=>{
  link.href=localizedURL(location.href,link.dataset.language).href;
  window.addEventListener('hashchange',()=>{link.href=localizedURL(location.href,link.dataset.language).href;});
  link.addEventListener('click',event=>{
    link.href=localizedURL(location.href,link.dataset.language).href;
    if(hasChanges()&&!confirm(t('form.unsaved'))){event.preventDefault();return;}
    try{localStorage.setItem('paola-language',link.dataset.language);}catch{}
    leaving=true;
  });
});
try{localStorage.setItem('paola-language',locale);}catch{}
