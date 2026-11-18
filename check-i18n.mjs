import {readFile,readdir} from 'node:fs/promises';
import {languages} from './i18n-core.js';
const root=new URL('.',import.meta.url);
export const catalogs=Object.fromEntries(await Promise.all(languages.map(async l=>[l,JSON.parse(await readFile(new URL(`locales/${l}.json`,root),'utf8'))])));
const keys=Object.keys(catalogs.es).sort();
for(const l of languages){
 if(JSON.stringify(Object.keys(catalogs[l]).sort())!==JSON.stringify(keys))throw new Error('Different keys: '+l);
 for(const key of keys){
  const base=catalogs.es[key],value=catalogs[l][key];
  if(typeof base!==typeof value||!value)throw new Error('Invalid translation: '+l+':'+key);
  for(const part of typeof base==='string'?['']:Object.keys(base)){
   const a=part?base[part]:base,b=part?value[part]:value;
   if(typeof b!=='string'||!b.trim())throw new Error('Empty translation: '+l+':'+key);
   const tokens=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join(',');
   if(tokens(a)!==tokens(b))throw new Error('Interpolation mismatch: '+l+':'+key);
  }
 }
}
for(const folder of ['pages','shared','.'])for(const name of await readdir(new URL(folder+'/',root))){
 if(!/\.(html|js)$/.test(name)||folder==='.'&&!/\.js$/.test(name))continue;
 const text=await readFile(new URL(folder+'/'+name,root),'utf8');
 for(const match of text.matchAll(/\{\{([\w.-]+)\}\}|\bt\(['"]([\w.-]+)['"]/g))for(const l of languages){
  const key=match[1]||match[2];if(!(key in catalogs[l]))throw new Error(`${folder}/${name}: missing ${l}:${key}`);
 }
}
console.log(`i18n: ${keys.length} keys complete in ${languages.join(', ')}`);
