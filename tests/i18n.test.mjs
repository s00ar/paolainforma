import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {formatMessage,localizedURL,languages} from '../i18n-core.js';
import {sourceInfo,translatedRecord,currentTranslation,tokens,canRead,activeSource} from '../functions/core.js';
test('catalogue parity, interpolation and plurals',async()=>{
 for(const lang of languages){const d=JSON.parse(await readFile(new URL('../locales/'+lang+'.json',import.meta.url),'utf8'));assert.ok(formatMessage(d,lang,'drivers.count',{count:1}));assert.match(formatMessage(d,lang,'drivers.count',{count:3}),/3/);assert.throws(()=>formatMessage(d,lang,'missing'));}
 assert.equal(localizedURL('https://example.test/it/noticias.html?post=1#x','es').href,'https://example.test/es/noticias.html?post=1#x');
});
test('one publication, cached translations, source invalidation and multilingual search terms',async()=>{
 const item={title:'Bicicletta usata',description:'Bicicletta in buone condizioni',sourceLanguage:'it',owner:'seller',price:'50'};
 const info=sourceInfo('webMarketOffers/same-id',item);let calls=0;
 const provider=async(fields,lang)=>{calls++;return {fields:{title:lang==='es'?'Bicicleta usada':'Used bicycle',description:lang==='es'?'Bicicleta en buen estado':'Bicycle in good condition'},detectedLanguage:'it'};};
 const cache=await translatedRecord(info,null,provider);assert.equal(calls,2);
 for(const word of ['bicicleta','bicicletta','bicycle'])assert.ok(cache.searchTokens.includes(word));
 assert.equal(currentTranslation(info,cache,'es').fields.title,'Bicicleta usada');
 await translatedRecord(info,cache,provider);assert.equal(calls,2);
 assert.equal(item.title,'Bicicletta usata');assert.equal(item.owner,'seller');
 const edited=sourceInfo('webMarketOffers/same-id',{...item,title:'Bicicletta nuova'});assert.equal(currentTranslation(edited,cache,'es'),null);
 assert.equal(sourceInfo('webMarketOffers/same-id',{...item,price:'60'}).sourceHash,info.sourceHash);
 await assert.rejects(()=>translatedRecord(edited,cache,()=>Promise.reject(new Error('offline'))));assert.equal(item.title,'Bicicletta usata');
});
test('legacy language is detected rather than assumed Spanish',async()=>{
 const info=sourceInfo('webMarketOffers/old',{title:'Bicicletta usata'});assert.equal(info.language,null);
 const record=await translatedRecord(info,null,async(fields)=>({fields,detectedLanguage:'it'}));assert.equal(record.detectedLanguage,'it');
});
test('private content and source-path boundaries',()=>{
 const google={token:{firebase:{sign_in_provider:'google.com'}}};
 assert.equal(canRead('webMarketOffers',{},null),false);assert.equal(canRead('webMarketOffers',{},google),true);
 assert.equal(canRead('webBlogPosts',{published:false},google),false);assert.equal(canRead('webBlogPosts',{published:false},google,true),true);
 assert.equal(canRead('webBlogPosts',{published:true},null),true);
 assert.equal(canRead('events',{},null),false);assert.equal(canRead('calendarEvents',{},null),false);assert.equal(canRead('events',{},google),true);
 assert.throws(()=>sourceInfo('webAdmins/owner',{}));assert.throws(()=>sourceInfo('webMarketOffers/a/secret/b',{}));assert.throws(()=>sourceInfo('webBlogPosts/a',{body:'x'.repeat(20001)}));
 assert.equal(activeSource('webMarketOffers',{expiresAt:1}),false);assert.deepEqual(tokens('Bicicléta bicicleta BICYCLE'),['bicicleta','bicycle']);
});
