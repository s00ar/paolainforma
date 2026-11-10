import { directoryEnabled } from './rides-settings.js?v=20261110-4';
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
 if(!directoryEnabled){status.textContent='El directorio y las reseñas estarán disponibles cuando se activen sus permisos.';return;}
 if(!u){status.textContent='Ingresá con Google para consultar los perfiles y sus reseñas.';render();return;}
 status.textContent='Cargando perfiles…';const version=u.uid;
 stops.push(api.onSnapshot(api.collection(db,'webDriverProfiles'),s=>{
 if(user?.uid!==version)return;profiles=s.docs.map(d=>({...d.data(),id:d.id}));status.textContent='';
 for(const [id,stop] of reviewStops)if(!profiles.some(p=>p.id===id)){stop();reviewStops.delete(id);reviews.delete(id);}
 for(const p of profiles)if(!reviewStops.has(p.id))reviewStops.set(p.id,api.onSnapshot(api.collection(db,'webDriverReviews',p.id,'reviews'),r=>{reviews.set(p.id,r.docs.map(d=>({...d.data(),id:d.id})));render();},()=>{reviews.set(p.id,null);render();}));render();
 },()=>{profiles=[];status.textContent='No se pudieron cargar los perfiles. Volvé a intentar.';render();}));
 stops.push(api.onSnapshot(api.query(api.collection(db,'webAvailableDrivers'),api.limit(50)),s=>{availability=s.docs.map(d=>({...d.data(),id:d.id}));render();},()=>{availability=[];status.textContent='No se pudo comprobar la disponibilidad.';render();}));
}
function render(){
 if(!list)return;const active=id=>availability.some(a=>a.id===id&&a.expiresAt>Date.now());
 list.replaceChildren(...[...profiles].sort((a,b)=>Number(active(b.id))-Number(active(a.id))||a.name.localeCompare(b.name)).map(p=>{
 const row=node('li','','job-offer');const online=active(p.id);row.append(node('h3',p.name),node('p',online?'● Disponible ahora':'No disponible en este momento',online?'driver-online':'driver-offline'));
 const rs=reviews.get(p.id);row.append(node('p',rs===null?'No se pudieron cargar las reseñas.':!rs?'Cargando reseñas…':rs.length?'★ '+(rs.reduce((n,r)=>n+r.rating,0)/rs.length).toFixed(1)+' / 5 · '+rs.length+' reseñas':'Sin reseñas todavía'));
 const details=node('details','');details.append(node('summary','Ver perfil y reseñas'));for(const r of rs||[]){const review=node('div','','review-entry');review.append(node('p','★'.repeat(r.rating)+' · '+r.text));if(user?.uid===r.id||admin)review.append(button('Editar reseña',()=>editReview(p,r)),button('Eliminar reseña',async()=>{if(confirm('¿Eliminar esta reseña?'))try{await api.deleteDoc(api.doc(db,'webDriverReviews',p.id,'reviews',r.id));}catch{status.textContent='No se pudo eliminar la reseña.';}}));details.append(review);}row.append(details);
 if(user&&user.uid!==p.id)row.append(button((rs||[]).some(r=>r.id===user.uid)?'Editar mi reseña':'Escribir una reseña',()=>editReview(p,(rs||[]).find(r=>r.id===user.uid))));
 if(online){const a=node('a','Contactar por WhatsApp','wa');a.href='https://wa.me/'+p.phone.slice(1);a.target='_blank';a.rel='noopener noreferrer';row.append(a);}return row;
 }));
}
function editReview(p,r){
 dialog.replaceChildren();const f=node('form','');f.className='ride-form';f.append(node('h2','Reseña de '+p.name));const label=node('label','Puntuación');const select=node('select','');for(let n=1;n<=5;n++){const o=node('option',n+' estrella'+(n===1?'':'s'));o.value=n;select.append(o);}select.value=r?.rating||5;label.append(select);const desc=node('label','Contá brevemente tu experiencia');const text=node('textarea','');text.required=true;text.maxLength=500;text.value=r?.text||'';desc.append(text);const feedback=node('p','');feedback.setAttribute('role','status');const save=node('button','Guardar reseña','primary');save.type='submit';f.append(label,desc,feedback,save,button('Cerrar',()=>dialog.close()));
 const uid=user.uid;f.onsubmit=async e=>{e.preventDefault();if(!text.value.trim())return;save.disabled=true;try{await api.setDoc(api.doc(db,'webDriverReviews',p.id,'reviews',r?.id||uid),{rating:Number(select.value),text:text.value.trim()});dialog.close();}catch{feedback.textContent='No se pudo guardar. Revisá tus permisos e intentá nuevamente.';}finally{save.disabled=false;}};dialog.append(f);dialog.showModal();
}
setInterval(render,15000);
