const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readCredential(fileName) {
  try {
    const raw = fs.readFileSync(path.join(ROOT, fileName), 'utf8');
    const value = raw.replace(/^\uFEFF/, '').trim();
    return value || null;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

const fortyguardKey = readCredential('heatapi.txt');
const geminiKey = readCredential('gemini.txt');

const credentials = {
  fortyguardAvailable: !!fortyguardKey,
  geminiAvailable: !!geminiKey,
  getFortyguardKey() {
    return this.fortyguardAvailable ? fortyguardKey : null;
  },
  getGeminiKey() {
    return this.geminiAvailable ? geminiKey : null;
  },
};

if (!credentials.fortyguardAvailable) {
  console.error('[THERMA] WARNING: heatapi.txt is missing or empty. FortyGuard heat intelligence will be unavailable.');
}
if (!credentials.geminiAvailable) {
  console.error('[THERMA] WARNING: gemini.txt is missing or empty. Zoe will run in local intelligence mode.');
}

module.exports = { credentials, ROOT };