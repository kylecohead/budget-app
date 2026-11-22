// Small helpers shared by the API.

export const now = () => Date.now();

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}

export function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomToken(bytes = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export const newId = () => randomToken(12);

export async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Invite codes like "K7QF-M2XP": no 0/O/1/I so they are easy to read out.
export function inviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return chars.slice(0, 4).join('') + '-' + chars.slice(4).join('');
}

export const CURRENCIES = [
  'ZAR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'NZD', 'JPY', 'CNY', 'HKD', 'SGD',
  'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'ILS', 'INR', 'MXN', 'BRL', 'KRW', 'THB',
  'TRY', 'MYR', 'IDR', 'PHP', 'ISK', 'RON', 'BGN',
];

export function cleanCurrency(value, fallback = null) {
  const c = String(value || '').trim().toUpperCase();
  return CURRENCIES.includes(c) ? c : fallback;
}

const SYMBOLS = [
  [/US\$/i, 'USD'],
  [/€/, 'EUR'],
  [/£/, 'GBP'],
  [/¥/, 'JPY'],
  [/\$/, 'USD'],
];

// Turns whatever the iPhone sends ("R45,00", "R 1 234,50", "$12.50", "ZAR 45.00", 45.5)
// into { minor: 4550, currency: 'ZAR' | null }. Returns null when there is no number.
export function parseAmount(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number' && Number.isFinite(input)) {
    return { minor: Math.round(input * 100), currency: null };
  }
  const s = String(input).trim();
  if (!s) return null;

  let currency = null;
  const code = s.toUpperCase().match(/\b([A-Z]{3})\b/);
  if (code && CURRENCIES.includes(code[1])) currency = code[1];
  if (!currency) {
    for (const [re, cur] of SYMBOLS) if (re.test(s)) { currency = cur; break; }
  }
  if (!currency && /(^|[^A-Za-z])R\s?[\d.,]/.test(s)) currency = 'ZAR';

  const firstDigit = s.search(/\d/);
  const before = firstDigit >= 0 ? s.slice(0, firstDigit) : '';
  const negative = /[-−–]/.test(before) || /^\(.*\)$/.test(s);
  const m = s.match(/\d[\d.,'\s  ]*\d|\d/);
  if (!m) return null;
  let num = m[0].replace(/[\s'  ]/g, '');

  const lastDot = num.lastIndexOf('.');
  const lastComma = num.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ',';
    const thou = dec === '.' ? ',' : '.';
    num = num.split(thou).join('').replace(dec, '.');
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const parts = num.split(sep);
    const tail = parts[parts.length - 1];
    if (parts.length === 2 && tail.length <= 2) num = parts.join('.');
    else num = parts.join('');
  }
  const value = Number(num);
  if (!Number.isFinite(value)) return null;
  const minor = Math.round(value * 100);
  return { minor: negative ? -minor : minor, currency };
}

// "WOOLWORTHS 1234 CAPE TOWN" and "Woolworths 0456 Cape Town" share a key.
export function merchantKey(name) {
  if (!name) return null;
  const key = String(name)
    .toLowerCase()
    .replace(/[0-9]/g, ' ')
    .replace(/[^\p{L}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ');
  return key || null;
}

export function cleanText(value, max = 200) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().slice(0, max);
  return s || null;
}

export function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const SYMBOL = { ZAR: 'R', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', NZD: 'NZ$', JPY: '¥', INR: '₹' };
const SPACE_GROUPED = ['ZAR', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'CHF'];

// 12000 → "R 120.00" (same style as the app)
export function formatMoney(minor, cur) {
  const abs = Math.abs(Math.round(minor || 0));
  const sep = SPACE_GROUPED.includes(cur) ? ' ' : ',';
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return (minor < 0 ? '−' : '') + (SYMBOL[cur] || cur) + ' ' + whole + '.' + String(abs % 100).padStart(2, '0');
}
