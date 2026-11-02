"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_EMOJI, type Category } from "@/lib/categories";
import { formatDay, formatMoney, localTodayISO } from "@/lib/format";
import type { Expense } from "@/lib/types";

interface Props {
  expense: Expense;
  onChange: (expense: Expense) => void;
  onDelete: (id: number) => void;
}

export default function ExpenseCard({ expense, onChange, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    amount: String(expense.amount),
    category: expense.category,
    description: expense.description,
    spentOn: expense.spentOn,
    isOneOff: expense.isOneOff,
  });

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, amount: Number(draft.amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      onChange(data.expense);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error("Could not undo");
      onDelete(expense.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not undo");
      setBusy(false);
    }
  }

  if (editing) {
    const input =
      "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
    return (
      <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-1 text-xs text-zinc-500">
            Amount
            <input
              className={input}
              inputMode="decimal"
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            />
          </label>
          <label className="col-span-1 text-xs text-zinc-500">
            Date
            <input
              className={input}
              type="date"
              value={draft.spentOn}
              onChange={(e) => setDraft({ ...draft, spentOn: e.target.value })}
            />
          </label>
          <label className="col-span-2 text-xs text-zinc-500">
            Description
            <input
              className={input}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
          <label className="col-span-2 text-xs text-zinc-500">
            Category
            <select
              className={input}
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_EMOJI[c]} {c}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 flex items-center gap-2 py-1 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-600"
              checked={draft.isOneOff}
              onChange={(e) => setDraft({ ...draft, isOneOff: e.target.checked })}
            />
            One-off (leave out of &quot;typical&quot; averages)
          </label>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button
            className="rounded-full px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            onClick={() => setEditing(false)}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            onClick={save}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xl dark:bg-zinc-800">
          {CATEGORY_EMOJI[expense.category]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">{expense.description}</div>
          <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
            <span>{expense.category}</span>
            <span>·</span>
            <span>{formatDay(expense.spentOn, localTodayISO())}</span>
            {expense.isOneOff && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                One-off
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
          {formatMoney(expense.amount, expense.currency)}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-2 flex justify-end gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <button
          className="rounded-full px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          onClick={() => {
            setDraft({
              amount: String(expense.amount),
              category: expense.category,
              description: expense.description,
              spentOn: expense.spentOn,
              isOneOff: expense.isOneOff,
            });
            setEditing(true);
          }}
          disabled={busy}
        >
          Edit
        </button>
        <button
          className="rounded-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/40"
          onClick={undo}
          disabled={busy}
        >
          {busy ? "Removing…" : "Undo"}
        </button>
      </div>
    </div>
  );
}
