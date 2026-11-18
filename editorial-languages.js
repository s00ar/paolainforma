import {t,locale,languages,languageNames} from './i18n.js';
import {contentRequest} from './content-language.js';
export function editTranslations(collection,item){
 const dialog=document.createElement('dialog');dialog.className='editorial-dialog';
 const heading=document.createElement('h2');heading.textContent=t('editorial.translations')+' · '+item.title;
 const form=document.createElement('form');form.className='editorial-form';
 const label=document.createElement('label');label.textContent=t('nav.language');
 const language=document.createElement('select');for(const code of languages){const option=document.createElement('option');option.value=code;option.textContent=languageNames[code];language.append(option);}language.value=locale;label.append(language);
 const fields=collection==='webBlogPosts'?['title','summary','body']:['title','description'];
 const inputs={},originals={};
 for(const field of fields){const section=document.createElement('label'),original=document.createElement('p'),input=document.createElement('textarea');section.textContent=({title:t('ui.4c08a5d5fe'),summary:t('ui.ed7bdc67c8'),body:t('ui.b0d6ba2fe4'),description:t('ui.ee00b96fff')})[field];original.textContent=t('editorial.original')+': '+(item[field]||'');input.rows=field==='body'?8:3;input.maxLength=field==='body'?15000:3000;input.value='';inputs[field]=input;originals[field]=original;section.append(original,input);form.append(section);}
 const feedback=document.createElement('p');feedback.setAttribute('role','status');
 const load=document.createElement('button');load.type='button';load.className='outline';load.textContent=t('editorial.load');
 const save=document.createElement('button');save.type='submit';save.className='primary';save.textContent=t('editorial.save');save.disabled=true;
 const close=document.createElement('button');close.type='button';close.className='outline';close.textContent=t('ui.aeccae342e');close.onclick=()=>dialog.close();
 form.prepend(label,load);form.append(feedback,save,close);dialog.append(heading,form);document.body.append(dialog);
 let sourceHash,sequence=0,selectedLanguage=language.value;
 const fetchVersion=async()=>{const version=++sequence;save.disabled=true;feedback.textContent=t('common.loading');try{const result=await contentRequest({action:'get',path:collection+'/'+item.id,language:language.value});if(version!==sequence)return;sourceHash=result.sourceHash;for(const field of fields)originals[field].textContent=t('editorial.original')+': '+(result.originalFields?.[field]??item[field]??'');const translated=result.translation||result.previous;for(const field of fields)inputs[field].value=translated?.fields[field]||'';feedback.textContent=result.translation?t(result.translation.kind==='reviewed'?'content.reviewed':result.translation.kind==='original'?'editorial.original':'content.machine'):result.previous?t('editorial.stale'):t('content.fallback');save.disabled=false;}catch{feedback.textContent=t('editorial.service');}};
 load.onclick=fetchVersion;language.onchange=()=>{if(Object.values(inputs).some(i=>i.value)&&!confirm(t('form.unsaved'))){language.value=selectedLanguage;return;}selectedLanguage=language.value;fetchVersion();};
 form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{await contentRequest({action:'review',path:collection+'/'+item.id,language:language.value,sourceHash,fields:Object.fromEntries(fields.map(f=>[f,inputs[f].value.trim()]))});feedback.textContent=t('content.reviewed');}catch{feedback.textContent=t('content.error');}finally{save.disabled=false;}};
 dialog.addEventListener('close',()=>{sequence++;dialog.remove();});dialog.showModal();fetchVersion();
}
