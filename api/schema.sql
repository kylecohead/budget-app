-- Budget app database (Cloudflare D1 / SQLite).
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  is_admin          INTEGER NOT NULL DEFAULT 0,
  display_currency  TEXT NOT NULL DEFAULT 'ZAR',
  shortcut_key_hash TEXT,
  pending_tx_id     TEXT,      -- the Apple Pay payment the Shortcut is busy with
  pending_ask       TEXT,      -- 'amount' | 'note' while the Shortcut waits for an answer
  created_at        INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_shortcut_key ON users(shortcut_key_hash);

CREATE TABLE IF NOT EXISTS credentials (
  id          TEXT PRIMARY KEY,              -- passkey credential id (base64url)
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key  TEXT NOT NULL,                 -- base64url COSE public key
  counter     INTEGER NOT NULL DEFAULT 0,
  transports  TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS credentials_user ON credentials(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS challenges (
  id          TEXT PRIMARY KEY,
  challenge   TEXT NOT NULL,
  data        TEXT,
  expires_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invites (
  code        TEXT PRIMARY KEY,
  created_by  TEXT,
  make_admin  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  used_by     TEXT,
  used_at     INTEGER
);

CREATE TABLE IF NOT EXISTS accounts (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  currency    TEXT NOT NULL,
  cards       TEXT NOT NULL DEFAULT '[]',    -- JSON list of Wallet card names that belong to this account
  sort        INTEGER NOT NULL DEFAULT 0,
  archived    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS accounts_user ON accounts(user_id);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
  icon        TEXT NOT NULL DEFAULT 'other',
  sort        INTEGER NOT NULL DEFAULT 0,
  archived    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS categories_user ON categories(user_id);

-- Monthly budget for one category in one account, in that account's currency (minor units).
CREATE TABLE IF NOT EXISTS budgets (
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  PRIMARY KEY (account_id, category_id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('expense', 'income', 'transfer')),
  account_id      TEXT,              -- for a transfer: the account money left
  to_account_id   TEXT,              -- transfers only
  amount          INTEGER NOT NULL,  -- minor units; a negative expense is a refund
  currency        TEXT NOT NULL,
  to_amount       INTEGER,           -- transfers only: amount that arrived
  to_currency     TEXT,
  category_id     TEXT,
  merchant        TEXT,
  card            TEXT,
  note            TEXT,
  source          TEXT NOT NULL DEFAULT 'manual',   -- 'manual' | 'wallet'
  original_amount INTEGER,           -- Apple Pay amount before you changed it
  raw             TEXT,              -- what the Shortcut sent, for troubleshooting
  occurred_at     INTEGER NOT NULL,  -- ms since epoch
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS transactions_user_time ON transactions(user_id, occurred_at);

-- Remembers the category you last picked for each shop.
CREATE TABLE IF NOT EXISTS merchant_memory (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_key TEXT NOT NULL,
  category_id  TEXT NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, merchant_key)
);

-- One row per day: exchange rates against USD.
CREATE TABLE IF NOT EXISTS fx_rates (
  day        TEXT PRIMARY KEY,
  base       TEXT NOT NULL,
  rates      TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);

-- One-time links for "Edit details…" in the Apple Pay pop-up (valid for 30 minutes).
CREATE TABLE IF NOT EXISTS edit_tokens (
  token_hash  TEXT PRIMARY KEY,
  tx_id       TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);

-- Your personal Shortcut link, so Settings can always show it again.
CREATE TABLE IF NOT EXISTS shortcut_links (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

-- Payments you skipped in "Review": they stay without a category but stop asking.
CREATE TABLE IF NOT EXISTS skipped (
  tx_id    TEXT PRIMARY KEY,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
