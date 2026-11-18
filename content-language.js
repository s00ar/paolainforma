import {t,locale,languages,languageNames} from './i18n.js';
import {translationServiceEnabled,translationRegion,languageMetadataEnabled} from './content-settings.js';
let callable,session=0,account;
export function setContentSession(user){account=user;session++;window.dispatchEvent(new Event('content-session'));}
export async function contentRequest(data){
 if(!translationServiceEnabled)throw new Error('not-enabled');
 if(!callable)callable=import('https://www.gstatic.com/firebasejs/12.3.0/firebase-functions.js').then(sdk=>sdk.httpsCallable(sdk.getFunctions(undefined,translationRegion),'languageContent'));
 return (await (await callable)(data)).data;
}
export function languageField(form,item){
 let select=form.elements.sourceLanguage;
 if(!select){
  const label=document.createElement('label');label.textContent=t('form.language');
  select=document.createElement('select');select.name='sourceLanguage';
  for(const lang of ['',...languages]){const option=document.createElement('option');option.value=lang;option.textContent=languageNames[lang]||t('form.unknown');select.append(option);}
  label.append(select);if(!languageMetadataEnabled){const note=document.createElement('small');note.textContent=t('form.languagePending');label.append(note);}form.querySelector('[type="submit"]').before(label);
 }
 select.value=item?(item.sourceLanguage||''):locale;
 // Keep old published rules compatible until the new rules have been deployed.
 select.disabled=!languageMetadataEnabled;
 return select;
}
export function languagePayload(form){return languageMetadataEnabled?{sourceLanguage:form.elements.sourceLanguage?.value||'und'}:{};}
export function attachTranslation(row,path,item,nodes,{editorial=false}={}){
 row.id ||= 'content-'+encodeURIComponent(path);
 queueMicrotask(()=>{if(location.hash==='#'+row.id&&row.isConnected){row.closest('details')?.setAttribute('open','');row.scrollIntoView();}});
 const original=Object.fromEntries(Object.entries(nodes).map(([k,n])=>[k,n.textContent]));
 for(const node of Object.values(nodes))node.lang=languages.includes(item.sourceLanguage)?item.sourceLanguage:'';
 const group=document.createElement('div');group.className='content-language';
 const info=document.createElement('small');info.textContent=t('content.source',{language:languageNames[item.sourceLanguage]||t('content.unknown')});
 const button=document.createElement('button');button.type='button';button.className='outline';button.textContent=t('content.translate');
 const feedback=document.createElement('p');feedback.setAttribute('role','status');
 group.append(info,button,feedback);row.append(group);
 let translated=false;const generation=session;
 const showOriginal=()=>{for(const [k,n] of Object.entries(nodes)){n.textContent=original[k];n.lang=item.sourceLanguage||'';}translated=false;button.textContent=t('content.translate');feedback.textContent='';};
 const load=async action=>{
  button.disabled=true;
  try{
   const result=await contentRequest({action,path,language:locale});
   if(session!==generation||!row.isConnected)return;
   info.textContent=t('content.source',{language:languageNames[result.sourceLanguage]||(result.sourceLanguage&&result.sourceLanguage!=='und'?new Intl.DisplayNames([locale],{type:'language'}).of(result.sourceLanguage):t('content.unknown'))});
   if(!result.translation){feedback.textContent=t(editorial?'content.fallback':'content.error');return;}
   for(const [k,n] of Object.entries(nodes)){n.textContent=result.translation.fields[k]??original[k];n.lang=locale;}
   translated=true;button.textContent=t('content.original');
   feedback.textContent=result.translation.kind==='original'?'':t(result.translation.kind==='reviewed'?'content.reviewed':'content.machine');
  }catch(error){if(session===generation&&row.isConnected)feedback.textContent=t(error.message==='not-enabled'?'content.unavailable':'content.error');}
  finally{button.disabled=false;}
 };
 button.onclick=()=>translated?showOriginal():load('translate');
 if(item.sourceLanguage===locale){button.hidden=true;}
 if(editorial&&item.sourceLanguage!==locale){feedback.textContent=t('content.fallback');if(translationServiceEnabled)queueMicrotask(()=>load('get'));}
}
const normalize=value=>String(value).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
export function createSearch(collection,container,rerender,existingInput){
 const form=document.createElement('form');form.className='content-search';form.setAttribute('role','search');
 const label=document.createElement('label');label.textContent=t('search.label');
 const input=existingInput||document.createElement('input');input.type='search';input.maxLength=120;
 const status=document.createElement('p');status.setAttribute('role','status');status.textContent=translationServiceEnabled?'':t('search.pending');
 if(!existingInput){label.append(input);form.append(label);container.before(form);form.onsubmit=e=>e.preventDefault();}
 container.before(status);
 let results=[],sequence=0,timer,readyQuery='';
 const changed=()=>{clearTimeout(timer);const id=++sequence;results=[];readyQuery='';rerender();timer=setTimeout(async()=>{
  const query=input.value.trim();if(!query||!account||!translationServiceEnabled)return;
  status.textContent=t('common.loading');
  try{const response=await contentRequest({action:'search',collection,query});if(id!==sequence)return;results=response.items;readyQuery=query;status.textContent=results.length>=50?t('search.more'):results.length?'':t('search.empty');rerender();}
  catch{if(id===sequence)status.textContent=t('search.error');}
 },350);};
 input.addEventListener('input',changed);
 window.addEventListener('content-session',()=>{sequence++;results=[];readyQuery='';rerender();});
 return {filter(entries){const q=normalize(input.value.trim());if(!q)return entries;const local=entries.filter(e=>normalize([e.title,e.description,e.location,e.company,e.origin,e.destination].filter(Boolean).join(' ')).includes(q));const merged=new Map(local.map(e=>[e.id,e]));if(readyQuery===input.value.trim())for(const e of results)merged.set(e.id,e);return [...merged.values()];}};
}
