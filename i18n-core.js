export const languages = ['it', 'es', 'en'];
export const languageNames = {it:'Italiano',es:'Español',en:'English'};
export function formatMessage(dictionary, language, key, values = {}) {
  let message = dictionary[key];
  if (message === undefined) throw new Error(`Missing translation: ${language}:${key}`);
  if (typeof message === 'object') message = message[new Intl.PluralRules(language).select(values.count)] ?? message.other;
  return message.replace(/\{(\w+)\}/g, (_, name) => {
    if (!(name in values)) throw new Error(`Missing interpolation: ${key}:${name}`);
    return typeof values[name]==='number'?new Intl.NumberFormat(language).format(values[name]):String(values[name]);
  });
}
export function localizedURL(url, language) {
  if (!languages.includes(language)) throw new Error('Unsupported locale');
  const result = new URL(url);
  result.pathname = '/' + language + '/' + result.pathname.replace(/^\/(it|es|en)\//,'').replace(/^\//,'');
  return result;
}
