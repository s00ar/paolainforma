import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {catalogs} from './check-i18n.mjs';
import {languages,languageNames,formatMessage} from './i18n-core.js';
const root=new URL('.',import.meta.url),read=name=>readFile(new URL(name,root),'utf8');
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const routes={noticias:'noticias.html',agenda:'calendario.html',mapa:'mapa.html',viajes:'viajes.html',tienda:'tienda.html',trabajo:'trabajo.html',alquileres:'alquileres.html',politicas:'politicas.html',inicio:'index.html','san-martino-2026':'noticias.html#san-martino-2026','conductores-activos':'viajes.html#conductores-activos'};
const definitions=[['index','Inicio','inicio'],['noticias','Noticias','noticias'],['calendario','Agenda','calendario'],['mapa','Mapa','mapa'],['viajes','Viajes compartidos','viajes'],['tienda','Tienda','tienda'],['trabajo','Trabajo','trabajo'],['alquileres','Alquileres','alquileres'],['contactos','Contactos útiles','contactos'],['politicas','Políticas y condiciones','politicas'],['ripopola-calabria','Ripopola Calabria','ripopola-calabria']];
const [header,footer,icons,account]=await Promise.all(['header','footer','icons','account'].map(n=>read('shared/'+n+'.html')));
const base='https://paolainforma.pixvo.tech';
const titleKey=title=>title==='Inicio'?'nav.home':Object.keys(catalogs.es).find(k=>catalogs.es[k]===title);
for(const lang of languages){
 await mkdir(new URL(lang+'/',root),{recursive:true});
 const t=(k,v)=>formatMessage(catalogs[lang],lang,k,v);
 const render=html=>html.replace(/\{\{([\w.-]+)\}\}/g,(_,k)=>escape(t(k))).replace(/href="(?:\.\/)?#([\w-]+)"/g,(all,id)=>routes[id]?`href="./${routes[id]}"`:all).replaceAll('./assets/','/assets/');
 for(const [file,title,content] of definitions){
  let body=render(await read('pages/'+content+'.html'));
  const translatedTitle=t(titleKey(title));
  if(file!=='index'&&!/<h1\b/.test(body))body=`<div class="page-heading"><a href="./">${t('nav.home')}</a><span aria-hidden="true"> / </span><span>${translatedTitle}</span><h1>${translatedTitle}</h1></div>`+body;
  let dialogs='';try{dialogs=render(await read('pages/'+content+'-dialogs.html'));}catch(error){if(error.code!=='ENOENT')throw error;}
  let nav=render(header).replace('href="./'+file+'.html"','href="./'+file+'.html" aria-current="page"');
  if(file==='ripopola-calabria')nav=nav.replace('href="./noticias.html"','href="./noticias.html" aria-current="page"');
  const selector=`<nav class="language-selector" aria-label="${t('nav.language')}">${languages.map(l=>`<a href="/${l}/${file==='index'?'':file+'.html'}" data-language="${l}" lang="${l}" hreflang="${l}" ${lang===l?'aria-current="true"':''}>${languageNames[l]}</a>`).join('')}</nav>`;
  const path=file==='index'?'':file+'.html';
  const alternates=languages.map(l=>`<link rel="alternate" hreflang="${l}" href="${base}/${l}/${path}">`).join('');
  const html=`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#1D70B8"><title>${file==='index'?'Paola y alrededores informa':translatedTitle+' · Paola y alrededores informa'}</title><meta name="description" content="${escape(t('meta.description'))}"><meta property="og:site_name" content="Paola y alrededores informa"><meta property="og:image" content="${base}/assets/og-image.png"><link rel="canonical" href="${base}/${lang}/${path}">${alternates}<link rel="alternate" hreflang="x-default" href="${base}/it/${path}"><link rel="icon" href="/assets/favicon.ico">${['styles','rides','pages'].map(n=>`<link rel="stylesheet" href="/${n}.css?v=20261118-i18n">`).join('')}</head><body class="site-page page-${file}"><a class="skip-link" href="#contenido">${t('nav.skip')}</a>${icons}${nav}${selector}<main id="contenido" tabindex="-1">${body}</main>${render(footer)}${render(account)}${dialogs}<script id="locale-messages" type="application/json">${JSON.stringify(catalogs[lang]).replaceAll('<','\\u003c')}</script><script type="module" src="/app.js?v=20261118-i18n"></script>${file==='calendario'?'<script type="module" src="/calendar.js?v=20261118-i18n"></script>':''}</body></html>`;
  await writeFile(new URL(`${lang}/${file}.html`,root),html);
 }
}
for(const [file] of definitions){
 const path=file==='index'?'':file+'.html';
 const script=file==='index'?`let language='it';try{language=localStorage.getItem('paola-language')||'it';}catch{}if(!['it','es','en'].includes(language))language='it';const routes=${JSON.stringify(routes)};const old=routes[location.hash.slice(1)];const target=new URL(old?'/es/'+old:'/'+language+'/',location.origin);target.search=location.search;if(!old)target.hash=location.hash;location.replace(target.href);`:`location.replace('/es/${path}'+location.search+location.hash);`;
 await writeFile(new URL(file+'.html',root),`<!doctype html><html lang="${file==='index'?'it':'es'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Paola y alrededores informa</title><link rel="canonical" href="${base}/${file==='index'?'it':'es'}/${path}"><script>${script}</script></head><body><a href="/${file==='index'?'it':'es'}/${path}">Italiano · Español · English →</a></body></html>`);
}
await writeFile(new URL('sitemap.xml',root),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+languages.flatMap(l=>definitions.map(([f])=>`<url><loc>${base}/${l}/${f==='index'?'':f+'.html'}</loc></url>`)).join('')+'</urlset>');
console.log('Generated 33 localized pages and 11 compatibility pages in repository root.');
