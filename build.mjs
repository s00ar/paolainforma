import { cp, mkdir, rm } from 'node:fs/promises';
const root = new URL('.', import.meta.url);
const dist = new URL('./dist/', root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(new URL('./assets/', root), new URL('./assets/', dist), { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'firebase-config.js', 'rides-settings.js', 'editorial.js', 'calendario.html', 'calendar.js', 'ripopola-calabria.html']) {
  await cp(new URL(`./${file}`, root), new URL(`./${file}`, dist));
}
console.log('Salida estática lista en dist/');
