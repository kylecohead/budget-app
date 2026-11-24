// Budget is closed to everyone except its owner (the account made with the first invite).
// Friends who open the app see a short message asking them to delete it, can't sign up or
// log payments, and can delete their own data. Their data stays until they do.
// To let friends back in: set FRIENDS_CLOSED to false, then run ./setup.sh.
import { json } from './util.js';

export const FRIENDS_CLOSED = true;

export const isClosedFor = (user) => FRIENDS_CLOSED && !!user && !user.is_admin;

export async function closedMessage(env) {
  const owner = await env.DB.prepare('SELECT name FROM users WHERE is_admin = 1 ORDER BY created_at LIMIT 1').first('name');
  return `${owner || 'The owner'} isn’t happy with how Budget is performing and has closed it. Please delete it from your phone.`;
}

export async function closedResponse(env) {
  return json({ error: await closedMessage(env), closed: true }, 403);
}

export class ClosedError extends Error {
  constructor() { super('Budget is closed.'); }
}

// Stops a friend's request here; the server answers with the closing message.
export function assertOpen(user) {
  if (isClosedFor(user)) throw new ClosedError();
}
