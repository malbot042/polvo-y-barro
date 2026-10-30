// Genera dist/polvo-y-barro.html: el juego completo en un solo archivo HTML
// (CSS y JS en línea), útil para compartir o abrir sin servidor.
// Uso: node tools/build-single.mjs [--fragment]
//   --fragment  omite <html>/<head>/<body> (para incrustar en otra página)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const ORDER = ['util', 'config', 'tracks', 'track', 'car', 'audio', 'game', 'career', 'editor', 'main'];

const js = ORDER.map((m) => {
  const src = read(`js/${m}.js`)
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^export\s+(?=(const|let|function|class)\b)/gm, '');
  if (/^\s*(import|export)\b/m.test(src)) throw new Error(`Quedan import/export en ${m}.js`);
  return `// ---- ${m}.js ----\n${src}`;
}).join('\n');

const html = read('index.html');
const app = html.split('<!--app-->')[1].split('<!--/app-->')[0];
const head = html.match(/<title>[\s\S]*?<\/title>/)[0];
const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]+>/)[0];
const css = read('css/style.css');
const script = `<script>\n(() => {\n'use strict';\n${js}\n})();\n</script>`;

const fragment = process.argv.includes('--fragment');
const out = fragment
  ? `${head}\n<meta name="claude:viewport-fit-sides" content="cover">\n${fonts}\n<style>\n${css}\n</style>\n${app}\n${script}\n`
  : `<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n${fonts}\n<style>\n${css}\n</style>\n</head>\n<body>\n${app}\n${script}\n</body>\n</html>\n`;

mkdirSync(join(root, 'dist'), { recursive: true });
const file = join(root, 'dist', fragment ? 'polvo-y-barro.fragment.html' : 'polvo-y-barro.html');
writeFileSync(file, out);
console.log('Escrito', file, (out.length / 1024).toFixed(1) + ' KB');
