import {createHash} from 'node:crypto';
export const languages=['it','es','en'];
export const collections={webMarketOffers:['title','description'],webJobOffers:['title','description'],webRentalOffers:['title','description'],webPlannedTrips:[],webBlogPosts:['title','summary','body'],webCalendarEvents:['title','description'],events:['name','description'],calendarEvents:['title','description'],webDriverReviews:['text']};
export function sourceInfo(path,data){
 const parts=path.split('/'),collection=parts[0];
 if(!collections[collection]||!(parts.length===2&&collection!=='webDriverReviews'||parts.length===4&&collection==='webDriverReviews'&&parts[2]==='reviews')||parts.some(s=>!s||s.length>1500))throw new Error('invalid-argument');
 const fields=Object.fromEntries(collections[collection].map(k=>[k,String(data[k]??'')]));
 const text=Object.values(fields).join('\n');if(text.length>20000)throw new Error('invalid-argument');
 const language=languages.includes(data.sourceLanguage)?data.sourceLanguage:null;
 const searchContext=Object.fromEntries(['location','company','origin','destination'].filter(k=>typeof data[k]==='string').map(k=>[k,data[k]]));
 const sourceHash=createHash('sha256').update(JSON.stringify({fields,language,searchContext})).digest('hex');
 return {path,collection,fields,language,sourceHash,key:createHash('sha256').update(path).digest('hex'),text};
}
export function tokens(value){return [...new Set(value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().match(/[\p{L}\p{N}]{2,40}/gu)||[])].slice(0,1200);}
export function publicSource(collection,data){return collection==='webCalendarEvents'||collection==='webBlogPosts'&&data.published===true;}
export function activeSource(collection,data,now=Date.now()){
 return !(data.expiresAt&&data.expiresAt<=now||collection==='webPlannedTrips'&&data.departure<=now);
}
export function canRead(collection,data,auth,admin=false){
 if(publicSource(collection,data))return true;
 if(collection==='webBlogPosts')return admin;
 return auth?.token?.firebase?.sign_in_provider==='google.com';
}
export async function translatedRecord(info,previous,translate){
 if(previous?.sourceHash===info.sourceHash&&previous.status==='ready'&&languages.every(l=>previous.translations?.[l]))return previous;
 const translations={};let detected=info.language;
 for(const target of languages){
  if(previous?.sourceHash===info.sourceHash&&previous.translations?.[target]?.kind==='reviewed'){translations[target]=previous.translations[target];continue;}
  if(target===info.language||!info.text.trim()){translations[target]={fields:info.fields,kind:'original'};continue;}
  const result=await translate(info.fields,target,info.language);
  detected ||= result.detectedLanguage;
  translations[target]={fields:result.fields,kind:target===detected?'original':'automatic'};
 }
 return {sourceHash:info.sourceHash,sourcePath:info.path,collection:info.collection,detectedLanguage:detected||'und',status:'ready',translations,searchTokens:tokens([info.text,...Object.values(translations).flatMap(v=>Object.values(v.fields))].join(' '))};
}
export function currentTranslation(info,cache,target){return cache?.sourceHash===info.sourceHash&&cache.status==='ready'?cache.translations?.[target]:null;}
