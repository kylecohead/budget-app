/* Budget — web app. No framework, no build step: this file is the whole app. */
'use strict';

const CONFIG = window.BUDGET_CONFIG || {};
const API = String(CONFIG.api || '').replace(/\/$/, '');
const APP_URL = location.origin + location.pathname.replace(/index\.html$/, '');

// ---------------------------------------------------------------- helpers

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const local = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

const ICON = {
  cart: '<path d="M3 4h2.2l2.3 10.3a1.6 1.6 0 0 0 1.6 1.2h8a1.6 1.6 0 0 0 1.5-1.1L20.5 8H6.1"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
  dining: '<path d="M6 3v6a2.5 2.5 0 0 0 5 0V3M8.5 11.5V21"/><path d="M18 21V3c-2.2 1.4-3.3 4-3.3 7.3V14H18"/>',
  social: '<path d="M4 4h16l-8 9z"/><path d="M12 13v7M8 20h8"/>',
  fitness: '<path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/>',
  toiletries: '<path d="M8.5 10h7v10a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 8.5 20z"/><path d="M11 10V7h2v3M10 7h4M12 7V4h3"/>',
  transport: '<path d="M5 17h14M4 17v-4.5l1.9-5A2 2 0 0 1 7.8 6h8.4a2 2 0 0 1 1.9 1.5l1.9 5V17"/><path d="M4 12.5h16"/><path d="M6.5 17v2.5M17.5 17v2.5"/>',
  clothing: '<path d="M8 3.5 4 6l1.8 4L8 9v11.5h8V9l2.2 1L20 6l-4-2.5a4 4 0 0 1-8 0z"/>',
  gift: '<path d="M4 9.5h16v3H4zM5.5 12.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-7.5M12 9.5V21"/><path d="M12 9.5c-1.5-3.5-5.5-4-5.5-1.5S10 9.5 12 9.5zM12 9.5c1.5-3.5 5.5-4 5.5-1.5S14 9.5 12 9.5z"/>',
  health: '<path d="M12 20s-7.5-4.3-7.5-10A4.2 4.2 0 0 1 12 7.4 4.2 4.2 0 0 1 19.5 10c0 5.7-7.5 10-7.5 10z"/>',
  home: '<path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  bills: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  travel: '<path d="M4 8h16v11H4z"/><path d="M9 8V5.5h6V8M4 13h16"/>',
  fun: '<path d="M12 4l2.4 5 5.6.7-4.1 3.8 1 5.5L12 16.4 7.1 19l1-5.5L4 9.7l5.6-.7z"/>',
  kids: '<circle cx="12" cy="12" r="8"/><path d="M9 14.5c1.6 1.4 4.4 1.4 6 0M9.5 10h.01M14.5 10h.01"/>',
  pets: '<circle cx="7" cy="10.5" r="1.6"/><circle cx="17" cy="10.5" r="1.6"/><circle cx="10" cy="6.5" r="1.6"/><circle cx="14" cy="6.5" r="1.6"/><path d="M8 17c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5c0 1.5-1.2 2.5-2.5 2.5-.6 0-1-.3-1.5-.3s-.9.3-1.5.3C9.2 19.5 8 18.5 8 17z"/>',
  education: '<path d="M4 5.5c3-1 5.5-.5 8 1.5 2.5-2 5-2.5 8-1.5V19c-3-1-5.5-.5-8 1.5-2.5-2-5-2.5-8-1.5z"/><path d="M12 7v13.5"/>',
  salary: '<path d="M3 7h18v10H3z"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/>',
  paidback: '<path d="M9 14 5 10l4-4"/><path d="M5 10h9a5 5 0 0 1 0 10h-2"/>',
  other: '<path d="M6 12h.01M12 12h.01M18 12h.01" style="stroke-width:3"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  overview: '<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
  activity: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" style="stroke-width:2.6"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  transfer: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  question: '<path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14M12 17.5h.01"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h9"/>',
  face: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 15.5c1.4 1 3.6 1 5 0"/>',
};
const CATEGORY_ICONS = ['cart', 'dining', 'social', 'fitness', 'toiletries', 'transport', 'clothing', 'gift', 'health',
  'home', 'bills', 'travel', 'fun', 'kids', 'pets', 'education', 'salary', 'paidback', 'other'];
const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name] || ICON.other}</svg>`;

const CURRENCIES = ['ZAR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'NZD', 'JPY', 'CNY', 'HKD', 'SGD', 'SEK', 'NOK',
  'DKK', 'PLN', 'CZK', 'HUF', 'ILS', 'INR', 'MXN', 'BRL', 'KRW', 'THB', 'TRY', 'MYR', 'IDR', 'PHP', 'ISK', 'RON', 'BGN'];
const SYMBOL = { ZAR: 'R', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', NZD: 'NZ$', JPY: '¥', CNY: '¥', HKD: 'HK$', SGD: 'S$', INR: '₹' };
const SPACE_GROUPED = ['ZAR', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'CHF'];

// 1328050 → "R 13 280.50"; whole amounts drop the cents unless asked.
function money(minor, cur, { cents = 'auto', sign = false } = {}) {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return '—';
  const neg = minor < 0;
  const abs = Math.abs(Math.round(minor));
  const showCents = cents === true || (cents === 'auto' && abs % 100 !== 0);
  const whole = showCents ? Math.floor(abs / 100) : Math.round(abs / 100);
  const sep = SPACE_GROUPED.includes(cur) ? ' ' : ',';
  let s = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  if (showCents) s += '.' + String(abs % 100).padStart(2, '0');
  const sym = SYMBOL[cur] ?? cur;
  return (neg ? '−' : sign ? '+' : '') + sym + '\u00a0' + s; // same gap after every symbol: R 412, $ 38.20
}

function parseMoney(input) {
  let s = String(input ?? '').trim();
  const neg = /^[-−]/.test(s);
  s = s.replace(/[^\d.,]/g, '');
  if (!s) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ',';
    s = s.split(dec === '.' ? ',' : '.').join('').replace(dec, '.');
  } else if (lastComma >= 0) {
    const p = s.split(',');
    s = p.length === 2 && p[1].length <= 2 ? p.join('.') : p.join('');
  } else if (lastDot >= 0) {
    const p = s.split('.');
    s = p.length === 2 ? p.join('.') : p.join('');
  }
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  return Math.round(v * 100) * (neg ? -1 : 1);
}
const minorToInput = (m) => (m === null || m === undefined ? '' : (m % 100 === 0 ? String(m / 100) : (m / 100).toFixed(2)));

// ---------------------------------------------------------------- dates

const ymKey = ({ y, m }) => `${y}-${m}`;
const addMonths = ({ y, m }, n) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; };
const monthStart = ({ y, m }) => new Date(y, m, 1).getTime();
const nowYM = () => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; };
const sameYM = (a, b) => a.y === b.y && a.m === b.m;
const monthLabel = ({ y, m }) => new Date(y, m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const monthShort = ({ y, m }) => new Date(y, m, 1).toLocaleDateString('en-GB', { month: 'long' });
const daysIn = ({ y, m }) => new Date(y, m + 1, 0).getDate();
const time = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
function dayLabel(ms) {
  const d = new Date(ms); const today = new Date();
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
const toLocalInput = (ms) => { const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

// ---------------------------------------------------------------- state

const S = {
  token: local.get('b.token'),
  boot: local.get('b.boot'),
  ym: nowYM(),
  account: 'total',
  cur: null,
  months: {},
  filter: { kind: 'all', category: null },
  key: null,
  offline: false,
  edit: null,
  review: null,
  loading: false,
  onboarding: local.get('b.onboarding', false),
};

const user = () => S.boot?.user || {};
const accounts = (all = false) => (S.boot?.accounts || []).filter((a) => all || !a.archived);
const accountById = (id) => (S.boot?.accounts || []).find((a) => a.id === id);
const categories = (kind) => (S.boot?.categories || []).filter((c) => !c.archived && (!kind || c.kind === kind)).sort((a, b) => a.sort - b.sort);
const categoryById = (id) => (S.boot?.categories || []).find((c) => c.id === id);
const txList = (ym) => S.months[ymKey(ym)] || local.get('b.tx.' + ymKey(ym)) || null;

function viewCurrency() {
  if (S.account !== 'total') return accountById(S.account)?.currency || user().display_currency || 'ZAR';
  return S.cur || user().display_currency || accounts()[0]?.currency || 'ZAR';
}

function convert(minor, from, to) {
  if (from === to || !minor) return minor;
  const r = S.boot?.rates?.rates || {};
  if (!r[from] || !r[to]) return null;
  return Math.round((minor / r[from]) * r[to]);
}

// ---------------------------------------------------------------- API

class AppError extends Error { constructor(message, status) { super(message); this.status = status; } }

async function api(path, { method = 'GET', body } = {}) {
  if (!API) throw new AppError('The app isn’t connected to its server yet. Run setup.sh on your Mac.', 0);
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (S.token) headers.authorization = 'Bearer ' + S.token;
  let res;
  try {
    res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    S.offline = true;
    throw new AppError('You’re offline. Try again when you have signal.', 0);
  }
  S.offline = false;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path.startsWith('/api/')) {
    signOutLocal();
    throw new AppError('Please sign in again.', 401);
  }
  if (!res.ok) throw new AppError(data.error || 'Something went wrong. Please try again.', res.status);
  return data;
}

async function loadBoot() {
  const data = await api('/api/bootstrap');
  S.boot = data;
  local.set('b.boot', data);
}

async function loadMonth(ym) {
  const prev = addMonths(ym, -1);
  const { transactions } = await api(`/api/transactions?from=${monthStart(prev)}&to=${monthStart(addMonths(ym, 1))}`);
  const start = monthStart(ym);
  const cur = []; const before = [];
  for (const t of transactions) (t.occurred_at >= start ? cur : before).push(t);
  S.months[ymKey(ym)] = cur;
  S.months[ymKey(prev)] = before;
  local.set('b.tx.' + ymKey(ym), cur);
  local.set('b.tx.' + ymKey(prev), before);
}

async function refresh({ quiet = true } = {}) {
  if (!S.token || S.loading) return;
  S.loading = true;
  try {
    await loadBoot();
    await loadMonth(S.ym);
  } catch (e) {
    if (!quiet || e.status !== 0) toast(e.message);
  } finally {
    S.loading = false;
    render();
  }
}

function upsertTx(t) {
  for (const key of Object.keys(S.months)) S.months[key] = S.months[key].filter((x) => x.id !== t.id);
  const d = new Date(t.occurred_at);
  const key = ymKey({ y: d.getFullYear(), m: d.getMonth() });
  if (S.months[key]) {
    S.months[key] = [t, ...S.months[key]].sort((a, b) => b.occurred_at - a.occurred_at);
    local.set('b.tx.' + key, S.months[key]);
  }
}
function removeTx(id) {
  for (const key of Object.keys(S.months)) {
    S.months[key] = S.months[key].filter((x) => x.id !== id);
    local.set('b.tx.' + key, S.months[key]);
  }
}

function signOutLocal() {
  S.token = null; S.boot = null; S.months = {}; S.key = null;
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('b.')) localStorage.removeItem(k);
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------- passkeys

const b64uToBuf = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0)).buffer;
const bufToB64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function createPasskey(options) {
  const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON
    ? PublicKeyCredential.parseCreationOptionsFromJSON(options)
    : { ...options, challenge: b64uToBuf(options.challenge), user: { ...options.user, id: b64uToBuf(options.user.id) },
      excludeCredentials: (options.excludeCredentials || []).map((c) => ({ ...c, id: b64uToBuf(c.id) })) };
  const cred = await navigator.credentials.create({ publicKey });
  if (typeof cred.toJSON === 'function') return cred.toJSON();
  return {
    id: cred.id, rawId: bufToB64u(cred.rawId), type: cred.type, authenticatorAttachment: cred.authenticatorAttachment,
    clientExtensionResults: cred.getClientExtensionResults(),
    response: {
      clientDataJSON: bufToB64u(cred.response.clientDataJSON),
      attestationObject: bufToB64u(cred.response.attestationObject),
      transports: cred.response.getTransports ? cred.response.getTransports() : [],
    },
  };
}

async function getPasskey(options) {
  const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON
    ? PublicKeyCredential.parseRequestOptionsFromJSON(options)
    : { ...options, challenge: b64uToBuf(options.challenge), allowCredentials: (options.allowCredentials || []).map((c) => ({ ...c, id: b64uToBuf(c.id) })) };
  const cred = await navigator.credentials.get({ publicKey });
  if (typeof cred.toJSON === 'function') return cred.toJSON();
  return {
    id: cred.id, rawId: bufToB64u(cred.rawId), type: cred.type, authenticatorAttachment: cred.authenticatorAttachment,
    clientExtensionResults: cred.getClientExtensionResults(),
    response: {
      clientDataJSON: bufToB64u(cred.response.clientDataJSON),
      authenticatorData: bufToB64u(cred.response.authenticatorData),
      signature: bufToB64u(cred.response.signature),
      userHandle: cred.response.userHandle ? bufToB64u(cred.response.userHandle) : undefined,
    },
  };
}

const passkeyMessage = (e) => (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')
  ? 'Passkey cancelled. Try again when you’re ready.'
  : e && e.name === 'InvalidStateError' ? 'This device already has a passkey for this app. Use “Sign in” instead.'
    : (e && e.message) || 'Something went wrong with your passkey.');

async function signIn() {
  const { challengeId, options } = await api('/auth/login/options', { method: 'POST', body: {} });
  let response;
  try { response = await getPasskey(options); } catch (e) { throw new AppError(passkeyMessage(e)); }
  const { token } = await api('/auth/login/verify', { method: 'POST', body: { challengeId, response } });
  await afterSignIn(token);
}

async function signUp(name, invite) {
  const { challengeId, options } = await api('/auth/register/options', { method: 'POST', body: { name, invite } });
  let response;
  try { response = await createPasskey(options); } catch (e) { throw new AppError(passkeyMessage(e)); }
  const { token } = await api('/auth/register/verify', { method: 'POST', body: { challengeId, response } });
  await afterSignIn(token);
}

async function afterSignIn(token) {
  S.token = token;
  local.set('b.token', token);
  await loadBoot();
  await loadMonth(S.ym);
  location.hash = '#overview';
  render();
}

// ---------------------------------------------------------------- numbers for a month

function monthSummary(ym, accountId, cur) {
  const txs = txList(ym) || [];
  const isNow = sameYM(ym, nowYM());
  const out = {
    spent: 0, income: 0, transfers: 0, byCat: new Map(), byAcc: new Map(), unconverted: 0,
    foreign: new Set(), needs: [], latest: [],
  };
  const conv = (amount, from) => {
    if (from !== cur) out.foreign.add(from);
    const v = convert(amount, from, cur);
    if (v === null) { out.unconverted++; return amount; }
    return v;
  };
  for (const t of txs) {
    if (t.kind === 'expense' && (!t.category_id || (t.source === 'wallet' && !t.account_id))) out.needs.push(t);
    if (t.kind === 'transfer') {
      if (accountId === 'total') out.transfers += conv(t.amount, t.currency);
      else if (t.account_id === accountId) out.transfers -= conv(t.amount, t.currency);
      else if (t.to_account_id === accountId) out.transfers += conv(t.to_amount, t.to_currency);
      if (accountId === 'total' || t.account_id === accountId || t.to_account_id === accountId) out.latest.push(t);
      continue;
    }
    if (accountId !== 'total' && t.account_id !== accountId) continue;
    out.latest.push(t);
    const v = conv(t.amount, t.currency);
    if (t.kind === 'expense') {
      out.spent += v;
      const ck = t.category_id || 'none';
      out.byCat.set(ck, (out.byCat.get(ck) || 0) + v);
      const ak = t.account_id || 'none';
      out.byAcc.set(ak, (out.byAcc.get(ak) || 0) + v);
    } else {
      out.income += v;
    }
  }
  // the same point last month
  const prevTxs = txList(addMonths(ym, -1));
  out.prev = null;
  if (prevTxs) {
    const cutoffDay = isNow ? new Date().getDate() : 99;
    out.prev = 0;
    for (const t of prevTxs) {
      if (t.kind !== 'expense') continue;
      if (accountId !== 'total' && t.account_id !== accountId) continue;
      if (new Date(t.occurred_at).getDate() > cutoffDay) continue;
      const v = convert(t.amount, t.currency, cur);
      out.prev += v === null ? t.amount : v;
    }
  }
  // budgets, converted into this view's currency
  out.budgets = new Map();
  for (const b of S.boot?.budgets || []) {
    const acc = accountById(b.account_id);
    if (!acc || acc.archived) continue;
    if (accountId !== 'total' && b.account_id !== accountId) continue;
    const v = convert(b.amount, acc.currency, cur);
    out.budgets.set(b.category_id, (out.budgets.get(b.category_id) || 0) + (v ?? b.amount));
  }
  out.totalBudget = [...out.budgets.values()].reduce((a, b) => a + b, 0);
  out.spentBudgeted = [...out.budgets.keys()].reduce((a, k) => a + (out.byCat.get(k) || 0), 0);
  out.daysLeft = isNow ? daysIn(ym) - new Date().getDate() + 1 : 0;
  out.isNow = isNow;
  return out;
}

// ---------------------------------------------------------------- rendering

// The big figure always stays on one line: longer amounts get a smaller size.
function bigFigure(textValue) {
  const len = textValue.replace(/\u00a0/g, ' ').length;
  const px = Math.max(30, Math.min(60, Math.floor(296 / (len * 0.7))));
  return `<span class="hero-big" style="font-size:min(${px}px, ${(px / 3.9).toFixed(1)}vw)">${esc(textValue)}</span>`;
}

const route = () => (location.hash || '#overview').slice(1);

function render() {
  const app = $('#app');
  const bar = $('#tabbar');
  if (!S.token) {
    bar.hidden = true;
    app.innerHTML = API ? welcomeView() : notConfiguredView();
    return;
  }
  if (!S.boot) {
    bar.hidden = true;
    app.innerHTML = `<div class="boot">Loading your budget…</div>`;
    return;
  }
  if (!accounts(true).length || S.onboarding) {
    bar.hidden = true;
    app.innerHTML = onboardingView();
    return;
  }
  bar.hidden = false;
  const r = ['activity', 'settings'].includes(route()) ? route() : 'overview';
  for (const a of bar.querySelectorAll('nav a')) a.setAttribute('aria-current', a.getAttribute('href') === '#' + r ? 'page' : 'false');
  app.innerHTML = r === 'activity' ? activityView() : r === 'settings' ? settingsView() : overviewView();
  if (S.offline) app.insertAdjacentHTML('beforeend', '<p class="offline">Offline — showing what was saved on this phone.</p>');
}

function notConfiguredView() {
  return `<div class="welcome"><div class="mark" aria-hidden="true"></div>
    <h1 class="h1">Almost there</h1>
    <p class="lede">This copy of the app isn’t connected to its server yet. Run <b>setup.sh</b> on your Mac (see README), then reload.</p></div>`;
}

function welcomeView() {
  const supported = !!window.PublicKeyCredential;
  return `<div class="welcome">
    <div class="mark" aria-hidden="true"></div>
    <div class="section"><h1 class="h1">Budget</h1>
      <p class="lede">Pay with Apple Pay, tap a category, done. See where your money went at the end of the month.</p></div>
    ${supported ? '' : '<p class="error">This browser doesn’t support passkeys. Open the app in Safari on your iPhone.</p>'}
    <div class="section">
      <button class="btn primary wide" data-action="sign-in" ${supported ? '' : 'disabled'}>${icon('face')} Sign in with passkey</button>
      <button class="btn soft wide" data-action="show-invite" ${supported ? '' : 'disabled'}>I have an invite code</button>
    </div>
    <form class="card" id="invite-form" hidden>
      <label class="field"><span>Your name</span><input class="input" name="name" autocomplete="given-name" required maxlength="60"></label>
      <label class="field"><span>Invite code</span><input class="input" name="invite" autocapitalize="characters" autocomplete="off" required placeholder="ABCD-EFGH"></label>
      <button class="btn dark wide" type="submit">Create my passkey</button>
      <p class="caption">Your passkey uses Face ID. There’s no password to remember.</p>
    </form>
    <p class="error" id="auth-error" role="alert" hidden></p>
  </div>`;
}

function onboardingView() {
  return `<div class="section" style="padding-top:24px">
      <h1 class="h1">Add your accounts</h1>
      <p class="muted" style="margin:0;font-size:15px;line-height:21px">Each account keeps its own currency and budgets. Apple Pay payments are matched to an account by the card’s name.</p>
    </div>
    <form class="card" id="account-quick">
      <label class="field"><span>Account name</span><input class="input" name="name" required maxlength="40" placeholder="e.g. the bank’s name"></label>
      <label class="field"><span>Currency</span>${currencySelect('currency', user().display_currency || 'ZAR')}</label>
      <button class="btn dark wide" type="submit">Add account</button>
    </form>
    ${accounts(true).length ? `<div class="group">${accounts(true).map((a) => `<div class="item"><span class="grow">${esc(a.name)}</span><span class="val">${a.currency}</span></div>`).join('')}</div>
      <button class="btn primary wide" data-action="onboarding-done">Done</button>` : ''}
    <p class="caption">You can add more accounts, budgets and card names later in Settings.</p>`;
}

function currencySelect(name, value) {
  return `<select class="input" name="${name}">${CURRENCIES.map((c) => `<option value="${c}" ${c === value ? 'selected' : ''}>${c}</option>`).join('')}</select>`;
}

function monthBar(extra = '') {
  const isNow = sameYM(S.ym, nowYM());
  return `<header class="topbar">
    <div class="capsule">
      <button data-action="month" data-n="-1" aria-label="Previous month">${icon('left', 's')}</button>
      <h1 class="label" aria-live="polite">${esc(monthLabel(S.ym))}</h1>
      <button data-action="month" data-n="1" aria-label="Next month" ${isNow ? 'disabled' : ''}>${icon('right', 's')}</button>
    </div>${extra}</header>`;
}

function accountChips() {
  const list = accounts();
  if (list.length < 2) return '';
  return `<nav class="chips" aria-label="Accounts">
    <button class="chip" data-action="account" data-id="total" aria-pressed="${S.account === 'total'}">Total</button>
    ${list.map((a) => `<button class="chip" data-action="account" data-id="${a.id}" aria-pressed="${S.account === a.id}">${esc(a.name)}</button>`).join('')}
  </nav>`;
}

function overviewView() {
  if (S.account !== 'total' && !accountById(S.account)) S.account = 'total';
  if (accounts().length === 1) S.account = accounts()[0].id;
  const cur = viewCurrency();
  const sum = monthSummary(S.ym, S.account, cur);
  const txs = txList(S.ym);
  const days = sum.isNow ? `<span class="caption" style="font-size:15px">${sum.daysLeft === 1 ? 'Last day' : sum.daysLeft + ' days left'}</span>` : '';
  let html = monthBar(days) + accountChips() + heroView(sum, cur);

  const transfersLabel = S.account === 'total' ? 'Transfers' : 'Transfers in/out';
  html += `<section class="stats" aria-label="Money in and out">
    <div class="stat"><span class="caption">Income</span><b>${money(sum.income, cur, { cents: false })}</b></div>
    <div class="stat"><span class="caption">${S.account === 'total' || sum.totalBudget ? 'Saved' : 'Spent'}</span><b>${money(S.account === 'total' || sum.totalBudget ? sum.income - sum.spent : sum.spent, cur, { cents: false })}</b></div>
    <div class="stat"><span class="caption">${transfersLabel}</span><b>${money(sum.transfers, cur, { cents: false, sign: S.account !== 'total' && sum.transfers > 0 })}</b></div>
  </section>`;

  if (sum.needs.length) {
    html += `<div class="banner"><p>${sum.needs.length === 1 ? '1 payment needs' : sum.needs.length + ' payments need'} a category</p>
      <button class="pill-btn" data-action="review">Review</button></div>`;
  }

  if (txs === null) {
    html += `<div class="empty"><p>Loading this month…</p></div>`;
  } else {
    if (!txs.length) {
      html += `<div class="empty"><strong>Nothing yet in ${esc(monthShort(S.ym))}</strong><p>Pay with Apple Pay and pick a category, or tap + to add a payment, income or transfer.</p></div>`;
    }
    html += categoryTiles(sum, cur);
  }
  return html;
}

function heroView(sum, cur) {
  const prevName = monthShort(addMonths(S.ym, -1));
  const compare = sum.prev === null || (sum.prev === 0 && sum.spent === 0) ? ''
    : sum.spent === sum.prev ? `The same as ${sum.isNow ? 'this point in ' : ''}${prevName}`
      : `${money(Math.abs(sum.spent - sum.prev), cur, { cents: false })} ${sum.spent < sum.prev ? 'less' : 'more'} than ${sum.isNow ? 'this point in ' : ''}${prevName}`;

  const rateNote = [...sum.foreign].filter((c) => c !== cur).map((c) => {
    const v = convert(100, c, cur);
    return v === null ? null : `${money(100, c, { cents: false })} = ${money(v, cur, { cents: true })}`;
  }).filter(Boolean);
  const note = rateNote.length
    ? `<span class="hero-note">Converted at today’s rate: ${esc(rateNote.join(' · '))}</span>`
    : (sum.unconverted ? '<span class="hero-note">Some amounts couldn’t be converted yet.</span>' : '');

  if (S.account !== 'total' && sum.totalBudget > 0) {
    const left = sum.totalBudget - sum.spentBudgeted;
    const pct = Math.min(100, Math.round((sum.spentBudgeted / sum.totalBudget) * 100));
    const perDay = sum.isNow && sum.daysLeft > 0 && left > 0 ? Math.floor(left / sum.daysLeft) : null;
    return `<section class="hero" aria-label="This month">
      <div class="hero-top"><span class="hero-label">${left >= 0 ? 'Left to spend' : 'Over budget by'}</span></div>
      ${bigFigure(money(Math.abs(left), cur, { cents: false }))}
      <span class="hero-sub">${perDay !== null ? `About ${money(perDay, cur, { cents: false })} a day for the next ${sum.daysLeft} day${sum.daysLeft === 1 ? '' : 's'}` : esc(compare || ' ')}</span>
      <div class="bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
      <div class="hero-foot"><span>${money(sum.spentBudgeted, cur, { cents: false })} spent</span><span>of ${money(sum.totalBudget, cur, { cents: false })}</span></div>
      ${sum.spent !== sum.spentBudgeted ? `<span class="hero-note">Plus ${money(sum.spent - sum.spentBudgeted, cur, { cents: false })} in categories without a budget</span>` : ''}
      ${note}
    </section>`;
  }

  // Total (or an account with no budgets): what was spent
  const currencies = [...new Set(accounts().map((a) => a.currency))];
  const toggle = S.account === 'total' && currencies.length > 1
    ? `<div class="seg-on-brand" role="group" aria-label="Show totals in">${currencies.map((c) =>
      `<button data-action="cur" data-cur="${c}" aria-pressed="${c === cur}">${esc((SYMBOL[c] || c).trim())}</button>`).join('')}</div>` : '';
  let split = '';
  if (S.account === 'total' && sum.spent > 0) {
    const parts = [...sum.byAcc.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (parts.length > 1) {
      const shades = ['#FFFFFF', 'rgba(255,255,255,0.62)', 'rgba(255,255,255,0.34)', 'rgba(255,255,255,0.18)'];
      split = `<div class="bar split" aria-hidden="true">${parts.map(([, v], i) =>
        `<span style="width:${(v / sum.spent) * 100}%;background:${shades[Math.min(i, 3)]}"></span>`).join('')}</div>
        <div class="legend">${parts.map(([id, v], i) => {
          const acc = accountById(id);
          const own = acc && acc.currency !== cur ? convert(v, cur, acc.currency) : null;
          return `<span><i style="background:${shades[Math.min(i, 3)]}"></i>${esc(acc ? acc.name : 'No account yet')} ${own !== null ? money(own, acc.currency, { cents: false }) : money(v, cur, { cents: false })}</span>`;
        }).join('')}</div>`;
    }
  }
  return `<section class="hero" aria-label="This month">
    <div class="hero-top"><span class="hero-label">${sum.isNow ? 'Spent so far' : 'Spent in ' + esc(monthShort(S.ym))}</span>${toggle}</div>
    ${bigFigure(money(sum.spent, cur, { cents: false }))}
    <span class="hero-sub">${esc(compare || ' ')}</span>
    ${split}
    ${S.account !== 'total' ? '<span class="hero-note">No budgets for this account yet. Add them in Settings.</span>' : ''}
    ${note}
  </section>`;
}

function categoryTiles(sum, cur) {
  const cats = categories('expense');
  const ordered = [...cats].sort((a, b) => (sum.byCat.get(b.id) || 0) - (sum.byCat.get(a.id) || 0) || a.sort - b.sort);
  const tiles = ordered.map((c) => {
    const spent = sum.byCat.get(c.id) || 0;
    const budget = sum.budgets.get(c.id) || 0;
    const over = budget > 0 && spent > budget;
    const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
    const right = over ? `${money(spent - budget, cur, { cents: false })} over` : budget > 0 ? `${pct}%` : '';
    return `<button class="tile ${over ? 'over' : ''}" data-action="cat-activity" data-id="${c.id}"
      aria-label="${esc(c.name)}: ${esc(money(spent, cur))} spent${budget ? ' of ' + esc(money(budget, cur)) : ''}">
      ${!over && budget ? `<span class="fill" style="width:${pct}%"></span>` : ''}
      <span class="in">
        <span class="row1"><span class="name">${icon(c.icon, 's')}<span>${esc(c.name)}</span></span>${right ? `<span class="pct">${right}</span>` : ''}</span>
        <span class="row2"><span class="amt">${money(spent, cur, { cents: false })}</span><span class="of">${budget ? 'of ' + money(budget, cur, { cents: false }).replace(/^[^\d]+/, '') : 'No budget'}</span></span>
      </span></button>`;
  }).join('');
  return `<section class="section" aria-label="Categories">
    <div class="section-head"><h2 class="h2">Categories</h2>${S.account === 'total' && accounts().length > 1 ? '<span class="caption">Budgets from all accounts</span>' : ''}</div>
    <div class="tiles">${tiles}</div></section>`;
}

function txRow(t) {
  const cat = categoryById(t.category_id);
  const acc = accountById(t.account_id);
  let ico; let title; let sub; let amt;
  if (t.kind === 'transfer') {
    const to = accountById(t.to_account_id);
    ico = `<span class="ico t">${icon('transfer', 's')}</span>`;
    title = t.note || 'Transfer';
    sub = `${esc(acc?.name || '?')} → ${esc(to?.name || '?')} · ${time(t.occurred_at)}`;
    amt = `<span class="amt">${money(t.amount, t.currency)}</span>`;
  } else {
    const needs = t.kind === 'expense' && !cat;
    ico = needs ? `<span class="ico q">${icon('question', 's')}</span>` : `<span class="ico">${icon(cat?.icon || 'other', 's')}</span>`;
    title = t.merchant || t.note || cat?.name || (t.kind === 'income' ? 'Income' : 'Payment');
    const parts = [needs ? '<span class="warn">Needs a category</span>' : esc(cat?.name || (t.kind === 'income' ? 'Income' : ''))];
    if (acc) parts.push(esc(acc.name));
    else if (t.card) parts.push(`<span class="warn">Which account? (${esc(t.card)})</span>`);
    parts.push(time(t.occurred_at));
    if (t.amount === 0 && t.source === 'wallet') parts.unshift('<span class="warn">Amount missing</span>');
    sub = parts.filter(Boolean).join(' · ');
    amt = `<span class="amt ${t.kind === 'income' ? 'in' : ''}">${money(t.amount, t.currency, { sign: t.kind === 'income' })}</span>`;
  }
  return `<li><button class="row" data-action="edit-tx" data-id="${t.id}">${ico}
    <span class="main"><span class="title">${esc(title)}</span><span class="sub">${sub}</span></span>${amt}</button></li>`;
}

function activityView() {
  const txs = txList(S.ym);
  let rows = txs || [];
  if (S.account !== 'total') rows = rows.filter((t) => t.account_id === S.account || t.to_account_id === S.account);
  const f = S.filter;
  if (f.kind === 'needs') rows = rows.filter((t) => t.kind === 'expense' && (!t.category_id || (t.source === 'wallet' && !t.account_id)));
  else if (f.kind !== 'all') rows = rows.filter((t) => t.kind === f.kind);
  if (f.category) rows = rows.filter((t) => t.category_id === f.category);
  const cat = f.category ? categoryById(f.category) : null;
  const base = (txs || []).filter((t) => S.account === 'total' || t.account_id === S.account || t.to_account_id === S.account);
  const count = {
    all: base.length,
    needs: base.filter((t) => t.kind === 'expense' && (!t.category_id || (t.source === 'wallet' && !t.account_id))).length,
    expense: base.filter((t) => t.kind === 'expense').length,
    income: base.filter((t) => t.kind === 'income').length,
    transfer: base.filter((t) => t.kind === 'transfer').length,
  };
  const filters = [['all', 'Everything'], ['needs', 'Needs a category'], ['expense', 'Spending'], ['income', 'Income'], ['transfer', 'Transfers']];
  let html = monthBar() + accountChips();
  html += `<div class="filter-row">
    <label class="menu-select"><span class="sr">Show</span>
      <select data-change="filter">${filters.map(([k, l]) => `<option value="${k}" ${f.kind === k ? 'selected' : ''}>${l} (${count[k]})</option>`).join('')}</select></label>
    ${cat ? `<button class="chip" data-action="clear-cat" aria-pressed="true">${esc(cat.name)} ${icon('close', 's')}<span class="sr">Remove filter</span></button>` : ''}
  </div>`;
  if (txs === null) return html + '<div class="empty"><p>Loading…</p></div>';
  if (!rows.length) {
    return html + `<div class="empty"><strong>Nothing here</strong><p>${f.kind === 'needs' ? 'Every payment has a category. Nice.' : 'No payments match. Try another month or filter.'}</p></div>`;
  }
  let lastDay = null;
  let group = [];
  const out = [];
  const flush = () => { if (group.length) out.push(`<h2 class="day">${esc(lastDay)}</h2><ul class="list">${group.join('')}</ul>`); group = []; };
  for (const t of rows) {
    const d = dayLabel(t.occurred_at);
    if (d !== lastDay) { flush(); lastDay = d; }
    group.push(txRow(t));
  }
  flush();
  return html + out.join('');
}

function settingsView() {
  const u = user();
  const accs = accounts(true);
  const expense = categories('expense');
  const income = categories('income');
  const hidden = (S.boot?.categories || []).filter((c) => c.archived);
  const rates = S.boot?.rates;
  return `<h1 class="h1" style="padding-top:8px">Settings</h1>
  <section class="section"><h2 class="h2">You</h2><div class="group">
    <button class="item" data-action="edit-name"><span class="grow">Name</span><span class="val">${esc(u.name)}</span>${icon('right', 's')}</button>
    <label class="item"><span class="grow">Show totals in</span>
      <select class="input" style="width:auto;min-height:40px" data-change="display-currency">${CURRENCIES.map((c) => `<option ${c === u.display_currency ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
  </div></section>

  <section class="section"><h2 class="h2">Accounts</h2><div class="group">
    ${accs.map((a) => {
      const n = (S.boot.budgets || []).filter((b) => b.account_id === a.id).length;
      return `<button class="item" data-action="edit-account" data-id="${a.id}"><span class="grow">${esc(a.name)}${a.archived ? ' (hidden)' : ''}
        <small>${a.currency} · ${a.cards.length ? esc(a.cards.join(', ')) : 'no cards linked yet'} · ${n ? n + ' budget' + (n === 1 ? '' : 's') : 'no budgets'}</small></span>${icon('right', 's')}</button>`;
    }).join('')}
    <button class="item add" data-action="edit-account">${icon('plus', 's')} Add an account</button>
  </div></section>

  <section class="section"><h2 class="h2">Categories</h2>
    <p class="caption" style="margin:0">These appear in the Apple Pay menu in this order.</p>
    <div class="group">
    ${expense.map((c, i) => categoryItem(c, i, expense.length)).join('')}
    <button class="item add" data-action="edit-category" data-kind="expense">${icon('plus', 's')} Add a spending category</button></div>
    <div class="group">
    ${income.map((c, i) => categoryItem(c, i, income.length)).join('')}
    <button class="item add" data-action="edit-category" data-kind="income">${icon('plus', 's')} Add an income category</button></div>
    ${hidden.length ? `<div class="group">${hidden.map((c) => `<button class="item" data-action="edit-category" data-id="${c.id}"><span class="grow">${esc(c.name)}<small>Hidden</small></span>${icon('right', 's')}</button>`).join('')}</div>` : ''}
  </section>

  <section class="section"><h2 class="h2">Apple Pay</h2><div class="group">
    <button class="item" data-action="shortcut"><span class="grow">Apple Pay Shortcut<small>${u.has_shortcut_key ? 'Link created' : 'Not set up yet'}</small></span>${icon('right', 's')}</button>
  </div></section>

  ${u.is_admin ? `<section class="section"><h2 class="h2">Friends</h2><div class="group">
    <button class="item" data-action="invites"><span class="grow">Invite a friend<small>Each friend gets their own private budget</small></span>${icon('right', 's')}</button>
  </div></section>` : ''}

  <section class="section"><div class="group">
    <button class="item" data-action="sign-out">Sign out</button>
    <button class="item danger" data-action="delete-me">Delete my account and data</button>
  </div>
  <p class="caption">${rates && rates.source_date ? `Exchange rates from ${esc(rates.source_date)} (European Central Bank, via Frankfurter).` : 'Exchange rates load when you’re online.'}</p></section>`;
}

function categoryItem(c, i, n) {
  return `<div class="item" style="padding-right:8px"><span style="display:grid;place-items:center">${icon(c.icon, 's')}</span>
    <button class="grow" data-action="edit-category" data-id="${c.id}" style="min-height:44px;text-align:left">${esc(c.name)}</button>
    <button class="icon-btn" style="background:none" data-action="move-cat" data-id="${c.id}" data-n="-1" aria-label="Move ${esc(c.name)} up" ${i === 0 ? 'disabled' : ''}>${icon('up', 's')}</button>
    <button class="icon-btn" style="background:none" data-action="move-cat" data-id="${c.id}" data-n="1" aria-label="Move ${esc(c.name)} down" ${i === n - 1 ? 'disabled' : ''}>${icon('down', 's')}</button></div>`;
}

// ---------------------------------------------------------------- sheets

const sheet = () => $('#sheet');
function openSheet(html, label) {
  const d = sheet();
  d.setAttribute('aria-label', label);
  d.innerHTML = `<div class="sheet-in"><div class="sheet-grab" aria-hidden="true"></div>${html}</div>`;
  if (!d.open) d.showModal();
}
function closeSheet() { const d = sheet(); if (d.open) d.close(); S.edit = null; S.review = null; }
const sheetHead = (title) => `<div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-action="close" aria-label="Close">${icon('close', 's')}</button></div>`;

// ----- add / edit a payment, income or transfer

function openEditor(tx) {
  const accs = accounts();
  const defaultAcc = S.account !== 'total' ? S.account : accs[0]?.id;
  const t = tx || { kind: 'expense', account_id: defaultAcc, amount: null, occurred_at: Date.now() };
  S.edit = {
    id: tx?.id || null,
    kind: t.kind,
    account_id: t.account_id || null,
    to_account_id: t.to_account_id || accs.find((a) => a.id !== t.account_id)?.id || null,
    amount: minorToInput(t.amount),
    to_amount: minorToInput(t.to_amount),
    category_id: t.category_id || null,
    merchant: t.merchant || '',
    note: t.note || '',
    when: toLocalInput(t.occurred_at),
    card: t.card || null,
    original: t.original_amount ?? null,
    currency: t.currency,
    source: t.source || 'manual',
    confirmDelete: false,
    error: null,
  };
  renderEditor();
}

function renderEditor() {
  const e = S.edit;
  const acc = accountById(e.account_id);
  const cur = acc?.currency || e.currency || user().display_currency;
  const accs = accounts();
  const title = e.id ? (e.kind === 'transfer' ? 'Transfer' : e.kind === 'income' ? 'Income' : 'Payment') : 'Add';
  let body = `${sheetHead(title)}
    <div class="seg" role="group" aria-label="Type">
      ${[['expense', 'Spending'], ['income', 'Income'], ['transfer', 'Transfer']].map(([k, l]) => `<button type="button" data-action="ed-kind" data-kind="${k}" aria-pressed="${e.kind === k}">${l}</button>`).join('')}
    </div>
    <label class="amount-input"><span class="cur">${esc((SYMBOL[cur] || cur).trim())}</span>
      <input data-edit="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(e.amount)}" aria-label="Amount in ${cur}"></label>
    ${e.original !== null && e.original !== undefined ? `<p class="caption" style="margin:0">Apple Pay amount was ${money(e.original, cur)}</p>` : ''}`;

  if (e.kind === 'transfer') {
    const to = accountById(e.to_account_id);
    const differ = to && to.currency !== cur;
    const suggestion = differ ? convert(parseMoney(e.amount) || 0, cur, to.currency) : null;
    body += `<div class="field"><span>From</span><div class="chips" style="margin:0;padding:0;flex-wrap:wrap">${accs.map((a) =>
      `<button type="button" class="chip" data-action="ed-account" data-id="${a.id}" aria-pressed="${a.id === e.account_id}">${esc(a.name)}</button>`).join('')}</div></div>
      <div class="field"><span>To</span><div class="chips" style="margin:0;padding:0;flex-wrap:wrap">${accs.filter((a) => a.id !== e.account_id).map((a) =>
      `<button type="button" class="chip" data-action="ed-to" data-id="${a.id}" aria-pressed="${a.id === e.to_account_id}">${esc(a.name)}</button>`).join('')}</div></div>
      ${differ ? `<label class="field"><span>Amount that arrived in ${esc(to.name)} (${to.currency})</span>
        <input class="input" data-edit="to_amount" inputmode="decimal" value="${esc(e.to_amount)}" placeholder="${suggestion ? esc(minorToInput(suggestion)) : ''}"></label>
        <p class="caption" style="margin:0">Leave it empty to use today’s rate.</p>` : ''}`;
  } else {
    if (accs.length > 1 || !acc) {
      body += `<div class="field"><span>${!acc && e.card ? `Which account is the card “${esc(e.card)}” from?` : 'Account'}</span>
        <div class="chips" style="margin:0;padding:0;flex-wrap:wrap">${accs.map((a) =>
        `<button type="button" class="chip" data-action="ed-account" data-id="${a.id}" aria-pressed="${a.id === e.account_id}">${esc(a.name)}</button>`).join('')}</div></div>`;
    }
    body += `<div class="field"><span>Category</span><div class="pick">${categories(e.kind).map((c) =>
      `<button type="button" data-action="ed-cat" data-id="${c.id}" aria-pressed="${c.id === e.category_id}">${icon(c.icon, 's')}<span>${esc(c.name)}</span></button>`).join('')}</div></div>`;
    body += `<label class="field"><span>${e.kind === 'income' ? 'From' : 'Shop or description'}</span>
      <input class="input" data-edit="merchant" value="${esc(e.merchant)}" maxlength="120" autocomplete="off"></label>`;
  }
  body += `<label class="field"><span>Note (optional)</span><input class="input" data-edit="note" value="${esc(e.note)}" maxlength="500" autocomplete="off"></label>
    <label class="field"><span>Date and time</span><input class="input" type="datetime-local" data-edit="when" value="${esc(e.when)}"></label>
    ${e.error ? `<p class="error" role="alert">${esc(e.error)}</p>` : ''}
    <button class="btn primary wide" data-action="ed-save">${e.id ? 'Save' : 'Add'}</button>`;
  if (e.id) {
    body += e.confirmDelete
      ? `<div class="card"><strong>Delete this ${e.kind === 'transfer' ? 'transfer' : 'payment'}?</strong>
          <div class="btn-row"><button class="btn soft" data-action="ed-del-cancel">Keep it</button><button class="btn danger" data-action="ed-del-confirm">Delete</button></div></div>`
      : `<button class="btn soft wide" data-action="ed-del">Delete</button>`;
  }
  openSheet(body, title);
}

async function saveEditor() {
  const e = S.edit;
  const amount = parseMoney(e.amount);
  if (amount === null || (e.kind !== 'expense' && amount <= 0)) { e.error = 'Enter an amount.'; return renderEditor(); }
  const acc = accountById(e.account_id);
  const body = {
    kind: e.kind,
    account_id: e.account_id,
    amount,
    currency: acc ? acc.currency : (e.currency || user().display_currency),
    category_id: e.kind === 'transfer' ? null : e.category_id,
    merchant: e.kind === 'transfer' ? null : e.merchant,
    note: e.note,
    occurred_at: e.when ? new Date(e.when).getTime() : Date.now(),
  };
  if (e.kind === 'transfer') {
    const to = accountById(e.to_account_id);
    body.to_account_id = e.to_account_id;
    body.to_amount = parseMoney(e.to_amount) || (to && acc && to.currency !== acc.currency ? convert(amount, acc.currency, to.currency) : amount);
  }
  if (body.category_id && categoryById(body.category_id)?.kind !== e.kind) body.category_id = null;
  try {
    const res = e.id
      ? await api('/api/transactions/' + e.id, { method: 'PATCH', body })
      : await api('/api/transactions', { method: 'POST', body });
    upsertTx(res.transaction);
    if (e.id && e.card && body.account_id) {
      const a = accountById(body.account_id);
      if (a && !a.cards.some((c) => c.toLowerCase() === e.card.toLowerCase())) a.cards.push(e.card);
    }
    closeSheet();
    toast(e.id ? 'Saved' : 'Added');
    render();
  } catch (err) {
    e.error = err.message;
    renderEditor();
  }
}

async function deleteFromEditor() {
  const e = S.edit;
  const all = Object.values(S.months).flat();
  const old = all.find((t) => t.id === e.id);
  try {
    await api('/api/transactions/' + e.id, { method: 'DELETE' });
    removeTx(e.id);
    closeSheet();
    render();
    toast('Deleted', old ? { label: 'Undo', run: async () => {
      const { id, ...rest } = old;
      const res = await api('/api/transactions', { method: 'POST', body: rest });
      upsertTx(res.transaction); render();
    } } : null);
  } catch (err) { e.error = err.message; renderEditor(); }
}

// ----- review payments that need a category

function openReview() {
  const sum = monthSummary(S.ym, 'total', viewCurrency());
  S.review = { ids: sum.needs.map((t) => t.id), i: 0, account: null };
  renderReview();
}

function renderReview() {
  const r = S.review;
  const all = txList(S.ym) || [];
  const t = all.find((x) => x.id === r.ids[r.i]);
  if (!t) {
    openSheet(`${sheetHead('All sorted')}<div class="empty"><strong>Every payment has a category.</strong><p>Nice work.</p></div>
      <button class="btn primary wide" data-action="close">Done</button>`, 'All sorted');
    return;
  }
  const acc = accountById(r.account || t.account_id);
  const needAcc = !t.account_id;
  openSheet(`${sheetHead(`${r.i + 1} of ${r.ids.length}`)}
    <div class="card" style="gap:4px"><span class="caption">${esc(dayLabel(t.occurred_at))} · ${time(t.occurred_at)}${acc ? ' · ' + esc(acc.name) : ''}</span>
      <span class="h2">${esc(t.merchant || 'Payment')}</span>
      <span class="hero-big" style="font-size:40px;color:var(--text)">${money(t.amount, t.currency)}</span></div>
    ${needAcc ? `<div class="field"><span>${t.card ? `Which account is “${esc(t.card)}” from?` : 'Which account?'}</span><div class="chips" style="margin:0;padding:0;flex-wrap:wrap">
      ${accounts().map((a) => `<button class="chip" data-action="rv-account" data-id="${a.id}" aria-pressed="${r.account === a.id}">${esc(a.name)}</button>`).join('')}</div></div>` : ''}
    <div class="pick big">${categories('expense').map((c) =>
      `<button data-action="rv-cat" data-id="${c.id}" aria-pressed="${c.id === t.category_id}">${icon(c.icon)}<span>${esc(c.name)}</span></button>`).join('')}</div>
    <div class="btn-row"><button class="btn soft" data-action="rv-skip">Skip</button><button class="btn soft" data-action="rv-details">Details</button></div>`, 'Review payments');
}

async function reviewPick(categoryId) {
  const r = S.review;
  const t = (txList(S.ym) || []).find((x) => x.id === r.ids[r.i]);
  if (!t) return;
  const accountId = r.account || t.account_id;
  if (!accountId && accounts().length > 1) { toast('Choose the account first'); return; }
  const body = { category_id: categoryId, account_id: accountId || accounts()[0]?.id };
  try {
    const res = await api('/api/transactions/' + t.id, { method: 'PATCH', body });
    upsertTx(res.transaction);
    r.i += 1; r.account = null;
    renderReview();
    render();
  } catch (e) { toast(e.message); }
}

// ----- accounts

function openAccount(id) {
  const a = id ? accountById(id) : null;
  S.edit = { type: 'account', id: a?.id || null, name: a?.name || '', currency: a?.currency || user().display_currency || 'ZAR', cards: [...(a?.cards || [])], archived: !!a?.archived, error: null };
  renderAccount();
}

function renderAccount() {
  const e = S.edit;
  const budgets = new Map((S.boot.budgets || []).filter((b) => b.account_id === e.id).map((b) => [b.category_id, b.amount]));
  openSheet(`${sheetHead(e.id ? 'Account' : 'New account')}
    <label class="field"><span>Name</span><input class="input" data-edit="name" value="${esc(e.name)}" maxlength="40"></label>
    <label class="field"><span>Currency</span>${currencySelect('currency', e.currency).replace('<select', '<select data-edit="currency"')}</label>
    <div class="field"><span>Apple Pay cards in this account</span>
      <div class="tags">${e.cards.map((c, i) => `<span class="tag">${esc(c)}<button data-action="ac-card-del" data-i="${i}" aria-label="Remove ${esc(c)}">${icon('close', 's')}</button></span>`).join('') || '<span class="caption">None yet. The app learns a card the first time you pick this account for it.</span>'}</div>
      <div class="btn-row"><input class="input" id="new-card" placeholder="Card name as shown in Wallet" maxlength="80" style="flex:2"><button class="btn soft" data-action="ac-card-add" style="flex:1;min-height:48px">Add</button></div>
    </div>
    ${e.error ? `<p class="error" role="alert">${esc(e.error)}</p>` : ''}
    <button class="btn primary wide" data-action="ac-save">${e.id ? 'Save' : 'Add account'}</button>
    ${e.id ? `<section class="section"><h3 class="h2" style="font-size:19px">Monthly budgets</h3>
      <p class="caption" style="margin:0">In ${e.currency}. Leave a category empty for no budget. Changes save as you go.</p>
      <div class="group">${categories('expense').map((c) => `<div class="budget-row"><label for="bud-${c.id}">${icon(c.icon, 's')}${esc(c.name)}</label>
        <input class="input" id="bud-${c.id}" inputmode="decimal" data-budget="${c.id}" value="${esc(minorToInput(budgets.get(c.id)))}" placeholder="—"></div>`).join('')}</div>
    </section>
    <button class="btn soft wide" data-action="ac-archive">${e.archived ? 'Show this account again' : 'Hide this account'}</button>` : ''}`, e.id ? 'Account' : 'New account');
}

async function saveAccount() {
  const e = S.edit;
  if (!e.name.trim()) { e.error = 'Give the account a name.'; return renderAccount(); }
  try {
    const body = { name: e.name, currency: e.currency, cards: e.cards };
    if (e.id) await api('/api/accounts/' + e.id, { method: 'PATCH', body });
    else { const res = await api('/api/accounts', { method: 'POST', body }); e.id = res.account.id; }
    await loadBoot();
    toast('Saved');
    renderAccount();
    render();
  } catch (err) { e.error = err.message; renderAccount(); }
}

// ----- categories

function openCategory(id, kind) {
  const c = id ? categoryById(id) : null;
  S.edit = { type: 'category', id: c?.id || null, name: c?.name || '', icon: c?.icon || 'other', kind: c?.kind || kind || 'expense', archived: !!c?.archived, error: null };
  renderCategory();
}

function renderCategory() {
  const e = S.edit;
  openSheet(`${sheetHead(e.id ? 'Category' : 'New category')}
    <label class="field"><span>Name</span><input class="input" data-edit="name" value="${esc(e.name)}" maxlength="40"></label>
    <div class="field"><span>Icon</span><div class="icons">${CATEGORY_ICONS.map((k) =>
      `<button data-action="cat-icon" data-icon="${k}" aria-pressed="${k === e.icon}" aria-label="${k}">${icon(k)}</button>`).join('')}</div></div>
    ${e.error ? `<p class="error" role="alert">${esc(e.error)}</p>` : ''}
    <button class="btn primary wide" data-action="cat-save">${e.id ? 'Save' : 'Add category'}</button>
    ${e.id ? `<button class="btn soft wide" data-action="cat-archive">${e.archived ? 'Show this category again' : 'Hide this category'}</button>
      <p class="caption" style="margin:0">Hiding keeps past payments but removes the category from menus.</p>` : ''}`, 'Category');
}

async function saveCategory(extra = {}) {
  const e = S.edit;
  if (!e.name.trim()) { e.error = 'Give the category a name.'; return renderCategory(); }
  try {
    if (e.id) await api('/api/categories/' + e.id, { method: 'PATCH', body: { name: e.name, icon: e.icon, ...extra } });
    else await api('/api/categories', { method: 'POST', body: { name: e.name, icon: e.icon, kind: e.kind } });
    await loadBoot();
    closeSheet();
    toast('Saved');
    render();
  } catch (err) { e.error = err.message; renderCategory(); }
}

async function moveCategory(id, n) {
  const c = categoryById(id);
  const list = categories(c.kind);
  const i = list.findIndex((x) => x.id === id);
  const j = i + n;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  list.forEach((x, k) => { x.sort = k; });
  render();
  try { await api('/api/categories/order', { method: 'POST', body: { ids: list.map((x) => x.id) } }); local.set('b.boot', S.boot); } catch (e) { toast(e.message); }
}

// ----- Apple Pay Shortcut

const shortcutLink = () => (S.key ? `${API}/w/${S.key}` : null);

function describeText(link) {
  return `Run this automatically, without asking or notifying me, whenever I pay with any of my cards in Wallet. `
    + `1) Get contents of URL ${link} using POST with a JSON request body: amount = the transaction's Amount, merchant = the transaction's Merchant, card = the transaction's Card. `
    + `2) Choose from list using the result. `
    + `3) Get contents of URL ${link} using POST with JSON body: choice = the chosen item. `
    + `4) If the result of step 3 has any value: ask for text input using that result as the prompt, then get contents of URL ${link} using POST with JSON body: answer = the provided input, then choose from list using that result, then get contents of URL ${link} using POST with JSON body: choice = the chosen item.`;
}

function openShortcut() {
  S.key = S.key || local.get('b.key.' + user().id);
  const link = shortcutLink();
  const u = user();
  let html = `${sheetHead('Apple Pay Shortcut')}
    <p style="margin:0;font-size:15px;line-height:21px">When you pay with Apple Pay, a Shortcut on your iPhone sends the amount, shop and card to your personal link. A menu of your categories pops up, and one tap files it.</p>`;
  if (!link) {
    html += u.has_shortcut_key
      ? `<div class="card"><strong>Your link is already set up</strong><p class="caption" style="margin:0">It isn’t saved on this device. If you need it again, make a new one. The old link stops working, so update your Shortcut with the new one.</p>
          <button class="btn soft wide" data-action="sc-new">Make a new link</button></div>`
      : `<button class="btn primary wide" data-action="sc-new">Create my personal link</button>`;
  } else {
    html += `<div class="field"><span>Your personal link (keep it private)</span><div class="code">${esc(link)}</div>
        <div class="btn-row"><button class="btn dark" data-action="copy" data-text="${esc(link)}">${icon('copy', 's')} Copy link</button>
        <button class="btn soft" data-action="sc-test">Test it</button></div></div>
      <details class="howto" open><summary>Quickest: let Siri build it</summary><div>
        <ol class="steps"><li>Tap <b>Copy description</b> below.</li>
        <li>Open the <b>Shortcuts</b> app, tap <b>+</b> and paste it into “What do you want your shortcut to do?”.</li>
        <li>Check that the Wallet automation at the top includes all your cards and is switched on, with notifications off. Save it.</li>
        <li>Pay for something with Apple Pay. If the menu doesn’t look right, use the step-by-step guide instead.</li></ol>
        <button class="btn soft wide" data-action="copy" data-text="${esc(describeText(link))}">${icon('copy', 's')} Copy description</button></div></details>
      <details class="howto"><summary>Step by step</summary><div>
        <ol class="steps">
          <li>In <b>Shortcuts</b>, make a new shortcut and open the editor (the button with three lines).</li>
          <li>From the action list, open <b>Automation</b> and add <b>Wallet</b>. Select all your bank cards, switch the automation on and turn off asking and notifying.</li>
          <li>Add <b>Get Contents of URL</b>. Paste your link. Tap the arrow to show more: Method <b>POST</b>, Request Body <b>JSON</b>. Add three Text fields:
            <b>amount</b> → Shortcut Input, then tap it and choose <b>Amount</b>; <b>merchant</b> → Shortcut Input › <b>Merchant</b>; <b>card</b> → Shortcut Input › <b>Card</b>.</li>
          <li>Add <b>Choose from List</b>. It uses the result of the previous step.</li>
          <li>Add another <b>Get Contents of URL</b> with your link, Method POST, JSON body with one Text field: <b>choice</b> → <b>Chosen Item</b>.</li>
          <li><i>Optional, for “Change amount” and “Add a note”:</i> add <b>If</b> → <b>Contents of URL</b> <b>has any value</b>. Inside it add <b>Ask for Input</b> (Text, prompt: Contents of URL), then <b>Get Contents of URL</b> (your link, POST, JSON <b>answer</b> → Provided Input), then <b>Choose from List</b>, then <b>Get Contents of URL</b> (your link, POST, JSON <b>choice</b> → Chosen Item).</li>
          <li>Name it “Log payment” and tap Done.</li>
        </ol></div></details>
      <p class="caption" style="margin:0">If Apple Pay sends no amount, the menu starts with “Change amount…”. If a payment slips through, it waits under “Needs a category”.</p>
      <button class="btn soft wide" data-action="sc-new">Make a new link</button>`;
  }
  openSheet(html, 'Apple Pay Shortcut');
}

async function newShortcutKey() {
  try {
    const { key } = await api('/api/shortcut-key', { method: 'POST', body: {} });
    S.key = key;
    local.set('b.key.' + user().id, key);
    S.boot.user.has_shortcut_key = true;
    local.set('b.boot', S.boot);
    openShortcut();
    render();
  } catch (e) { toast(e.message); }
}

async function testShortcut() {
  try {
    const res = await fetch(shortcutLink());
    toast(await res.text());
  } catch { toast('Couldn’t reach your link. Are you online?'); }
}

// ----- invites

async function openInvites(fresh) {
  openSheet(`${sheetHead('Invite a friend')}<div class="empty"><p>Loading…</p></div>`, 'Invite a friend');
  let invites = [];
  try { invites = (await api('/api/invites')).invites; } catch (e) { toast(e.message); }
  const msg = fresh ? `Join my budget app: ${APP_URL} and use invite code ${fresh}` : '';
  openSheet(`${sheetHead('Invite a friend')}
    <p style="margin:0;font-size:15px;line-height:21px">Each code works once. Your friend gets their own private budget. They can’t see yours, and you can’t see theirs in the app.</p>
    ${fresh ? `<div class="code big">${esc(fresh)}</div>
      <button class="btn dark wide" data-action="copy" data-text="${esc(msg)}">${icon('copy', 's')} Copy invite message</button>` : ''}
    <button class="btn ${fresh ? 'soft' : 'primary'} wide" data-action="invite-new">Create ${fresh ? 'another' : 'an'} invite code</button>
    ${invites.length ? `<div class="group">${invites.map((i) => `<div class="item"><span class="grow"><span class="num">${esc(i.code)}</span>
      <small>${i.used_by_name ? 'Used by ' + esc(i.used_by_name) : 'Not used yet'}</small></span></div>`).join('')}</div>` : ''}`, 'Invite a friend');
}

// ----- small sheets

function openName() {
  S.edit = { type: 'name', name: user().name, error: null };
  openSheet(`${sheetHead('Your name')}
    <label class="field"><span>Name</span><input class="input" data-edit="name" value="${esc(S.edit.name)}" maxlength="60"></label>
    <button class="btn primary wide" data-action="name-save">Save</button>`, 'Your name');
}

function openDeleteMe() {
  openSheet(`${sheetHead('Delete everything?')}
    <p style="margin:0;font-size:15px;line-height:21px">This permanently deletes your account, accounts, budgets and every payment. It can’t be undone.</p>
    <div class="btn-row"><button class="btn soft" data-action="close">Keep my data</button><button class="btn danger" data-action="delete-me-confirm">Delete</button></div>`, 'Delete account');
}

// ---------------------------------------------------------------- toast

let toastTimer;
function toast(message, action = null) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = async () => { el.remove(); try { await action.run(); } catch (e) { toast(e.message); } };
  (sheet().open ? sheet() : document.body).appendChild(el);
  toastTimer = setTimeout(() => el.remove(), action ? 5000 : 2600);
}

async function copy(textValue) {
  try { await navigator.clipboard.writeText(textValue); toast('Copied'); } catch { toast('Couldn’t copy. Press and hold the text to copy it.'); }
}

// ---------------------------------------------------------------- events

const actions = {
  'sign-in': async (btn) => { btn.disabled = true; try { await signIn(); } catch (e) { showAuthError(e.message); } btn.disabled = false; },
  'show-invite': () => { $('#invite-form').hidden = false; $('#invite-form input').focus(); },
  month: (btn) => {
    const next = addMonths(S.ym, Number(btn.dataset.n));
    if (monthStart(next) > monthStart(nowYM())) return;
    S.ym = next;
    render();
    loadMonth(S.ym).then(render).catch((e) => toast(e.message));
  },
  account: (btn) => { S.account = btn.dataset.id; render(); },
  cur: async (btn) => {
    S.cur = btn.dataset.cur; render();
    try { await api('/api/me', { method: 'PATCH', body: { display_currency: S.cur } }); S.boot.user.display_currency = S.cur; local.set('b.boot', S.boot); } catch { /* keeps working locally */ }
  },
  review: () => openReview(),
  'cat-activity': (btn) => { S.filter = { kind: 'expense', category: btn.dataset.id }; location.hash = '#activity'; },
  filter: (btn) => { S.filter = { kind: btn.dataset.kind, category: null }; render(); },
  'clear-cat': () => { S.filter.category = null; render(); },
  add: () => openEditor(null),
  'edit-tx': (btn) => { const t = (txList(S.ym) || []).find((x) => x.id === btn.dataset.id); if (t) openEditor(t); },
  close: () => closeSheet(),
  'ed-kind': (btn) => { S.edit.kind = btn.dataset.kind; if (categoryById(S.edit.category_id)?.kind !== S.edit.kind) S.edit.category_id = null; renderEditor(); },
  'ed-account': (btn) => { S.edit.account_id = btn.dataset.id; if (S.edit.to_account_id === btn.dataset.id) S.edit.to_account_id = accounts().find((a) => a.id !== btn.dataset.id)?.id || null; renderEditor(); },
  'ed-to': (btn) => { S.edit.to_account_id = btn.dataset.id; renderEditor(); },
  'ed-cat': (btn) => { S.edit.category_id = S.edit.category_id === btn.dataset.id ? null : btn.dataset.id; renderEditor(); },
  'ed-save': (btn) => { btn.disabled = true; return saveEditor(); },
  'ed-del': () => { S.edit.confirmDelete = true; renderEditor(); },
  'ed-del-cancel': () => { S.edit.confirmDelete = false; renderEditor(); },
  'ed-del-confirm': () => deleteFromEditor(),
  'rv-account': (btn) => { S.review.account = btn.dataset.id; renderReview(); },
  'rv-cat': (btn) => reviewPick(btn.dataset.id),
  'rv-skip': () => { S.review.i += 1; renderReview(); },
  'rv-details': () => { const t = (txList(S.ym) || []).find((x) => x.id === S.review.ids[S.review.i]); if (t) openEditor(t); },
  'edit-account': (btn) => openAccount(btn.dataset.id),
  'ac-card-add': () => { const v = $('#new-card').value.trim(); if (v) { S.edit.cards.push(v); renderAccount(); } },
  'ac-card-del': (btn) => { S.edit.cards.splice(Number(btn.dataset.i), 1); renderAccount(); },
  'ac-save': () => saveAccount(),
  'ac-archive': async () => {
    try { await api('/api/accounts/' + S.edit.id, { method: 'PATCH', body: { archived: !S.edit.archived } }); await loadBoot(); closeSheet(); render(); } catch (e) { toast(e.message); }
  },
  'edit-category': (btn) => openCategory(btn.dataset.id, btn.dataset.kind),
  'cat-icon': (btn) => { S.edit.icon = btn.dataset.icon; renderCategory(); },
  'cat-save': () => saveCategory(),
  'cat-archive': () => saveCategory({ archived: !S.edit.archived }),
  'move-cat': (btn) => moveCategory(btn.dataset.id, Number(btn.dataset.n)),
  shortcut: () => openShortcut(),
  'sc-new': () => newShortcutKey(),
  'sc-test': () => testShortcut(),
  invites: () => openInvites(null),
  'invite-new': async () => { try { const { invite } = await api('/api/invites', { method: 'POST', body: {} }); openInvites(invite.code); } catch (e) { toast(e.message); } },
  copy: (btn) => copy(btn.dataset.text),
  'edit-name': () => openName(),
  'name-save': async () => {
    try { const { user: u } = await api('/api/me', { method: 'PATCH', body: { name: S.edit.name } }); S.boot.user = { ...S.boot.user, ...u }; local.set('b.boot', S.boot); closeSheet(); render(); } catch (e) { toast(e.message); }
  },
  'onboarding-done': () => { S.onboarding = false; local.del('b.onboarding'); location.hash = '#overview'; render(); },
  'sign-out': async () => { try { await api('/auth/logout', { method: 'POST', body: {} }); } catch { /* signing out locally anyway */ } signOutLocal(); render(); },
  'delete-me': () => openDeleteMe(),
  'delete-me-confirm': async () => { try { await api('/api/me', { method: 'DELETE' }); signOutLocal(); closeSheet(); render(); } catch (e) { toast(e.message); } },
};

function showAuthError(message) {
  const el = $('#auth-error');
  if (el) { el.textContent = message; el.hidden = false; }
}

document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-action]');
  if (btn && !btn.disabled) {
    ev.preventDefault();
    const fn = actions[btn.dataset.action];
    if (fn) Promise.resolve(fn(btn)).catch((e) => toast(e.message));
    return;
  }
  if (ev.target === sheet()) closeSheet(); // tap outside a sheet closes it
});

document.addEventListener('input', (ev) => {
  const k = ev.target.dataset.edit;
  if (k && S.edit) S.edit[k] = ev.target.value;
});

document.addEventListener('change', async (ev) => {
  const t = ev.target;
  if (t.dataset.edit && S.edit) {
    S.edit[t.dataset.edit] = t.value;
    if (S.edit.type === 'account' && t.dataset.edit === 'currency') renderAccount();
  }
  if (t.dataset.change === 'filter') { S.filter.kind = t.value; render(); return; }
  if (t.dataset.change === 'display-currency') {
    try { await api('/api/me', { method: 'PATCH', body: { display_currency: t.value } }); S.boot.user.display_currency = t.value; S.cur = t.value; local.set('b.boot', S.boot); toast('Saved'); } catch (e) { toast(e.message); }
  }
  if (t.dataset.budget && S.edit?.type === 'account') {
    const amount = t.value.trim() ? parseMoney(t.value) : null;
    try {
      await api('/api/budgets', { method: 'PUT', body: { account_id: S.edit.id, category_id: t.dataset.budget, amount } });
      S.boot.budgets = (S.boot.budgets || []).filter((b) => !(b.account_id === S.edit.id && b.category_id === t.dataset.budget));
      if (amount && amount > 0) S.boot.budgets.push({ account_id: S.edit.id, category_id: t.dataset.budget, amount });
      local.set('b.boot', S.boot);
      t.value = minorToInput(amount);
      render();
    } catch (e) { toast(e.message); }
  }
});

document.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const data = Object.fromEntries(new FormData(form));
  const btn = form.querySelector('button[type=submit]');
  if (btn) btn.disabled = true;
  try {
    if (form.id === 'invite-form') await signUp(data.name, data.invite);
    if (form.id === 'account-quick') {
      await api('/api/accounts', { method: 'POST', body: { name: data.name, currency: data.currency } });
      await loadBoot();
      S.onboarding = true;
      local.set('b.onboarding', true);
      render();
      $('#account-quick input[name=name]')?.focus();
    }
  } catch (e) {
    if (form.id === 'invite-form') showAuthError(e.message); else toast(e.message);
  }
  if (btn) btn.disabled = false;
});

sheet().addEventListener('close', () => { S.edit = null; S.review = null; });
window.addEventListener('hashchange', () => { if (route() !== 'activity') S.filter = { kind: 'all', category: null }; render(); window.scrollTo(0, 0); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });

// ---------------------------------------------------------------- start

render();
if (S.token) refresh();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* app still works without it */ });
}
