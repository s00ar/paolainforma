import {languageField,languagePayload,attachTranslation,createSearch} from './content-language.js';
import { t, locale } from './i18n.js';
let moderator = false;
window.addEventListener('site-role', event => { moderator = event.detail.admin; render(); });
import { rentalsEnabled } from './rides-settings.js?v=20261118-i18n';
const byId=id=>document.getElementById(id);
const form=byId('rental-form'), dialog=byId('rental-dialog'), status=byId('rental-status'), filters=byId('rental-search');
const money=new Intl.NumberFormat(locale,{style:'currency',currency:'EUR'});
const types={departamento:t('ui.4695dca246'),casa:t('ui.9a33432b00'),habitacion:t('ui.d43a2a5958')};
let api,db,user,askLogin,stop,entries=[],error='',generation=0;
const node=(tag,text,className)=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;};
const action=(label,handler)=>{const el=node('button',label,'outline');el.type='button';el.onclick=handler;return el;};
const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
const multilingualSearch=createSearch('webRentalOffers',byId('rental-list'),()=>render(),filters.elements.query);
function render(){
 const query=normalize(filters.elements.query.value.trim()),type=filters.elements.type.value;
 const max=filters.elements.maxRent.value===''?Infinity:Number(filters.elements.maxRent.value)*100;
 const active=multilingualSearch.filter(entries).filter(item=>item.expiresAt>Date.now());
 const shown=active.filter(item=>(!type||item.propertyType===type)&&item.rentCents<=max);
 status.textContent=!rentalsEnabled?t('msg.21d2b107f5'):!user?t('msg.58b456ad1b'):error||(shown.length?t('rental.count',{count:shown.length}):active.length?t('msg.5178b89e87'):t('msg.4662a106ef'));
 byId('rentals-login').hidden=Boolean(user);
 byId('rental-list').replaceChildren(...shown.map(item=>{
  const row=node('li','','rental-card');row.append(node('small',types[item.propertyType]+' · '+item.location),node('h3',item.title),node('p',t('rental.month',{price:money.format(item.rentCents/100)}),'rental-price'),node('p',item.rooms===0?t('rental.studio'):t('rental.rooms',{count:item.rooms})),node('p',item.description,'job-description'));
  const actions=node('div','','job-actions');const contact=node('a',t('msg.f9b77bb86f'),'wa');contact.href='https://wa.me/'+item.phone.slice(1);contact.target='_blank';contact.rel="noopener noreferrer";actions.append(contact);
  if((item.owner===user?.uid || moderator))actions.append(action(t('msg.b5c77ba625'),()=>openForm(item)),action(t('msg.559d15523a'),async()=>{
   if(!confirm(t('msg.3a35171142')))return;
   try{await api.deleteDoc(api.doc(db,'webRentalOffers',item.id));}catch{status.textContent=t('msg.f97cac2351');}
  }));attachTranslation(row,'webRentalOffers/'+item.id,item,{title:row.querySelector('h3'),description:row.querySelector('.job-description')});row.append(actions);return row;
 }));
}
function openForm(item){
 if(!user){askLogin?.(()=>openForm());return;}
 form.reset();languageField(form,item);form.dataset.editId=item?.id||'';byId('rental-dialog-title').textContent=item?t('msg.b5c77ba625'):t('ui.dccbf68ccd');
 if(item){for(const name of ['title','location','propertyType','rooms','description','phone'])form.elements[name].value=item[name];form.elements.rent.value=item.rentCents/100;}
 form.querySelector('.form-status').textContent=rentalsEnabled?'':t('msg.cc735680ff');dialog.showModal();
}
byId('publish-rental').onclick=()=>openForm();byId('rentals-login').onclick=()=>askLogin?.();
filters.onsubmit=event=>event.preventDefault();filters.addEventListener('input',render);filters.addEventListener('change',render);filters.addEventListener('reset',()=>setTimeout(render,0));
export function connectRentals(firestore,database,openAuth){api=firestore;db=database;askLogin=openAuth;}
export function setRentalsSession(account){
 user=account;generation++;stop?.();stop=null;entries=[];error='';dialog.close();
 if(user&&rentalsEnabled&&api){const version=generation;error=t('ui.be6e520513');
  stop=api.onSnapshot(api.query(api.collection(db,'webRentalOffers'),api.where('expiresAt','>',Date.now()),api.orderBy('expiresAt'),api.limit(50)),snapshot=>{
   if(version!==generation)return;entries=snapshot.docs.map(doc=>({...doc.data(),id:doc.id}));error='';render();
  },()=>{if(version!==generation)return;entries=[];error=t('msg.daff21e0d4');render();});
 }render();
}
form.onsubmit=async event=>{
 event.preventDefault();const feedback=form.querySelector('.form-status');
 if(!rentalsEnabled){feedback.textContent=t('msg.cb04d1dcbe');return;}
 if(!user||!api){feedback.textContent=t('msg.4b55d42551');return;}
 const submit=form.querySelector('[type="submit"]');if(submit.disabled)return;
 const values=Object.fromEntries(['title','location','propertyType','description','phone'].map(name=>[name,form.elements[name].value.trim()]));
 Object.assign(values,languagePayload(form));values.phone=values.phone.replace(/[\s().-]/g,'');values.rentCents=Math.round(Number(form.elements.rent.value)*100);values.rooms=Number(form.elements.rooms.value);
 if(!values.title||!values.location||!values.description||!types[values.propertyType]||!/^\+[1-9]\d{7,14}$/.test(values.phone)||!Number.isInteger(values.rentCents)||values.rentCents<100||values.rentCents>10000000||!Number.isInteger(values.rooms)||values.rooms<0||values.rooms>30||!form.elements.consent.checked){feedback.textContent=t('msg.d493fdb045');return;}
 const version=generation,id=form.dataset.editId;submit.disabled=true;feedback.textContent=t('common.saving');
 try{if(id)await api.updateDoc(api.doc(db,'webRentalOffers',id),values);else{const now=Date.now();await api.addDoc(api.collection(db,'webRentalOffers'),{...values,owner:user.uid,createdAt:now,expiresAt:now+2592000000});}if(version===generation)dialog.close();}
 catch{if(version===generation)feedback.textContent=t('msg.719661b8ea');}
 finally{submit.disabled=false;}
};
setInterval(()=>{if(entries.some(item=>item.expiresAt<=Date.now())){entries=multilingualSearch.filter(entries).filter(item=>item.expiresAt>Date.now());render();}},15000);
render();
