import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('.', import.meta.url);
const dist = new URL('./dist/', root);
const files = ['.htaccess', 'index.html', 'styles.css', 'rides.css', 'app.js', 'firebase-config.js', 'rides-settings.js', 'editorial.js', 'jobs.js', 'rentals.js', 'contactos.html', 'calendario.html', 'calendar.js', 'ripopola-calabria.html'];
const source = new Map(await Promise.all(files.map(async name => [name, await readFile(new URL(name, root), 'utf8')])));
// A release shares one immutable filename suffix, including transitive module imports.
// A cached HTML page can never combine old settings with new application modules.
const revision = createHash('sha256').update([...source].map(([name, text]) => name + '\n' + text).join('\n')).digest('hex').slice(0, 12);
const versioned = new Map(files.filter(name => /\.(js|css)$/.test(name)).map(name => [name, name.replace(/\.(js|css)$/, `.${revision}.$1`)]));
const rewrite = text => text.replace(/(['"])\.\/([\w-]+\.(?:js|css))(?:\?[^'"]*)?\1/g, (match, quote, name) => versioned.has(name) ? `${quote}./${versioned.get(name)}${quote}` : match);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(new URL('./assets/', root), new URL('./assets/', dist), { recursive: true });
for (const [name, text] of source) {
  await writeFile(new URL(name, dist), rewrite(text));
  if (versioned.has(name)) await writeFile(new URL(versioned.get(name), dist), rewrite(text));
}
console.log(`Salida estática lista en dist/ · versión ${revision}`);
