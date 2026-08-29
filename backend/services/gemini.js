const { credentials } = require('../config');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const TIMEOUT_MS = 90000;

class GeminiError extends Error {
  constructor(message, kind = 'gemini_unavailable') {
    super(message);
    this.name = 'GeminiError';
    this.kind = kind;
  }
}

function geminiConfigured() {
  return credentials.geminiAvailable;
}

async function generateStructured({ systemInstruction, contents, responseSchema, temperature = 0.3 }) {
  if (!geminiConfigured()) {
    throw new GeminiError('Gemini credential is not available.', 'gemini_credential_missing');
  }
  const key = credentials.getGeminiKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const payload = {
    contents: Array.isArray(contents)
      ? contents
      : [{ role: 'user', parts: [{ text: contents }] }],
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
      responseSchema: responseSchema || {
        type: 'OBJECT',
        properties: {
          message: { type: 'STRING' },
          intent: { type: 'STRING' },
          actions: { type: 'ARRAY', items: { type: 'OBJECT' } },
          visualization: {
            type: 'OBJECT',
            properties: {
              type: { type: 'STRING' },
              config: { type: 'OBJECT' },
            },
          },
        },
        required: ['message'],
      },
    },
  };
  if (systemInstruction) payload.systemInstruction = { parts: [{ text: systemInstruction }] };

  try {
    const res = await fetch(`${GEMINI_URL}/models/${MODEL}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (res.status === 429) {
      throw new GeminiError('Gemini rate limit reached. Please try again shortly.', 'rate_limit');
    }
    if (!res.ok) {
      const text = await res.text();
      throw new GeminiError(`Gemini API error (HTTP ${res.status}).`, 'api_error');
    }
    const data = await res.json();
    const text = data && data.candidates && data.candidates[0] && data.candidates[0].content
      && data.candidates[0].content.parts
      ? data.candidates[0].content.parts.map((p) => p.text || '').join('')
      : null;
    if (!text) {
      const block = data && data.promptFeedback && data.promptFeedback.blockReason;
      throw new GeminiError(block ? `Gemini blocked the request (${block}).` : 'Gemini returned an empty response.', 'empty_response');
    }
    try {
      return JSON.parse(text.replace(/```json|```/g, ''));
    } catch {
      throw new GeminiError('Gemini returned malformed JSON.', 'malformed_output');
    }
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new GeminiError('Gemini request timed out.', 'timeout');
    }
    if (err instanceof GeminiError) throw err;
    throw new GeminiError('Could not reach Gemini API.', 'network');
  } finally {
    clearTimeout(timer);
  }
}

async function generateText({ systemInstruction, contents, temperature = 0.3 }) {
  if (!geminiConfigured()) {
    throw new GeminiError('Gemini credential is not available.', 'gemini_credential_missing');
  }
  const key = credentials.getGeminiKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const payload = {
    contents: Array.isArray(contents) ? contents : [{ role: 'user', parts: [{ text: contents }] }],
    generationConfig: { temperature, responseMimeType: 'text/plain' },
  };
  if (systemInstruction) payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  try {
    const res = await fetch(`${GEMINI_URL}/models/${MODEL}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) throw new GeminiError(`Gemini API error (HTTP ${res.status}).`, 'api_error');
    const data = await res.json();
    const text = data && data.candidates && data.candidates[0] && data.candidates[0].content
      ? data.candidates[0].content.parts.map((p) => p.text || '').join('') : null;
    if (!text) throw new GeminiError('Gemini returned an empty response.', 'empty_response');
    return text;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new GeminiError('Gemini request timed out.', 'timeout');
    if (err instanceof GeminiError) throw err;
    throw new GeminiError('Could not reach Gemini API.', 'network');
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { generateStructured, generateText, geminiConfigured, GeminiError };