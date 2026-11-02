# Expense Manager

A chat-based personal expense manager. Log spending by typing it the way you'd say it:

> 25 rupees for tea today
> auto 80, lunch 150
> paid 45000 school fees yesterday

Claude reads each message and records the amount, category, date and description. Every logged
expense appears as a card you can edit or undo. Large irregular expenses (school fees, annual
premiums, big purchases) are flagged as **one-off**, so later reports can show averages both with
and without them.

Works on phones (installable to the home screen) and desktop browsers.

## What you can ask

| You type | What happens |
| --- | --- |
| `25 rupees for tea today`, `auto 80, lunch 150` | Logs the expenses with a category and date |
| `change yesterday's tea to 30`, `that was transport`, `delete the last one`, `school fees isn't a one-off` | Fixes existing entries |
| `this month so far`, `weekly average this month`, `monthly average this year`, `top category this year` | Report card: averages with and without one-offs, trend chart, category breakdown |
| `monthly average without school fees`, `average excluding education` | Same report, leaving those items or categories out |
| `where can I cut back?`, `cheaper options for groceries?` | Smart advice based on your actual spending |

The **History** page lists every expense by month with totals, and any entry can be edited there.

## Deploy on Vercel

1. Import this repo in Vercel (**Add New → Project**).
2. In the project's **Storage** tab, add a **Neon** Postgres database and connect it. This sets `DATABASE_URL`.
3. In **Settings → Environment Variables**, add:
   - `ANTHROPIC_API_KEY`: your key from console.anthropic.com
   - `APP_PASSWORD`: the passcode you'll sign in with
   - `AUTH_SECRET`: a long random string (`openssl rand -hex 32`)
4. Redeploy. Tables are created automatically on first use.

See `.env.example` for optional settings (model, advice model, city for local tips, timezone, currency).

## Run locally

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

## How it works

- `src/lib/assistant.ts`: sends the message (plus a few recent turns for context) to Claude with a
  structured-output schema. It returns new expenses, edits, deletions, and a report or advice request. The app computes report numbers itself, so the AI never does arithmetic.
- `src/lib/reports.ts`: report maths (averages with and without one-offs, exclusions, trend buckets). Checked by `npm run check`.
- `src/lib/advice.ts`: builds the spending summary that the advice prompt sees (aggregates only).
- `src/lib/db.ts`: Postgres access through the Neon serverless driver. Tables: `expenses`, `chat_messages`.
- `src/app/api/*`: chat, history, expense edit/delete, login/logout routes.
- `src/middleware.ts`: everything except the login page requires the signed session cookie.
