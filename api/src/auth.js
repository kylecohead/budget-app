// Passkey sign-up / sign-in, sessions and invites.
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { HttpError, json, now, newId, randomToken, sha256, b64url, fromB64url, cleanText } from './util.js';

const SESSION_DAYS = 400;
const CHALLENGE_MINUTES = 5;

const origins = (env) => String(env.APP_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);

// Everyone starts with these; each person can rename, reorder or add their own.
const DEFAULT_CATEGORIES = [
  ['Groceries', 'expense', 'cart'],
  ['Dining out', 'expense', 'dining'],
  ['Social', 'expense', 'social'],
  ['Sport & fitness', 'expense', 'fitness'],
  ['Toiletries', 'expense', 'toiletries'],
  ['Transport', 'expense', 'transport'],
  ['Clothing', 'expense', 'clothing'],
  ['Other', 'expense', 'other'],
  ['Gifts', 'expense', 'gift'],
  ['Health & beauty', 'expense', 'health'],
  ['Salary', 'income', 'salary'],
  ['Paid back', 'income', 'paidback'],
  ['Other income', 'income', 'other'],
];

async function saveChallenge(env, challenge, data) {
  const id = newId();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM challenges WHERE expires_at < ?').bind(now()),
    env.DB.prepare('INSERT INTO challenges (id, challenge, data, expires_at) VALUES (?, ?, ?, ?)')
      .bind(id, challenge, JSON.stringify(data || {}), now() + CHALLENGE_MINUTES * 60_000),
  ]);
  return id;
}

async function takeChallenge(env, id) {
  if (!id) throw new HttpError(400, 'Sign-in expired. Please try again.');
  const row = await env.DB.prepare('SELECT * FROM challenges WHERE id = ?').bind(id).first();
  await env.DB.prepare('DELETE FROM challenges WHERE id = ?').bind(id).run();
  if (!row || row.expires_at < now()) throw new HttpError(400, 'Sign-in expired. Please try again.');
  return { challenge: row.challenge, data: JSON.parse(row.data || '{}') };
}

async function createSession(env, userId) {
  const token = 's_' + randomToken(32);
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, now(), now() + SESSION_DAYS * 86_400_000).run();
  return token;
}

export async function userFromSession(request, env) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token.startsWith('s_')) throw new HttpError(401, 'Please sign in.');
  const user = await env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  ).bind(await sha256(token), now()).first();
  if (!user) throw new HttpError(401, 'Please sign in again.');
  return user;
}

export async function userFromShortcutKey(env, key) {
  if (!key || !key.startsWith('k_')) return null;
  return env.DB.prepare('SELECT * FROM users WHERE shortcut_key_hash = ?').bind(await sha256(key)).first();
}

async function findInvite(env, code) {
  const clean = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!clean) throw new HttpError(400, 'Enter your invite code.');
  const invite = await env.DB.prepare('SELECT * FROM invites WHERE code = ?').bind(clean).first();
  if (!invite || invite.used_by) throw new HttpError(400, 'That invite code isn’t valid or has already been used.');
  return invite;
}

export async function registerOptions(request, env, body) {
  const name = cleanText(body.name, 60);
  if (!name) throw new HttpError(400, 'Enter your name.');
  const invite = await findInvite(env, body.invite);
  const userId = newId();
  const options = await generateRegistrationOptions({
    rpName: env.RP_NAME || 'Budget',
    rpID: env.RP_ID,
    userName: name,
    userDisplayName: name,
    userID: new TextEncoder().encode(userId),
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  });
  const challengeId = await saveChallenge(env, options.challenge, { userId, name, invite: invite.code });
  return json({ challengeId, options });
}

export async function registerVerify(request, env, body) {
  const { challenge, data } = await takeChallenge(env, body.challengeId);
  const invite = await findInvite(env, data.invite);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origins(env),
      expectedRPID: env.RP_ID,
      requireUserVerification: false,
    });
  } catch (e) {
    throw new HttpError(400, 'Your passkey could not be checked: ' + e.message);
  }
  if (!verification.verified) throw new HttpError(400, 'Your passkey could not be checked.');
  const cred = verification.registrationInfo.credential;
  const t = now();
  const stmts = [
    env.DB.prepare('INSERT INTO users (id, name, is_admin, display_currency, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(data.userId, data.name, invite.make_admin ? 1 : 0, 'ZAR', t),
    env.DB.prepare('INSERT INTO credentials (id, user_id, public_key, counter, transports, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(cred.id, data.userId, b64url(cred.publicKey), cred.counter || 0, JSON.stringify(cred.transports || []), t),
    env.DB.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE code = ? AND used_by IS NULL')
      .bind(data.userId, t, invite.code),
    ...DEFAULT_CATEGORIES.map(([name, kind, icon], i) =>
      env.DB.prepare('INSERT INTO categories (id, user_id, name, kind, icon, sort) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(newId(), data.userId, name, kind, icon, i)),
  ];
  await env.DB.batch(stmts);
  const token = await createSession(env, data.userId);
  return json({ token });
}

export async function loginOptions(request, env) {
  const options = await generateAuthenticationOptions({ rpID: env.RP_ID, userVerification: 'preferred' });
  const challengeId = await saveChallenge(env, options.challenge, {});
  return json({ challengeId, options });
}

export async function loginVerify(request, env, body) {
  const { challenge } = await takeChallenge(env, body.challengeId);
  const credId = body.response && body.response.id;
  const row = credId
    ? await env.DB.prepare('SELECT * FROM credentials WHERE id = ?').bind(credId).first()
    : null;
  if (!row) throw new HttpError(400, 'This passkey isn’t linked to an account here. Ask for an invite to sign up.');
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origins(env),
      expectedRPID: env.RP_ID,
      requireUserVerification: false,
      credential: {
        id: row.id,
        publicKey: fromB64url(row.public_key),
        counter: row.counter,
        transports: JSON.parse(row.transports || '[]'),
      },
    });
  } catch (e) {
    throw new HttpError(400, 'Sign-in failed: ' + e.message);
  }
  if (!verification.verified) throw new HttpError(400, 'Sign-in failed.');
  await env.DB.prepare('UPDATE credentials SET counter = ? WHERE id = ?')
    .bind(verification.authenticationInfo.newCounter, row.id).run();
  const token = await createSession(env, row.user_id);
  return json({ token });
}

export async function logout(request, env) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return json({ ok: true });
}
