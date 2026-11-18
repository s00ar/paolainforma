import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {GoogleAuth} from 'google-auth-library';
import {createHash} from 'node:crypto';
import {collections,languages,sourceInfo,tokens,canRead,publicSource,activeSource,translatedRecord,currentTranslation} from './core.js';
initializeApp();const db=getFirestore();
const options={region:'europe-west1',maxInstances:2,concurrency:4,timeoutSeconds:120};
const google=new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-translation']});
const enabled=()=>process.env.TRANSLATION_ENABLED==='true';
const ownerEmail='leston.s.h@gmail.com';
async function isAdmin(auth){return Boolean(auth?.token?.email_verified&&auth.token.firebase?.sign_in_provider==='google.com'&&(auth.token.email?.toLowerCase()===ownerEmail||(await db.doc('webAdmins/'+auth.token.email.toLowerCase()).get()).exists));}
async function consume(key,amount,maximum,period){
 const bucket=Math.floor(Date.now()/period),ref=db.doc('webTranslationLimits/'+key+'-'+bucket);
 await db.runTransaction(async tx=>{const old=await tx.get(ref),used=old.data()?.used||0;if(used+amount>maximum)throw new HttpsError('resource-exhausted','Quota reached');tx.set(ref,{used:used+amount,expiresAt:new Date((bucket+2)*period)});});
}
async function provider(fields,target,source){
 const keys=Object.keys(fields).filter(k=>fields[k].trim()),contents=keys.map(k=>fields[k]);
 if(!keys.length)return {fields,detectedLanguage:source||'und'};
 // Global reserved character budget is charged BEFORE the provider call, including failures.
 const configured=Number(process.env.TRANSLATION_DAILY_CHARACTERS||10000);
 const budget=Number.isFinite(configured)&&configured>0?Math.min(Math.floor(configured),500000):10000;
 await consume('characters',contents.join('').length,budget,86400000);
 const client=await google.getClient();
 const {data}=await client.request({url:`https://translation.googleapis.com/v3/projects/${process.env.GCLOUD_PROJECT}/locations/global:translateText`,method:'POST',timeout:25000,retry:false,data:{contents,mimeType:'text/plain',targetLanguageCode:target,...(source?{sourceLanguageCode:source}:{})}});
 if(!Array.isArray(data.translations)||data.translations.length!==keys.length)throw new Error('provider-response');
 return {fields:{...fields,...Object.fromEntries(keys.map((k,i)=>[k,data.translations[i].translatedText]))},detectedLanguage:data.translations[0]?.detectedLanguageCode||source};
}
async function source(path){
 if(typeof path!=='string')throw new HttpsError('invalid-argument','Invalid path');
 sourceInfo(path,{});
 const snap=await db.doc(path).get();if(!snap.exists)throw new HttpsError('not-found','Not found');
 if(path.startsWith('webDriverReviews/')&&!(await db.doc('webDriverProfiles/'+path.split('/')[1]).get()).exists)throw new HttpsError('not-found','Not found');
 return {snap,info:sourceInfo(path,snap.data())};
}
async function processSource(path){
 const infoKey=sourceInfo(path,{}).key,ref=db.doc('webTranslations/'+infoKey);
 const snap=await db.doc(path).get();
 if(!snap.exists){await ref.delete();return;}
 const info=sourceInfo(path,snap.data());
 // Never translate unpublished drafts automatically; no private text sent to the provider.
 if(!activeSource(info.collection,snap.data())||info.collection==='webDriverReviews'&&!(await db.doc('webDriverProfiles/'+path.split('/')[1]).get()).exists){await ref.delete();return;}
 if(info.collection==='webBlogPosts'&&!snap.data().published){
  await db.runTransaction(async tx=>{const old=await tx.get(ref);if(old.exists&&old.data().sourceHash!==info.sourceHash)tx.set(ref,{sourcePath:path,collection:info.collection,sourceHash:info.sourceHash,status:'stale',translations:{},previousTranslations:old.data().translations||old.data().previousTranslations||{},searchTokens:[]});});
  return;
 }
 if(!enabled())return;
 const claimed=await db.runTransaction(async tx=>{
  const old=(await tx.get(ref)).data();
  if(old?.sourceHash===info.sourceHash&&(old.status==='ready'&&languages.every(l=>old.translations?.[l])||old.leaseUntil>Date.now()))return false;
  tx.set(ref,{sourcePath:path,collection:info.collection,sourceHash:info.sourceHash,status:'pending',leaseUntil:Date.now()+150000,searchTokens:[],translations:old?.sourceHash===info.sourceHash?old.translations||{}:{},previousTranslations:old?.sourceHash!==info.sourceHash?old?.translations||{}:old?.previousTranslations||{}});
  return true;
 });
 if(!claimed)return;
 try{
  const value=await translatedRecord(info,(await ref.get()).data(),provider);
  // A trigger can finish out of order; commit only against the current source version.
  await db.runTransaction(async tx=>{
   const live=await tx.get(db.doc(path)),cache=await tx.get(ref);
   if(!live.exists||sourceInfo(path,live.data()).sourceHash!==info.sourceHash||cache.data()?.sourceHash!==info.sourceHash)return;
   if(!activeSource(info.collection,live.data())||info.collection==='webBlogPosts'&&!live.data().published){tx.delete(ref);return;}
   const extra=[live.data().location,live.data().company,live.data().origin,live.data().destination].filter(Boolean).join(' ');
   for(const [lang,entry] of Object.entries(cache.data()?.translations||{}))if(entry.kind==='reviewed')value.translations[lang]=entry;
   value.searchTokens=tokens([info.text,...Object.values(value.translations).flatMap(v=>Object.values(v.fields))].join(' '));
   tx.set(ref,{...value,searchTokens:[...new Set([...value.searchTokens,...tokens(extra)])],leaseUntil:0,updatedAt:Date.now(),previousTranslations:cache.data()?.previousTranslations||{}});
  });
 }catch(error){
  await db.runTransaction(async tx=>{const current=await tx.get(ref);if(current.data()?.sourceHash===info.sourceHash)tx.update(ref,{status:'error',leaseUntil:0,retryAt:Date.now()+3600000});});
  console.warn('Translation failed',error.code||'provider-error');
 }
}
const watch=collection=>onDocumentWritten({...options,document:collection+'/{id}'},e=>processSource(collection+'/'+e.params.id));
export const marketChanged=watch('webMarketOffers');
export const jobsChanged=watch('webJobOffers');
export const rentalsChanged=watch('webRentalOffers');
export const tripsChanged=watch('webPlannedTrips');
export const blogsChanged=watch('webBlogPosts');
export const eventsChanged=watch('webCalendarEvents');
export const mobileEventsChanged=watch('events');
export const mobileCalendarChanged=watch('calendarEvents');
export const driverRemoved=onDocumentWritten({...options,document:'webDriverProfiles/{id}'},async e=>{
 if(!e.data.after.exists)await db.recursiveDelete(db.doc('webDriverReviews/'+e.params.id));
});
export const reviewChanged=onDocumentWritten({...options,document:'webDriverReviews/{driver}/reviews/{author}'},e=>processSource(`webDriverReviews/${e.params.driver}/reviews/${e.params.author}`));
export const retryTranslations=onSchedule({...options,schedule:'every 60 minutes'},async()=>{
 if(!enabled())return;
 const rows=await db.collection('webTranslations').where('status','in',['error','pending']).limit(20).get();
 for(const doc of rows.docs)if((doc.data().retryAt||0)<Date.now()&&(doc.data().leaseUntil||0)<Date.now())await processSource(doc.data().sourcePath);
});
export const languageContent=onCall({...options,cors:['https://paolainforma.pixvo.tech',/^http:\/\/localhost(:\d+)?$/]},async request=>{
 const data=request.data||{},auth=request.auth,admin=await isAdmin(auth);
 if(!auth&&data.action!=='get')throw new HttpsError('unauthenticated','Sign in');
 const requester=createHash('sha256').update(auth?.uid||request.rawRequest.ip||'anonymous').digest('hex');
 await consume('requests-'+requester,1,60,60000);
 if(data.action==='search'){
  if(!enabled())throw new HttpsError('unavailable','Not enabled');
  if(auth?.token?.firebase?.sign_in_provider!=='google.com'||!['webMarketOffers','webJobOffers','webRentalOffers','webPlannedTrips'].includes(data.collection))throw new HttpsError('permission-denied','Not permitted');
  if(typeof data.query!=='string'||data.query.length>120)throw new HttpsError('invalid-argument','Invalid query');
  const terms=tokens(data.query);if(!terms.length)return {items:[]};
  const rows=await db.collection('webTranslations').where('collection','==',data.collection).where('searchTokens','array-contains',terms[0]).limit(100).get();
  const items=[];
  for(const row of rows.docs){const cache=row.data();if(!terms.every(t=>cache.searchTokens.includes(t)))continue;try{const {snap,info}=await source(cache.sourcePath);if(cache.sourceHash===info.sourceHash&&activeSource(info.collection,snap.data())&&canRead(info.collection,snap.data(),auth,admin))items.push({...snap.data(),id:snap.id});}catch{}}
  return {items:items.slice(0,50)};
 }
 if(data.action==='backfill'){
  if(!admin||!enabled())throw new HttpsError('permission-denied','Not permitted');
  if(!collections[data.collection])throw new HttpsError('invalid-argument','Invalid collection');
  const reviews=data.collection==='webDriverReviews';
  let query=(reviews?db.collectionGroup('reviews'):db.collection(data.collection)).orderBy('__name__').limit(20);
  if(typeof data.after==='string'&&data.after)query=query.startAfter(reviews?db.doc(data.after):data.after);
  const docs=await query.get();for(const doc of docs.docs)if(!reviews||doc.ref.path.startsWith('webDriverReviews/'))await processSource(doc.ref.path);
  return {after:reviews?docs.docs.at(-1)?.ref.path||null:docs.docs.at(-1)?.id||null,count:docs.size};
 }
 let current;try{current=await source(data.path);}catch(error){throw error instanceof HttpsError?error:new HttpsError('invalid-argument','Invalid content');}
 const {snap,info}=current;
 if(!canRead(info.collection,snap.data(),auth,admin))throw new HttpsError('permission-denied','Not permitted');
 if(!languages.includes(data.language))throw new HttpsError('invalid-argument','Invalid language');
 const ref=db.doc('webTranslations/'+info.key);
 if(data.action==='review'){
  if(!admin||!['webBlogPosts','webCalendarEvents'].includes(info.collection))throw new HttpsError('permission-denied','Not permitted');
  if(data.sourceHash!==info.sourceHash)throw new HttpsError('aborted','Source changed');
  const fields=data.fields;
  if(!fields||JSON.stringify(Object.keys(fields).sort())!==JSON.stringify(Object.keys(info.fields).sort())||Object.values(fields).some(v=>typeof v!=='string'||v.length>20000)||Object.values(fields).join('').length>20000)throw new HttpsError('invalid-argument','Invalid fields');
  await db.runTransaction(async tx=>{const live=await tx.get(snap.ref),old=await tx.get(ref);if(!live.exists||sourceInfo(data.path,live.data()).sourceHash!==info.sourceHash)throw new HttpsError('aborted','Source changed');const cache=old.data()?.sourceHash===info.sourceHash?old.data():{};tx.set(ref,{...cache,sourcePath:data.path,collection:info.collection,sourceHash:info.sourceHash,status:'ready',translations:{...cache.translations,[data.language]:{fields,kind:'reviewed'}},searchTokens:[],updatedAt:Date.now()});});
 }else if(data.action==='translate'){
  if(!enabled())throw new HttpsError('unavailable','Not enabled');
  if(!auth)throw new HttpsError('unauthenticated','Sign in');
  await processSource(data.path);
 }else if(data.action!=='get')throw new HttpsError('invalid-argument','Invalid action');
 const cache=(await ref.get()).data();
 // Recheck after all asynchronous work to prevent exposing a deleted or newly private post.
 const live=await source(data.path);
 if(!canRead(live.info.collection,live.snap.data(),auth,admin))throw new HttpsError('permission-denied','Not permitted');
 const translation=currentTranslation(live.info,cache,data.language);
 return {sourceHash:live.info.sourceHash,sourceLanguage:live.info.language||(cache?.sourceHash===live.info.sourceHash?cache?.detectedLanguage:null)||'und',translation:translation||null,status:translation?'ready':cache&&cache.sourceHash!==live.info.sourceHash?'stale':cache?.status||'missing',...(admin?{originalFields:live.info.fields,previous:(cache?.sourceHash!==live.info.sourceHash?cache?.translations?.[data.language]:cache?.previousTranslations?.[data.language])||null}: {})};
});
