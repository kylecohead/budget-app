# Budget

A small, fast budgeting app for iPhone. You pay with Apple Pay, a menu of your categories pops up, and one tap files the payment. At the end of the month, the app shows what you spent in each category, per bank account or across all of them, in rand or dollars.

- **Web app** (`web/`): plain HTML, CSS and JavaScript with no framework, hosted free on GitHub Pages. Add it to your Home Screen and it opens like an app, even with bad signal.
- **API and database** (`api/`): a Cloudflare Worker with a D1 database, on Cloudflare's free plan.
- **Sign-in**: passkeys (Face ID). There are no passwords, and new people can only join with an invite code.
- **Apple Pay**: an iPhone Shortcut that runs when you tap a Wallet card and sends the amount, shop and card to your personal link.

```
 Tap to pay ──► Shortcut (Wallet automation) ──► POST /w/<your key> ──► payment saved
                     │                                                    │
                     └── shows your category menu ◄── list of categories ◄┘
                     └── your tap ──────────────────► category saved (and remembered for that shop)
```

## What you need

- A **GitHub** account and the GitHub CLI (`brew install gh`).
- A free **Cloudflare** account: sign up at https://dash.cloudflare.com/sign-up.
- **Node.js 22 or newer**: https://nodejs.org

## Set up (once)

In Terminal on your Mac:

```sh
cd ~/Desktop/budget-app
./setup.sh
```

The script does the following:

1. Signs you in to GitHub and Cloudflare. A browser window opens for each; click Allow.
2. Creates the database (`budget-db`) and its tables.
3. Deploys the API to `https://budget-api.<your-name>.workers.dev`.
4. Prints your first **invite code**. It makes you the owner, which lets you invite friends.
5. Creates a **public** GitHub repo called `budget-app`, switches on GitHub Pages and pushes. The code is public. Your data never goes into the repo.

If you already have a repo called `budget-app`, run `REPO_NAME=my-budget ./setup.sh` instead.

When it finishes, it prints your app's address, for example `https://yourname.github.io/budget-app/`.

## On your iPhone

1. Open the address in **Safari**, tap **I have an invite code**, and enter your name and the code. Face ID creates your passkey.
2. Add your accounts (e.g. Investec ZAR, Discovery ZAR, Bank of America USD), then tap **Done**.
3. Tap **Share → Add to Home Screen**.
4. Go to **Settings → Apple Pay Shortcut → Create my personal link**. Then either:
   - **Quickest (iOS 27):** tap **Copy description**, open Shortcuts, tap **+** and paste it. Siri builds the Shortcut for you.
   - **Step by step:** follow the guide on the same screen.
5. Pay for something with Apple Pay. A pop-up shows the amount, shop and account at the top, with your categories underneath. **One tap on a category saves it.** At the bottom is one extra line:
   - **→ Edit or don't log…**: opens a page where you can fix the amount, account, shop or note first, for example when you paid for a friend who'll pay you back. That page also has **Don't log this**.

The first time a new card is used, **Activity** asks once which account it belongs to. That question is separate from "Needs a category". A small red number on the Activity tab shows when something needs you.

If a payment slips through, for example because you dismissed the menu or the Wallet trigger didn't fire, it waits under **Activity → Needs a category**. Tap **Review** to sort it out, or **Skip** to leave it without a category.

Budgets are set per account under **Settings → Accounts**. Leave a category empty for no budget. The **Total** view adds up all accounts and converts them at **today's** exchange rate (European Central Bank rates via Frankfurter).

## Invite friends

**Settings → Invite a friend** creates a one-time code and a message to send. Each friend gets their own private budget, accounts, categories and Shortcut link. They can't see yours, and you can't see theirs in the app. As the owner of the Cloudflare account you could technically read the database, so it's worth telling them that. No bank logins are ever stored, only the amount, shop and card name from each tap.

## Making changes

- **App** (`web/`): commit and `git push`. GitHub publishes it in about a minute, and phones pick up the new version the next time the app is opened.
- **API** (`api/`): `cd api && npx wrangler deploy`, or just run `./setup.sh` again.
- **Database changes**: edit `api/schema.sql`, then `npx wrangler d1 execute budget-db --remote --file=schema.sql`.

## Run it on your Mac

```sh
cd api
cp .dev.vars.example .dev.vars          # local passkeys need "localhost"
npm install
npx wrangler d1 execute budget-db --local --file=schema.sql
npx wrangler d1 execute budget-db --local --command "INSERT INTO invites (code, make_admin, created_at) VALUES ('TEST-CODE', 1, 0)"
npm run dev                              # API on http://localhost:8787
```

In a second Terminal window:

```sh
cd web
echo "window.BUDGET_CONFIG = { api: 'http://localhost:8787' };" > config.js   # don't commit this
python3 -m http.server 8788              # open http://localhost:8788
```

## Project layout

```
api/
  src/index.js     routes: accounts, categories, budgets, payments, invites, exchange rates, Apple Pay Shortcut
  src/auth.js      passkey sign-up and sign-in, sessions, invites
  src/util.js      helpers, including reading amounts like "R 1 234,50" or "$12.50"
  schema.sql       database tables
  wrangler.toml    Cloudflare settings (setup.sh fills these in)
web/
  index.html  styles.css  app.js     the whole app
  sw.js                              keeps the app on the phone so it opens instantly
  config.js                          the API's address (written by setup.sh)
setup.sh                             one-command setup and deploy
.github/workflows/pages.yml          publishes web/ to GitHub Pages
```

## Costs and limits

Everything runs on free plans. Cloudflare's free Workers plan allows 100,000 requests a day, and D1 allows 5 GB of storage, which is far more than a group of friends logging payments will use. GitHub Pages is free for public repos.

## If something isn't working

- **The menu doesn't pop up when I pay.** Check that **Settings › Apps › Wallet › Mobile Data** is on, that the Shortcut's Wallet automation is switched on with all your cards selected, and that asking or notifying before running is off. Apple's Wallet trigger is sometimes late or skips a payment. Anything it misses can be added with **+**.
- **"Amount missing".** Apple Pay sometimes sends no amount. Pick **→ Edit or don't log…** in the pop-up, or tap the payment in the app later, and type it in.
- **"New card" in Activity.** Apple sent a card name the app hadn't seen before. Tap the account it belongs to. The app remembers it, and moves that card's earlier payments too. You can also add card names under **Settings → Accounts**.
- **Where's my Shortcut link?** In the app, go to **Settings → Apple Pay Shortcut**.
- **Passkey errors.** Use Safari and the GitHub Pages address that setup printed. Passkeys only work from that exact address.
