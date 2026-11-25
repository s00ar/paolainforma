import {readFile} from 'node:fs/promises';
const {initializeTestEnvironment,assertSucceeds,assertFails}=await import(process.env.RULES_TEST_MODULE||'@firebase/rules-unit-testing');
const {doc,setDoc,updateDoc,deleteDoc,getDoc}=await import(process.env.FIRESTORE_TEST_MODULE||'firebase/firestore');
const env=await initializeTestEnvironment({projectId:'demo-paola',firestore:{host:'127.0.0.1',port:8180,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
try{
 const account=(uid,email,verified=true)=>env.authenticatedContext(uid,{email,email_verified:verified,firebase:{sign_in_provider:'google.com'}}).firestore();
 const root=account('root','leston.s.h@gmail.com'),author=account('author','author@example.test'),other=account('other','other@example.test'),admin=account('admin','admin@example.test'),fake=account('fake','leston.s.h@gmail.com',false),visitor=env.unauthenticatedContext().firestore();
 const grant=d=>doc(d,'webAdmins','admin@example.test');
 await assertFails(setDoc(grant(author),{name:'Admin'}));await assertFails(setDoc(grant(fake),{name:'Admin'}));await assertSucceeds(setDoc(grant(root),{name:'Admin'}));await assertFails(setDoc(doc(admin,'webAdmins','other@example.test'),{name:'No'}));
 const now=Date.now(),base={owner:'author',title:'Bicicletta usata',price:'25.50',location:'Paola',description:'Buone condizioni',phone:'+393331234567',createdAt:now,expiresAt:now+2592000000};
 const product=d=>doc(d,'webMarketOffers','product');
 await assertSucceeds(setDoc(product(author),base)); // Existing documents without a language remain valid.
 await assertSucceeds(updateDoc(product(author),{sourceLanguage:'it'}));
 await assertSucceeds(getDoc(product(other)));await assertFails(getDoc(product(visitor)));
 await assertFails(updateDoc(product(other),{title:'No'}));await assertSucceeds(updateDoc(product(admin),{title:'Moderated'}));
 await assertFails(updateDoc(product(author),{owner:'other'}));await assertFails(updateDoc(product(author),{sourceLanguage:'invalid'}));await assertFails(updateDoc(product(author),{translations:{es:{title:'Forged'}}}));
 for(const collection of ['webTranslations','webTranslationLimits']){
  for(const user of [root,admin,author,other,visitor])await assertFails(setDoc(doc(user,collection,'secret'),{sourcePath:'webBlogPosts/draft',text:'private'}));
  await env.withSecurityRulesDisabled(async context=>setDoc(doc(context.firestore(),collection,'secret'),{text:'private'}));
  for(const user of [root,admin,author,visitor])await assertFails(getDoc(doc(user,collection,'secret')));
 }
 await assertSucceeds(setDoc(doc(root,'webBlogPosts','draft'),{title:'Draft',summary:'Private',body:'Private body',published:false,updatedAt:now,sourceLanguage:'en'}));
 await assertFails(getDoc(doc(visitor,'webBlogPosts','draft')));await assertFails(getDoc(doc(other,'webBlogPosts','draft')));await assertSucceeds(getDoc(doc(admin,'webBlogPosts','draft')));
 await assertSucceeds(setDoc(doc(author,'webDriverProfiles','author'),{name:'Driver',phone:'+393331234567'}));
 const profile=d=>doc(d,'webDriverProfiles','author');
 await assertFails(setDoc(doc(other,'webDriverProfiles','other'),{name:'Driver',phone:'+393331234567',alwaysAvailable:true}));
 await assertFails(updateDoc(profile(author),{alwaysAvailable:true}));
 await assertFails(updateDoc(profile(admin),{alwaysAvailable:'yes'}));
 await assertSucceeds(updateDoc(profile(admin),{alwaysAvailable:true}));
 await assertSucceeds(setDoc(profile(author),{name:'Updated Driver',phone:'+393331234567'},{merge:true}));
 await assertFails(setDoc(profile(author),{name:'Updated Driver',phone:'+393331234567'}));
 await assertFails(updateDoc(profile(author),{alwaysAvailable:false}));
 await assertSucceeds(updateDoc(profile(admin),{alwaysAvailable:false}));
 await assertSucceeds(setDoc(doc(other,'webDriverReviews','author','reviews','other'),{rating:4,text:'Buon viaggio',sourceLanguage:'it'}));
 await assertFails(setDoc(doc(author,'webDriverReviews','author','reviews','author'),{rating:5,text:'Self'}));
 await assertFails(updateDoc(doc(author,'webDriverReviews','author','reviews','other'),{text:'No'}));
 await assertSucceeds(updateDoc(doc(admin,'webDriverReviews','author','reviews','other'),{text:'Moderated'}));
 await assertSucceeds(setDoc(doc(author,'legacyMobile','record'),{existing:true}));
 await assertSucceeds(deleteDoc(grant(root)));await assertFails(updateDoc(product(admin),{title:'No longer admin'}));
 await assertSucceeds(deleteDoc(product(author)));
 console.log('PASS: real Firestore emulator: legacy + language metadata, ownership, verified owner, delegated/revoked roles, reviews, private drafts, server-only translation/index/quota records.');
}finally{await env.cleanup();}
