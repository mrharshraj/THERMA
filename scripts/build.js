// Production build for THERMA.
//
// The frontend in public/ is a no-bundle static app: the router loads screens
// through runtime dynamic imports with computed paths (import(`/screens/${file}.js`))
// and vendor/font assets are referenced by absolute runtime paths. No bundler can
// resolve those statically, so the production build is a verbatim copy of public/
// into dist/ — byte-identical to what server.js serves in development.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'public');
const out = path.join(root, 'dist');

if (!fs.existsSync(path.join(src, 'index.html'))) {
  console.error('[build] FAILED: public/index.html not found');
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });

if (!fs.existsSync(path.join(out, 'index.html'))) {
  console.error('[build] FAILED: dist/index.html missing after copy');
  process.exit(1);
}

console.log('[build] THERMA frontend: public/ -> dist/ (verbatim static build)');
console.log('[build] entry: dist/index.html OK');
