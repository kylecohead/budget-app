// Budget API — runs on Cloudflare Workers with a D1 database.
import {
  HttpError, json, text, readJson, now, newId, randomToken, sha256, inviteCode,
  cleanCurrency, cleanText, parseAmount, merchantKey, toInt,
} from './util.js';
import {
  registerOptions, registerVerify, loginOptions, loginVerify, logout,
  userFromSession, userFromShortcutKey,
} from './auth.js';

const ICONS = ['cart', 'dining', 'social', 'fitness', 'toiletries', 'transport', 'clothing', 'gift',
  'health', 'home', 'bills', 'travel', 'fun', 'kids', 'pets', 'education', 'salary', 'paidback', 'other'];

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let response;
    try {
      response = await route(request, env, new URL(request.url));
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e && e.stack || e);
      response = json({ error: e instanceof HttpError ? e.message : 'Something went wrong on the server.' },
        e instanceof HttpError ? e.status : 500);
    }
    for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
    return response;
  },
};

function corsHeaders(request, env) {
  const origin = request.headers.get('origin');
  const allowed = String(env.APP_ORIGIN || '').split(',').map((s) => s.trim());
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

async function route(request, env, url) {
  const method = request.method;
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const path = '/' + parts.join('/');

  if (path === '/') return text('Budget API is running.');

  // Apple Pay Shortcut: /w/<personal key>
  if (parts[0] === 'w' && parts.length === 2) {
    if (method === 'POST') return wallet(request, env, parts[1]);
    if (method === 'GET') {
      const user = await userFromShortcutKey(env, parts[1]);
      return text(user ? `This link works. Payments will be saved for ${user.name}.` : 'This link is not valid.', user ? 200 : 404);
    }
  }

  if (parts[0] === 'auth' && method === 'POST') {
    const body = await readJson(request);
    if (path === '/auth/register/options') return registerOptions(request, env, body);
    if (path === '/auth/register/verify') return registerVerify(request, env, body);
    if (path === '/auth/login/options') return loginOptions(request, env);
    if (path === '/auth/login/verify') return loginVerify(request, env, body);
    if (path === '/auth/logout') return logout(request, env);
  }

  if (parts[0] === 'api') {
    const user = await userFromSession(request, env);
    const body = ['POST', 'PATCH', 'PUT'].includes(method) ? await readJson(request) : {};
    const [, resource, id] = parts;
    const key = `${method} ${resource}${id ? '/:id' : ''}`;
    switch (key) {
      case 'GET bootstrap': return bootstrap(env, user);
      case 'PATCH me': return updateMe(env, user, body);
      case 'DELETE me': return deleteMe(env, user);
      case 'POST accounts': return createAccount(env, user, body);
      case 'PATCH accounts/:id': return updateAccount(env, user, id, body);
      case 'POST categories': return createCategory(env, user, body);
      case 'POST categories/:id': if (id === 'order') return orderCategories(env, user, body); break;
      case 'PATCH categories/:id': return updateCategory(env, user, id, body);
      case 'PUT budgets': return setBudget(env, user, body);
      case 'GET transactions': return listTransactions(env, user, url);
      case 'POST transactions': return createTransaction(env, user, body);
      case 'PATCH transactions/:id': return updateTransaction(env, user, id, body);
      case 'DELETE transactions/:id': return deleteTransaction(env, user, id);
      case 'POST shortcut-key': return newShortcutKey(env, user);
      case 'GET invites': return listInvites(env, user);
      case 'POST invites': return createInvite(env, user);
      case 'GET rates': return json(await getRates(env));
    }
  }
  throw new HttpError(404, 'Not found.');
}

// ---------- loading everything the app needs in one go ----------

async function bootstrap(env, user) {
  const [accounts, categories, budgets, rates] = await Promise.all([
    env.DB.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY sort, created_at').bind(user.id).all(),
    env.DB.prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY kind, sort').bind(user.id).all(),
    env.DB.prepare('SELECT account_id, category_id, amount FROM budgets WHERE user_id = ?').bind(user.id).all(),
    getRates(env),
  ]);
  return json({
    user: publicUser(user),
    accounts: accounts.results.map(publicAccount),
    categories: categories.results,
    budgets: budgets.results,
    rates,
  });
}

const publicUser = (u) => ({
  id: u.id, name: u.name, is_admin: !!u.is_admin, display_currency: u.display_currency,
  has_shortcut_key: !!u.shortcut_key_hash,
});

const publicAccount = (a) => ({ ...a, cards: JSON.parse(a.cards || '[]'), archived: !!a.archived });

async function updateMe(env, user, body) {
  const name = body.name !== undefined ? cleanText(body.name, 60) : user.name;
  const currency = body.display_currency !== undefined ? cleanCurrency(body.display_currency) : user.display_currency;
  if (!name) throw new HttpError(400, 'Enter a name.');
  if (!currency) throw new HttpError(400, 'Choose a currency.');
  await env.DB.prepare('UPDATE users SET name = ?, display_currency = ? WHERE id = ?').bind(name, currency, user.id).run();
  return json({ user: publicUser({ ...user, name, display_currency: currency }) });
}

async function deleteMe(env, user) {
  const tables = ['transactions', 'budgets', 'merchant_memory', 'accounts', 'categories', 'sessions', 'credentials'];
  await env.DB.batch([
    ...tables.map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(user.id)),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);
  return json({ ok: true });
}

// ---------- accounts, categories, budgets ----------

async function ownAccount(env, user, id) {
  if (!id) return null;
  const a = await env.DB.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').bind(id, user.id).first();
  if (!a) throw new HttpError(400, 'That account doesn’t exist.');
  return a;
}

async function ownCategory(env, user, id) {
  if (!id) return null;
  const c = await env.DB.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').bind(id, user.id).first();
  if (!c) throw new HttpError(400, 'That category doesn’t exist.');
  return c;
}

const cleanCards = (cards) => (Array.isArray(cards) ? cards : [])
  .map((c) => cleanText(c, 80)).filter(Boolean).slice(0, 20);

async function createAccount(env, user, body) {
  const name = cleanText(body.name, 40);
  const currency = cleanCurrency(body.currency);
  if (!name) throw new HttpError(400, 'Give the account a name.');
  if (!currency) throw new HttpError(400, 'Choose the account’s currency.');
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM accounts WHERE user_id = ?').bind(user.id).first('n');
  const account = { id: newId(), user_id: user.id, name, currency, cards: JSON.stringify(cleanCards(body.cards)), sort: count, archived: 0, created_at: now() };
  await env.DB.prepare('INSERT INTO accounts (id, user_id, name, currency, cards, sort, archived, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(account.id, user.id, name, currency, account.cards, account.sort, 0, account.created_at).run();
  if (count === 0) {
    await env.DB.prepare('UPDATE users SET display_currency = ? WHERE id = ?').bind(currency, user.id).run();
  }
  return json({ account: publicAccount(account) });
}

async function updateAccount(env, user, id, body) {
  const a = await ownAccount(env, user, id);
  const name = body.name !== undefined ? cleanText(body.name, 40) : a.name;
  const currency = body.currency !== undefined ? cleanCurrency(body.currency) : a.currency;
  const cards = body.cards !== undefined ? JSON.stringify(cleanCards(body.cards)) : a.cards;
  const sort = body.sort !== undefined ? toInt(body.sort) ?? a.sort : a.sort;
  const archived = body.archived !== undefined ? (body.archived ? 1 : 0) : a.archived;
  if (!name) throw new HttpError(400, 'Give the account a name.');
  if (!currency) throw new HttpError(400, 'Choose the account’s currency.');
  await env.DB.prepare('UPDATE accounts SET name = ?, currency = ?, cards = ?, sort = ?, archived = ? WHERE id = ?')
    .bind(name, currency, cards, sort, archived, id).run();
  return json({ account: publicAccount({ ...a, name, currency, cards, sort, archived }) });
}

async function createCategory(env, user, body) {
  const name = cleanText(body.name, 40);
  const kind = body.kind === 'income' ? 'income' : 'expense';
  const icon = ICONS.includes(body.icon) ? body.icon : 'other';
  if (!name) throw new HttpError(400, 'Give the category a name.');
  const sort = await env.DB.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM categories WHERE user_id = ? AND kind = ?')
    .bind(user.id, kind).first('n');
  const category = { id: newId(), user_id: user.id, name, kind, icon, sort, archived: 0 };
  await env.DB.prepare('INSERT INTO categories (id, user_id, name, kind, icon, sort, archived) VALUES (?, ?, ?, ?, ?, ?, 0)')
    .bind(category.id, user.id, name, kind, icon, sort).run();
  return json({ category });
}

async function updateCategory(env, user, id, body) {
  const c = await ownCategory(env, user, id);
  const name = body.name !== undefined ? cleanText(body.name, 40) : c.name;
  const icon = body.icon !== undefined ? (ICONS.includes(body.icon) ? body.icon : c.icon) : c.icon;
  const archived = body.archived !== undefined ? (body.archived ? 1 : 0) : c.archived;
  if (!name) throw new HttpError(400, 'Give the category a name.');
  await env.DB.prepare('UPDATE categories SET name = ?, icon = ?, archived = ? WHERE id = ?').bind(name, icon, archived, id).run();
  return json({ category: { ...c, name, icon, archived } });
}

async function orderCategories(env, user, body) {
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 200) : [];
  await env.DB.batch(ids.map((id, i) =>
    env.DB.prepare('UPDATE categories SET sort = ? WHERE id = ? AND user_id = ?').bind(i, id, user.id)));
  return json({ ok: true });
}

async function setBudget(env, user, body) {
  await ownAccount(env, user, body.account_id);
  await ownCategory(env, user, body.category_id);
  const amount = body.amount === null || body.amount === '' ? null : toInt(body.amount);
  if (amount === null || amount <= 0) {
    await env.DB.prepare('DELETE FROM budgets WHERE account_id = ? AND category_id = ?').bind(body.account_id, body.category_id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO budgets (account_id, category_id, user_id, amount) VALUES (?, ?, ?, ?)
       ON CONFLICT (account_id, category_id) DO UPDATE SET amount = excluded.amount`,
    ).bind(body.account_id, body.category_id, user.id, amount).run();
  }
  return json({ ok: true });
}

// ---------- transactions ----------

async function listTransactions(env, user, url) {
  const from = toInt(url.searchParams.get('from')) ?? 0;
  const to = toInt(url.searchParams.get('to')) ?? now() + 86_400_000;
  const rows = await env.DB.prepare(
    `SELECT id, kind, account_id, to_account_id, amount, currency, to_amount, to_currency, category_id,
            merchant, card, note, source, original_amount, occurred_at, created_at
     FROM transactions WHERE user_id = ? AND occurred_at >= ? AND occurred_at < ?
     ORDER BY occurred_at DESC LIMIT 5000`,
  ).bind(user.id, from, to).all();
  return json({ transactions: rows.results });
}

async function rememberMerchant(env, user, merchant, categoryId) {
  const key = merchantKey(merchant);
  if (!key || !categoryId) return;
  await env.DB.prepare(
    `INSERT INTO merchant_memory (user_id, merchant_key, category_id, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, merchant_key) DO UPDATE SET category_id = excluded.category_id, updated_at = excluded.updated_at`,
  ).bind(user.id, key, categoryId, now()).run();
}

async function learnCard(env, account, card) {
  if (!account || !card) return;
  const cards = JSON.parse(account.cards || '[]');
  if (cards.some((c) => c.toLowerCase() === card.toLowerCase())) return;
  cards.push(card);
  await env.DB.prepare('UPDATE accounts SET cards = ? WHERE id = ?').bind(JSON.stringify(cards.slice(-20)), account.id).run();
}

async function cleanTransaction(env, user, body, existing = {}) {
  const pick = (k) => (body[k] !== undefined ? body[k] : existing[k]);
  const kind = pick('kind');
  if (!['expense', 'income', 'transfer'].includes(kind)) throw new HttpError(400, 'Choose expense, income or transfer.');
  const account = await ownAccount(env, user, pick('account_id'));
  const amount = toInt(pick('amount'));
  if (amount === null) throw new HttpError(400, 'Enter an amount.');
  if (kind !== 'expense' && amount <= 0) throw new HttpError(400, 'The amount must be more than zero.');
  const currency = cleanCurrency(pick('currency')) || (account && account.currency) || user.display_currency;
  const t = {
    kind,
    account_id: account ? account.id : null,
    amount,
    currency,
    category_id: null,
    to_account_id: null,
    to_amount: null,
    to_currency: null,
    merchant: cleanText(pick('merchant'), 120),
    note: cleanText(pick('note'), 500),
    occurred_at: toInt(pick('occurred_at')) || now(),
  };
  if (kind === 'transfer') {
    if (!account) throw new HttpError(400, 'Choose the account the money came from.');
    const to = await ownAccount(env, user, pick('to_account_id'));
    if (!to) throw new HttpError(400, 'Choose the account the money went to.');
    if (to.id === account.id) throw new HttpError(400, 'Choose two different accounts.');
    t.to_account_id = to.id;
    t.to_currency = to.currency;
    const toAmount = toInt(pick('to_amount'));
    if (toAmount && toAmount > 0) t.to_amount = toAmount;
    else if (to.currency === currency) t.to_amount = amount;
    else {
      const { rates } = await getRates(env);
      t.to_amount = rates[currency] && rates[to.currency] ? Math.round((amount / rates[currency]) * rates[to.currency]) : null;
    }
    if (!t.to_amount) throw new HttpError(400, 'Enter how much arrived in the other account.');
  } else {
    const cat = await ownCategory(env, user, pick('category_id'));
    if (cat && cat.kind !== kind) throw new HttpError(400, 'That category doesn’t match the type.');
    t.category_id = cat ? cat.id : null;
  }
  return { t, account };
}

async function createTransaction(env, user, body) {
  const { t } = await cleanTransaction(env, user, body);
  const id = newId();
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO transactions (id, user_id, kind, account_id, to_account_id, amount, currency, to_amount, to_currency,
       category_id, merchant, note, source, occurred_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?)`,
  ).bind(id, user.id, t.kind, t.account_id, t.to_account_id, t.amount, t.currency, t.to_amount, t.to_currency,
    t.category_id, t.merchant, t.note, t.occurred_at, ts, ts).run();
  if (t.category_id && t.merchant) await rememberMerchant(env, user, t.merchant, t.category_id);
  return json({ transaction: { id, ...t, source: 'manual', created_at: ts } });
}

async function updateTransaction(env, user, id, body) {
  const existing = await env.DB.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').bind(id, user.id).first();
  if (!existing) throw new HttpError(404, 'That payment no longer exists.');
  const { t, account } = await cleanTransaction(env, user, body, existing);
  const original = existing.original_amount ?? (existing.source === 'wallet' && t.amount !== existing.amount ? existing.amount : null);
  await env.DB.prepare(
    `UPDATE transactions SET kind = ?, account_id = ?, to_account_id = ?, amount = ?, currency = ?, to_amount = ?,
       to_currency = ?, category_id = ?, merchant = ?, note = ?, original_amount = ?, occurred_at = ?, updated_at = ?
     WHERE id = ?`,
  ).bind(t.kind, t.account_id, t.to_account_id, t.amount, t.currency, t.to_amount, t.to_currency, t.category_id,
    t.merchant, t.note, original, t.occurred_at, now(), id).run();
  if (t.category_id && t.category_id !== existing.category_id && t.merchant) await rememberMerchant(env, user, t.merchant, t.category_id);
  if (account && existing.card && account.id !== existing.account_id) await learnCard(env, account, existing.card);
  return json({ transaction: { ...existing, ...t, original_amount: original } });
}

async function deleteTransaction(env, user, id) {
  await env.DB.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').bind(id, user.id).run();
  return json({ ok: true });
}

// ---------- Shortcut link, invites ----------

async function newShortcutKey(env, user) {
  const key = 'k_' + randomToken(24);
  await env.DB.prepare('UPDATE users SET shortcut_key_hash = ? WHERE id = ?').bind(await sha256(key), user.id).run();
  return json({ key });
}

async function listInvites(env, user) {
  if (!user.is_admin) throw new HttpError(403, 'Only the app’s owner can see invites.');
  const rows = await env.DB.prepare(
    `SELECT i.code, i.created_at, i.used_at, u.name AS used_by_name FROM invites i
     LEFT JOIN users u ON u.id = i.used_by WHERE i.make_admin = 0 ORDER BY i.created_at DESC LIMIT 100`,
  ).all();
  return json({ invites: rows.results });
}

async function createInvite(env, user) {
  if (!user.is_admin) throw new HttpError(403, 'Only the app’s owner can create invites.');
  const code = inviteCode();
  await env.DB.prepare('INSERT INTO invites (code, created_by, make_admin, created_at) VALUES (?, ?, 0, ?)')
    .bind(code, user.id, now()).run();
  return json({ invite: { code, created_at: now(), used_at: null, used_by_name: null } });
}

// ---------- exchange rates (today's, against USD) ----------

async function getRates(env) {
  const day = new Date().toISOString().slice(0, 10);
  const cached = await env.DB.prepare('SELECT * FROM fx_rates WHERE day = ?').bind(day).first();
  if (cached) return { day, base: cached.base, rates: JSON.parse(cached.rates), source_date: JSON.parse(cached.rates)._date || day };
  try {
    const res = await fetch('https://api.frankfurter.dev/v1/latest?base=USD', { cf: { cacheTtl: 3600 } });
    if (!res.ok) throw new Error('rates ' + res.status);
    const data = await res.json();
    const rates = { ...data.rates, USD: 1, _date: data.date };
    await env.DB.prepare('INSERT OR REPLACE INTO fx_rates (day, base, rates, fetched_at) VALUES (?, ?, ?, ?)')
      .bind(day, 'USD', JSON.stringify(rates), now()).run();
    return { day, base: 'USD', rates, source_date: data.date };
  } catch (e) {
    console.error('rates', e && e.message);
    const last = await env.DB.prepare('SELECT * FROM fx_rates ORDER BY day DESC LIMIT 1').first();
    if (last) {
      const rates = JSON.parse(last.rates);
      return { day: last.day, base: 'USD', rates, source_date: rates._date || last.day, stale: true };
    }
    return { day: null, base: 'USD', rates: { USD: 1 }, stale: true };
  }
}

// ---------- the Apple Pay Shortcut ----------
//
// The Shortcut posts three kinds of message to /w/<key>:
//   1. { amount, merchant, card }  → saves the payment, replies with the menu (a JSON list)
//   2. { choice }                  → applies the menu choice; replies "" when done, or a
//                                    question ("New amount" / "Note") when it needs an answer
//   3. { answer }                  → applies the answer, replies with the category list
// Anything unexpected replies "" so the Shortcut simply ends; the payment stays in the app.

const CHANGE_AMOUNT = 'Change amount…';
const ADD_NOTE = 'Add a note…';
const DONT_LOG = 'Don’t log this';
const USUAL = ' (usual)';

async function wallet(request, env, key) {
  const user = await userFromShortcutKey(env, key);
  if (!user) return text('This Shortcut link isn’t valid any more. Copy a new one from the app’s Settings.', 401);
  const body = await readJson(request);
  if (body.choice !== undefined) return walletChoice(env, user, body.choice);
  if (body.answer !== undefined) return walletAnswer(env, user, body.answer);
  return walletPayment(env, user, body);
}

async function expenseCategories(env, user) {
  const rows = await env.DB.prepare(
    "SELECT * FROM categories WHERE user_id = ? AND kind = 'expense' AND archived = 0 ORDER BY sort",
  ).bind(user.id).all();
  return rows.results;
}

async function menuFor(env, user, merchant, { extras, amountMissing }) {
  const cats = await expenseCategories(env, user);
  const key = merchantKey(merchant);
  const usual = key
    ? await env.DB.prepare('SELECT category_id FROM merchant_memory WHERE user_id = ? AND merchant_key = ?').bind(user.id, key).first('category_id')
    : null;
  const usualCat = cats.find((c) => c.id === usual);
  const names = cats.filter((c) => c !== usualCat).map((c) => c.name);
  const items = usualCat ? [usualCat.name + USUAL, ...names] : names;
  if (!extras) return items;
  return amountMissing ? [CHANGE_AMOUNT, ...items, ADD_NOTE, DONT_LOG] : [...items, CHANGE_AMOUNT, ADD_NOTE, DONT_LOG];
}

function matchAccount(accounts, card) {
  if (!card) return accounts.length === 1 ? accounts[0] : null;
  const c = card.toLowerCase();
  return accounts.find((a) => JSON.parse(a.cards || '[]').some((x) => x.toLowerCase() === c))
    || accounts.find((a) => c.includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(c))
    || accounts.find((a) => a.name.toLowerCase().split(/\s+/).some((w) => w.length > 3 && c.includes(w)))
    || null;
}

async function walletPayment(env, user, body) {
  const accounts = (await env.DB.prepare('SELECT * FROM accounts WHERE user_id = ? AND archived = 0').bind(user.id).all()).results;
  const card = cleanText(body.card, 80);
  const merchant = cleanText(body.merchant, 120) || cleanText(body.name, 120);
  const parsed = parseAmount(body.amount);
  const account = matchAccount(accounts, card);
  const currency = (parsed && parsed.currency) || (account && account.currency) || user.display_currency;
  const id = newId();
  const t = now();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO transactions (id, user_id, kind, account_id, amount, currency, merchant, card, source, raw,
         occurred_at, created_at, updated_at)
       VALUES (?, ?, 'expense', ?, ?, ?, ?, ?, 'wallet', ?, ?, ?, ?)`,
    ).bind(id, user.id, account ? account.id : null, parsed ? parsed.minor : 0, currency, merchant, card,
      JSON.stringify(body).slice(0, 2000), t, t, t),
    env.DB.prepare('UPDATE users SET pending_tx_id = ?, pending_ask = NULL WHERE id = ?').bind(id, user.id),
  ]);
  return json(await menuFor(env, user, merchant, { extras: true, amountMissing: !parsed || parsed.minor === 0 }));
}

async function pendingTx(env, user) {
  if (!user.pending_tx_id) return null;
  const tx = await env.DB.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').bind(user.pending_tx_id, user.id).first();
  if (!tx || now() - tx.created_at > 30 * 60_000) return null;
  return tx;
}

async function walletChoice(env, user, rawChoice) {
  const tx = await pendingTx(env, user);
  if (!tx) return text('');
  const choice = String(rawChoice || '').trim();
  if (choice === DONT_LOG) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(tx.id),
      env.DB.prepare('UPDATE users SET pending_tx_id = NULL, pending_ask = NULL WHERE id = ?').bind(user.id),
    ]);
    return text('');
  }
  if (choice === CHANGE_AMOUNT || choice === ADD_NOTE) {
    const ask = choice === CHANGE_AMOUNT ? 'amount' : 'note';
    await env.DB.prepare('UPDATE users SET pending_ask = ? WHERE id = ?').bind(ask, user.id).run();
    return text(ask === 'amount' ? 'What amount should be logged?' : 'Add a note');
  }
  const name = choice.endsWith(USUAL) ? choice.slice(0, -USUAL.length) : choice;
  const cat = (await expenseCategories(env, user)).find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (!cat) return text('');
  await env.DB.batch([
    env.DB.prepare('UPDATE transactions SET category_id = ?, updated_at = ? WHERE id = ?').bind(cat.id, now(), tx.id),
    env.DB.prepare('UPDATE users SET pending_tx_id = NULL, pending_ask = NULL WHERE id = ?').bind(user.id),
  ]);
  await rememberMerchant(env, user, tx.merchant, cat.id);
  return text('');
}

async function walletAnswer(env, user, answer) {
  const tx = await pendingTx(env, user);
  if (tx && user.pending_ask === 'amount') {
    const parsed = parseAmount(answer);
    if (parsed && parsed.minor !== 0) {
      await env.DB.prepare('UPDATE transactions SET amount = ?, original_amount = COALESCE(original_amount, ?), updated_at = ? WHERE id = ?')
        .bind(parsed.minor, tx.amount, now(), tx.id).run();
    }
  } else if (tx && user.pending_ask === 'note') {
    await env.DB.prepare('UPDATE transactions SET note = ?, updated_at = ? WHERE id = ?').bind(cleanText(answer, 500), now(), tx.id).run();
  }
  await env.DB.prepare('UPDATE users SET pending_ask = NULL WHERE id = ?').bind(user.id).run();
  return json(await menuFor(env, user, tx && tx.merchant, { extras: false }));
}
