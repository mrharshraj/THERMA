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

// Credentials resolve from the environment first (Render/CI), with the local
// credential files kept as the fallback for development.
const fortyguardKey = process.env.FORTYGUARD_API_KEY || readCredential('heatapi.txt');
const geminiKey = process.env.GEMINI_API_KEY || readCredential('gemini.txt');

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
  console.error('[THERMA] WARNING: No FortyGuard key (FORTYGUARD_API_KEY or heatapi.txt missing/empty). FortyGuard heat intelligence will be unavailable.');
}
if (!credentials.geminiAvailable) {
  console.error('[THERMA] WARNING: No Gemini key (GEMINI_API_KEY or gemini.txt missing/empty). Zoe will run in local intelligence mode.');
}

module.exports = { credentials, ROOT };