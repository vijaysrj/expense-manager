"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ExpenseCard from "@/components/ExpenseCard";
import { CATEGORY_EMOJI } from "@/lib/categories";
import { formatDay, formatMoney, localTodayISO } from "@/lib/format";
import type { Expense } from "@/lib/types";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function monthLabel(month: string): string {
  return new Date(month + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default function HistoryPage() {
  const thisMonth = localTodayISO().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setExpenses(null);
    setError(null);
    fetch(`/api/expenses?month=${month}`)
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load expenses");
        if (!cancelled) setExpenses(data.expenses);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load expenses"));
    return () => {
      cancelled = true;
    };
  }, [month]);

  const { total, typical, days } = useMemo(() => {
    const list = expenses ?? [];
    const groups = new Map<string, Expense[]>();
    for (const e of list) groups.set(e.spentOn, [...(groups.get(e.spentOn) ?? []), e]);
    return {
      total: list.reduce((s, e) => s + e.amount, 0),
      typical: list.filter((e) => !e.isOneOff).reduce((s, e) => s + e.amount, 0),
      days: [...groups.entries()],
    };
  }, [expenses]);

  const today = localTodayISO();
  const update = (u: Expense) =>
    setExpenses((list) =>
      (list ?? [])
        .map((e) => (e.id === u.id ? u : e))
        .filter((e) => e.spentOn.slice(0, 7) === month)
        .sort((a, b) => (a.spentOn === b.spentOn ? b.id - a.id : a.spentOn < b.spentOn ? 1 : -1)),
    );
  const remove = (id: number) => setExpenses((list) => (list ?? []).filter((e) => e.id !== id));

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Link href="/" className="rounded-full px-2 py-1 text-sm text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40">
            ← Chat
          </Link>
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">History</h1>
        </div>
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 pb-3">
          <button
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="Previous month"
            className="h-9 w-9 rounded-full text-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ‹
          </button>
          <div className="text-center">
            <div className="font-medium text-zinc-900 dark:text-zinc-100">{monthLabel(month)}</div>
            <div className="text-xs text-zinc-500">
              {expenses ? (
                <>
                  {formatMoney(Math.round(total))} spent
                  {typical !== total ? ` · ${formatMoney(Math.round(typical))} without one-offs` : ""}
                </>
              ) : (
                " "
              )}
            </div>
          </div>
          <button
            onClick={() => setMonth(shiftMonth(month, 1))}
            disabled={month >= thisMonth}
            aria-label="Next month"
            className="h-9 w-9 rounded-full text-lg text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ›
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        {!expenses && !error && <p className="py-10 text-center text-sm text-zinc-400">Loading…</p>}
        {expenses && expenses.length === 0 && (
          <p className="py-10 text-center text-sm text-zinc-500">No expenses in {monthLabel(month)}.</p>
        )}
        <div className="flex flex-col gap-4">
          {days.map(([day, list]) => (
            <section key={day}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{formatDay(day, today)}</h2>
                <span className="text-xs tabular-nums text-zinc-500">{formatMoney(list.reduce((s, e) => s + e.amount, 0))}</span>
              </div>
              <ul className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                {list.map((e) =>
                  openId === e.id ? (
                    <li key={e.id} className="border-b border-zinc-100 p-2 last:border-0 dark:border-zinc-800">
                      <ExpenseCard expense={e} onChange={update} onDelete={remove} />
                      <button onClick={() => setOpenId(null)} className="mt-1 w-full py-1 text-xs text-zinc-500">
                        Close
                      </button>
                    </li>
                  ) : (
                    <li key={e.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                      <button onClick={() => setOpenId(e.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <span className="text-lg">{CATEGORY_EMOJI[e.category]}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-zinc-900 dark:text-zinc-100">{e.description}</span>
                          <span className="block text-xs text-zinc-500">
                            {e.category}
                            {e.isOneOff && <span className="ml-1.5 font-medium text-amber-700 dark:text-amber-400">· One-off</span>}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                          {formatMoney(e.amount, e.currency)}
                        </span>
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
