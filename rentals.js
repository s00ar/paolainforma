import { rentalsEnabled } from './rides-settings.js?v=20261110-1';
const byId=id=>document.getElementById(id);
const form=byId('rental-form'), dialog=byId('rental-dialog'), status=byId('rental-status'), filters=byId('rental-search');
const money=new Intl.NumberFormat('es-IT',{style:'currency',currency:'EUR'});
const types={departamento:'Departamento',casa:'Casa',habitacion:'Habitación'};
let api,db,user,askLogin,stop,entries=[],error='',generation=0;
const node=(tag,text,className)=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;};
const action=(label,handler)=>{const el=node('button',label,'outline');el.type='button';el.onclick=handler;return el;};
const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
function render(){
 const query=normalize(filters.elements.query.value.trim()),type=filters.elements.type.value;
 const max=filters.elements.maxRent.value===''?Infinity:Number(filters.elements.maxRent.value)*100;
 const active=entries.filter(item=>item.expiresAt>Date.now());
 const shown=active.filter(item=>(!type||item.propertyType===type)&&item.rentCents<=max&&normalize(item.title+' '+item.location+' '+item.description).includes(query));
 status.textContent=!rentalsEnabled?'La publicación de alquileres está pendiente de activar sus permisos.':!user?'Ingresá con Google para buscar y publicar alquileres.':error||(shown.length?(shown.length===1?'1 alquiler encontrado.':shown.length+' alquileres encontrados.'):active.length?'No hay alquileres que coincidan con esos filtros.':'Todavía no hay alquileres publicados.');
 byId('rentals-login').hidden=Boolean(user);
 byId('rental-list').replaceChildren(...shown.map(item=>{
  const row=node('li','','rental-card');row.append(node('small',types[item.propertyType]+' · '+item.location),node('h3',item.title),node('p',money.format(item.rentCents/100)+' / mes','rental-price'),node('p',item.rooms===0?'Monoambiente':item.rooms+(item.rooms===1?' dormitorio':' dormitorios')),node('p',item.description,'job-description'));
  const actions=node('div','','job-actions');const contact=node('a','Contactar por WhatsApp','wa');contact.href='https://wa.me/'+item.phone.slice(1);contact.target='_blank';contact.rel='noopener noreferrer';actions.append(contact);
  if(item.owner===user?.uid)actions.append(action('Editar alquiler',()=>openForm(item)),action('Eliminar alquiler',async()=>{
   if(!confirm('¿Eliminar este alquiler?'))return;
   try{await api.deleteDoc(api.doc(db,'webRentalOffers',item.id));}catch{status.textContent='No se pudo eliminar el alquiler. Volvé a intentar.';}
  }));row.append(actions);return row;
 }));
}
function openForm(item){
 if(!user){askLogin?.(()=>openForm());return;}
 form.reset();form.dataset.editId=item?.id||'';byId('rental-dialog-title').textContent=item?'Editar alquiler':'Publicar un alquiler';
 if(item){for(const name of ['title','location','propertyType','rooms','description','phone'])form.elements[name].value=item[name];form.elements.rent.value=item.rentCents/100;}
 form.querySelector('.form-status').textContent=rentalsEnabled?'':'Podés completar el formulario. Para guardarlo falta activar los permisos de alquileres.';dialog.showModal();
}
byId('publish-rental').onclick=()=>openForm();byId('rentals-login').onclick=()=>askLogin?.();
filters.onsubmit=event=>event.preventDefault();filters.addEventListener('input',render);filters.addEventListener('change',render);filters.addEventListener('reset',()=>setTimeout(render,0));
export function connectRentals(firestore,database,openAuth){api=firestore;db=database;askLogin=openAuth;}
export function setRentalsSession(account){
 user=account;generation++;stop?.();stop=null;entries=[];error='';dialog.close();
 if(user&&rentalsEnabled&&api){const version=generation;error='Cargando alquileres…';
  stop=api.onSnapshot(api.query(api.collection(db,'webRentalOffers'),api.where('expiresAt','>',Date.now()),api.orderBy('expiresAt'),api.limit(50)),snapshot=>{
   if(version!==generation)return;entries=snapshot.docs.map(doc=>({...doc.data(),id:doc.id}));error='';render();
  },()=>{if(version!==generation)return;entries=[];error='No se pudieron consultar los alquileres. Revisá tu conexión o volvé a iniciar sesión.';render();});
 }render();
}
form.onsubmit=async event=>{
 event.preventDefault();const feedback=form.querySelector('.form-status');
 if(!rentalsEnabled){feedback.textContent='Falta publicar los permisos de alquileres para habilitar el guardado.';return;}
 if(!user||!api){feedback.textContent='Ingresá con Google para publicar.';return;}
 const submit=form.querySelector('[type="submit"]');if(submit.disabled)return;
 const values=Object.fromEntries(['title','location','propertyType','description','phone'].map(name=>[name,form.elements[name].value.trim()]));
 values.phone=values.phone.replace(/[\s().-]/g,'');values.rentCents=Math.round(Number(form.elements.rent.value)*100);values.rooms=Number(form.elements.rooms.value);
 if(!values.title||!values.location||!values.description||!types[values.propertyType]||!/^\+[1-9]\d{7,14}$/.test(values.phone)||!Number.isInteger(values.rentCents)||values.rentCents<100||values.rentCents>10000000||!Number.isInteger(values.rooms)||values.rooms<0||values.rooms>30||!form.elements.consent.checked){feedback.textContent='Revisá los campos, el importe y el WhatsApp con prefijo internacional, y aceptá compartir el aviso.';return;}
 const version=generation,id=form.dataset.editId;submit.disabled=true;feedback.textContent='Guardando…';
 try{if(id)await api.updateDoc(api.doc(db,'webRentalOffers',id),values);else{const now=Date.now();await api.addDoc(api.collection(db,'webRentalOffers'),{...values,owner:user.uid,createdAt:now,expiresAt:now+2592000000});}if(version===generation)dialog.close();}
 catch{if(version===generation)feedback.textContent='No se pudo guardar el alquiler. Revisá la conexión y tus permisos e intentá de nuevo.';}
 finally{submit.disabled=false;}
};
setInterval(()=>{if(entries.some(item=>item.expiresAt<=Date.now())){entries=entries.filter(item=>item.expiresAt>Date.now());render();}},15000);
render();
