const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const start = html.indexOf('    const enabledKeys=');
const end = html.indexOf('    const localizedDates=', start);
assert(start >= 0 && end > start, 'Settings initialization must exist');
const initialization = html.slice(start, end);

function language(navigator, saved = null) {
  return vm.runInNewContext(initialization + '\nsettings.language;', {
    navigator,
    languageOptions: { zh: '简体中文', en: 'English', fr: 'Français' },
    localStorage: { getItem: () => saved },
  });
}

for (const [locale, expected] of [
  ['zh-CN', 'zh'], ['zh-TW', 'zh'], ['en-US', 'en'],
  ['fr-FR', 'fr'], ['fr-CA', 'fr'], ['FR-ca', 'fr'],
  ['de-DE', 'en'], ['ja-JP', 'en'],
]) {
  assert.equal(language({ language: locale }), expected, locale);
}
assert.equal(language({ language: 'de-DE', languages: ['de-DE', 'fr-FR'] }), 'en');
assert.equal(language({ languages: ['fr-CA'] }), 'fr');
assert.equal(language({}), 'en');
assert.equal(language({ language: 'fr-FR' }, '{invalid'), 'fr');
assert.equal(language({ language: 'fr-FR' }, JSON.stringify({ language: 'de' })), 'fr');
assert.equal(language({ language: 'fr-FR' }, JSON.stringify({ language: 'zh' })), 'zh');
assert.equal(language({ language: 'zh-CN' }, JSON.stringify({ language: 'en' })), 'en');

// Compile every inline script to catch syntax errors in the page.
for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
  new vm.Script(match[1]);
}
assert.equal(fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8'), html);
console.log('Default language checks passed.');
