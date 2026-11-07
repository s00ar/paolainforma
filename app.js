import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const dialog=document.querySelector('#authDialog');
const toast=document.querySelector('#toast');
const showToast=(message)=>{toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3500)};
const configured=Object.values(firebaseConfig).every(Boolean);
let auth=null,db=null;
if(configured){const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);}
const googleButton=document.querySelector('#googleLogin');
const login=document.querySelector('#login');
const openDialog=()=>dialog.showModal();
document.querySelector('#menu').addEventListener('click',()=>document.querySelector('#nav').classList.toggle('open'));
document.querySelectorAll('#nav a').forEach(a=>a.addEventListener('click',()=>document.querySelector('#nav').classList.remove('open')));
login.addEventListener('click',openDialog);
document.querySelectorAll('[data-auth]').forEach(b=>b.addEventListener('click',openDialog));
document.querySelector('#closeDialog').addEventListener('click',()=>dialog.close());
if(!configured){googleButton.disabled=true;googleButton.title='Falta completar web/firebase-config.js';showToast('Configurá la misma Firebase de la app en web/firebase-config.js para habilitar el acceso.');}
else {
 const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
 googleButton.addEventListener('click',async()=>{googleButton.disabled=true;googleButton.textContent='Conectando con Google…';try{const result=await signInWithPopup(auth,provider);const user=result.user;await setDoc(doc(db,'users',user.uid),{uid:user.uid,displayName:user.displayName||'',email:user.email||'',photoURL:user.photoURL||'',provider:'google',lastLoginAt:serverTimestamp()},{merge:true});dialog.close();login.textContent=user.displayName?.split(' ')[0]||'Mi cuenta';showToast(`¡Hola, ${user.displayName?.split(' ')[0]||'bienvenido'}! Ya ingresaste.`);}catch(error){console.error('Google sign-in error',error);showToast(error.code==='auth/unauthorized-domain'?'Agregá este dominio autorizado en Firebase Authentication.':error.code==='auth/operation-not-allowed'?'Activá Google como proveedor en Firebase Authentication.':'No se pudo iniciar sesión. Revisá la configuración de Firebase.');}finally{googleButton.disabled=false;googleButton.innerHTML='<span class="google-g">G</span> Continuar con Google <span>↗</span>';}});
 onAuthStateChanged(auth,user=>{if(user)login.textContent=user.displayName?.split(' ')[0]||'Mi cuenta';});
}
