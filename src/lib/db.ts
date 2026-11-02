import { neon, neonConfig } from "@neondatabase/serverless";

// Local development hook: point the driver at a local SQL-over-HTTP proxy.
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;
import { isCategory, type Category } from "./categories";
import type { ChatMessage, Expense } from "./types";

function connectionString(): string {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add a Postgres database (e.g. Neon from the Vercel Marketplace) and set DATABASE_URL.",
    );
  }
  return url;
}

let _sql: ReturnType<typeof neon> | null = null;
function sql() {
  if (!_sql) _sql = neon(connectionString());
  return _sql;
}

let schemaReady: Promise<void> | null = null;

/** Creates tables on first use, so a fresh database needs no manual setup. */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const q = sql();
      await q`
        CREATE TABLE IF NOT EXISTS expenses (
          id SERIAL PRIMARY KEY,
          amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
          currency TEXT NOT NULL DEFAULT 'INR',
          category TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          spent_on DATE NOT NULL,
          is_one_off BOOLEAN NOT NULL DEFAULT FALSE,
          source_text TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await q`CREATE INDEX IF NOT EXISTS expenses_spent_on_idx ON expenses (spent_on)`;
      await q`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id SERIAL PRIMARY KEY,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          expense_ids INTEGER[] NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

type Row = Record<string, unknown>;

function toExpense(row: Row): Expense {
  const category = String(row.category);
  return {
    id: Number(row.id),
    amount: Number(row.amount),
    currency: String(row.currency),
    category: (isCategory(category) ? category : "Other") as Category,
    description: String(row.description ?? ""),
    spentOn:
      row.spent_on instanceof Date
        ? row.spent_on.toISOString().slice(0, 10)
        : String(row.spent_on).slice(0, 10),
    isOneOff: Boolean(row.is_one_off),
  };
}

export interface NewExpense {
  amount: number;
  category: Category;
  description: string;
  spentOn: string;
  isOneOff: boolean;
  sourceText: string;
}

export async function insertExpenses(items: NewExpense[]): Promise<Expense[]> {
  await ensureSchema();
  const out: Expense[] = [];
  for (const e of items) {
    const rows = (await sql()`
      INSERT INTO expenses (amount, category, description, spent_on, is_one_off, source_text)
      VALUES (${e.amount}, ${e.category}, ${e.description}, ${e.spentOn}::date, ${e.isOneOff}, ${e.sourceText})
      RETURNING id, amount, currency, category, description, to_char(spent_on, 'YYYY-MM-DD') AS spent_on, is_one_off`) as Row[];
    out.push(toExpense(rows[0]));
  }
  return out;
}

export interface ExpensePatch {
  amount?: number;
  category?: Category;
  description?: string;
  spentOn?: string;
  isOneOff?: boolean;
}

export async function updateExpense(id: number, patch: ExpensePatch): Promise<Expense | null> {
  await ensureSchema();
  const rows = (await sql()`
    UPDATE expenses SET
      amount = COALESCE(${patch.amount ?? null}::numeric, amount),
      category = COALESCE(${patch.category ?? null}::text, category),
      description = COALESCE(${patch.description ?? null}::text, description),
      spent_on = COALESCE(${patch.spentOn ?? null}::date, spent_on),
      is_one_off = COALESCE(${patch.isOneOff ?? null}::boolean, is_one_off),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, amount, currency, category, description, to_char(spent_on, 'YYYY-MM-DD') AS spent_on, is_one_off`) as Row[];
  return rows[0] ? toExpense(rows[0]) : null;
}

export async function deleteExpense(id: number): Promise<boolean> {
  await ensureSchema();
  const rows = (await sql()`DELETE FROM expenses WHERE id = ${id} RETURNING id`) as Row[];
  return rows.length > 0;
}

export async function addChatMessage(
  role: "user" | "assistant",
  content: string,
  expenseIds: number[] = [],
): Promise<{ id: number; createdAt: string }> {
  await ensureSchema();
  const rows = (await sql()`
    INSERT INTO chat_messages (role, content, expense_ids)
    VALUES (${role}, ${content}, ${expenseIds}::integer[])
    RETURNING id, created_at`) as Row[];
  return { id: Number(rows[0].id), createdAt: new Date(String(rows[0].created_at)).toISOString() };
}

/** Most recent chat messages (oldest first), with their expenses as they are now. */
export async function recentChat(limit = 60): Promise<ChatMessage[]> {
  await ensureSchema();
  const msgs = (await sql()`
    SELECT id, role, content, expense_ids, created_at FROM (
      SELECT * FROM chat_messages ORDER BY id DESC LIMIT ${limit}
    ) t ORDER BY id ASC`) as Row[];
  const ids = Array.from(new Set(msgs.flatMap((m) => (m.expense_ids as number[]) ?? [])));
  const byId = new Map<number, Expense>();
  if (ids.length) {
    const rows = (await sql()`
      SELECT id, amount, currency, category, description, to_char(spent_on, 'YYYY-MM-DD') AS spent_on, is_one_off
      FROM expenses WHERE id = ANY(${ids}::integer[])`) as Row[];
    for (const r of rows) byId.set(Number(r.id), toExpense(r));
  }
  return msgs.map((m) => ({
    id: Number(m.id),
    role: m.role as "user" | "assistant",
    content: String(m.content),
    // Deleted (undone) expenses simply drop out of the card list.
    expenses: ((m.expense_ids as number[]) ?? [])
      .map((id) => byId.get(Number(id)))
      .filter((e): e is Expense => Boolean(e)),
    createdAt: new Date(String(m.created_at)).toISOString(),
  }));
}
