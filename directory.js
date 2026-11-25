import {languageField,languagePayload,attachTranslation} from './content-language.js';
import { t, locale } from './i18n.js';
import { directoryEnabled } from './rides-settings.js?v=20261118-i18n';
let api,db,user,admin=false,profiles=[],availability=[],stops=[],reviewStops=new Map(),reviews=new Map();
const node=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
const button=(text,run)=>{const b=node('button',text,'outline');b.type='button';b.onclick=run;return b;};
const list=document.getElementById('driver-directory');
const status=document.getElementById('directory-status');
const dialog=document.createElement('dialog');dialog.className='ride-form';document.body.append(dialog);
window.addEventListener('site-role',e=>{admin=e.detail.admin;render();dialog.close();});
export function connectDirectory(a,d){api=a;db=d;}
export function setDirectorySession(u){
 stops.forEach(f=>f());reviewStops.forEach(f=>f());stops=[];reviewStops.clear();reviews.clear();profiles=[];availability=[];user=u;dialog.close();
 if(!directoryEnabled){status.textContent=t('msg.3351c01ca2');return;}
 if(!u){status.textContent=t('msg.5634290fa5');render();return;}
 status.textContent=t('msg.ede703eb9b');const version=u.uid;
 stops.push(api.onSnapshot(api.collection(db,'webDriverProfiles'),s=>{
 if(user?.uid!==version)return;profiles=s.docs.map(d=>({...d.data(),id:d.id}));status.textContent='';
 for(const [id,stop] of reviewStops)if(!profiles.some(p=>p.id===id)){stop();reviewStops.delete(id);reviews.delete(id);}
 for(const p of profiles)if(!reviewStops.has(p.id))reviewStops.set(p.id,api.onSnapshot(api.collection(db,'webDriverReviews',p.id,'reviews'),r=>{reviews.set(p.id,r.docs.map(d=>({...d.data(),id:d.id})));render();},()=>{reviews.set(p.id,null);render();}));render();
 },()=>{profiles=[];status.textContent=t('msg.1e59aa4dd4');render();}));
 stops.push(api.onSnapshot(api.query(api.collection(db,'webAvailableDrivers'),api.limit(50)),s=>{availability=s.docs.map(d=>({...d.data(),id:d.id}));render();},()=>{availability=[];status.textContent=t('msg.cd48bbdd32');render();}));
}
function render(){
 if(!list)return;const active=p=>p.alwaysAvailable===true||availability.some(a=>a.id===p.id&&a.expiresAt>Date.now());
 list.replaceChildren(...[...profiles].sort((a,b)=>Number(active(b))-Number(active(a))||a.name.localeCompare(b.name)).map(p=>{
 const row=node('li','','job-offer');const online=active(p);row.append(node('h3',p.name),node('p',p.alwaysAvailable===true?t('drivers.alwaysAvailable'):online?t('msg.c6ce923835'):t('msg.801a29ae59'),online?'driver-online':'driver-offline'));
 const rs=reviews.get(p.id);row.append(node('p',rs===null?t('msg.25cdaac2d7'):!rs?t('msg.fe648070bf'):rs.length?'★ '+new Intl.NumberFormat(locale,{minimumFractionDigits:1,maximumFractionDigits:1}).format(rs.reduce((n,r)=>n+r.rating,0)/rs.length)+' / 5 · '+t('reviews.count',{count:rs.length}):t('msg.931f146ca2')));
 const details=node('details','');details.append(node('summary',t('msg.9177d67ee5')));for(const r of rs||[]){const review=node('div','','review-entry');const reviewText=node('p',r.text);review.append(node('p','★'.repeat(r.rating)),reviewText);attachTranslation(review,'webDriverReviews/'+p.id+'/reviews/'+r.id,r,{text:reviewText});if(user?.uid===r.id||admin)review.append(button(t('msg.73db2f03a5'),()=>editReview(p,r)),button(t('msg.18a7c75142'),async()=>{if(confirm(t('msg.75e1a71e22')))try{await api.deleteDoc(api.doc(db,'webDriverReviews',p.id,'reviews',r.id));}catch{status.textContent=t('msg.cc199265e5');}}));details.append(review);}row.append(details);
 if(user&&user.uid!==p.id)row.append(button((rs||[]).some(r=>r.id===user.uid)?t('msg.fd1c58b41d'):t('msg.15ceaf279e'),()=>editReview(p,(rs||[]).find(r=>r.id===user.uid))));
 if(online){const a=node('a',t('msg.f9b77bb86f'),'wa');a.href='https://wa.me/'+p.phone.slice(1);a.target='_blank';a.rel="noopener noreferrer";row.append(a);}return row;
 }));
}
function editReview(p,r){
 dialog.replaceChildren();const f=node('form','');f.className='ride-form';f.append(node('h2',t('msg.5e1166564b')+p.name));const label=node('label',t('msg.f5f03ac15d'));const select=node('select','');for(let n=1;n<=5;n++){const o=node('option',t('reviews.stars',{count:n}));o.value=n;select.append(o);}select.value=r?.rating||5;label.append(select);const desc=node('label',t('msg.252013bd0b'));const text=node('textarea','');text.required=true;text.maxLength=500;text.value=r?.text||'';desc.append(text);const feedback=node('p','');feedback.setAttribute('role','status');const save=node('button',t('msg.85418ae519'),'primary');save.type='submit';f.append(label,desc,feedback,save,button(t('ui.aeccae342e'),()=>dialog.close()));
 languageField(f,r);const uid=user.uid;f.onsubmit=async e=>{e.preventDefault();if(!text.value.trim())return;save.disabled=true;try{await api.setDoc(api.doc(db,'webDriverReviews',p.id,'reviews',r?.id||uid),{rating:Number(select.value),text:text.value.trim(),...languagePayload(f)});dialog.close();}catch{feedback.textContent=t('msg.c35aa877bb');}finally{save.disabled=false;}};dialog.append(f);dialog.showModal();
}
setInterval(render,15000);
