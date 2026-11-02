"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AdviceCard from "./AdviceCard";
import ExpenseCard from "./ExpenseCard";
import ReportCard from "./ReportCard";
import { formatMoney } from "@/lib/format";
import type { ChatMessage, Expense } from "@/lib/types";

const STARTER_SUGGESTIONS = [
  "25 rupees for tea today",
  "Auto 80 and lunch 150",
  "Paid 1200 electricity bill yesterday",
  "Groceries 640 on Sunday",
];

const REPORT_SUGGESTIONS = [
  "This month so far",
  "Weekly average this month",
  "Monthly average this year",
  "Top category this year",
  "Monthly average without school fees",
  "Where can I cut back?",
];

let tempId = -1;

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" }));
  }, []);

  useEffect(() => {
    fetch("/api/history")
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load your chat");
        setMessages(data.messages);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Could not load your chat"))
      .finally(() => {
        setLoaded(true);
        scrollToBottom(false);
      });
  }, [scrollToBottom]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setInput("");
    const pending: ChatMessage = {
      id: tempId--,
      role: "user",
      content: message,
      expenses: [],
      report: null,
      advice: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, pending]);
    scrollToBottom();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setMessages((m) => [...m.filter((x) => x.id !== pending.id), data.user, data.assistant]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: tempId--,
          role: "assistant",
          content: e instanceof Error ? `⚠️ ${e.message}` : "⚠️ Something went wrong",
          expenses: [],
          report: null,
          advice: null,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
      scrollToBottom();
      inputRef.current?.focus();
    }
  }

  function updateExpense(updated: Expense) {
    setMessages((m) =>
      m.map((msg) => ({ ...msg, expenses: msg.expenses.map((e) => (e.id === updated.id ? updated : e)) })),
    );
  }

  function removeExpense(id: number) {
    setMessages((m) => m.map((msg) => ({ ...msg, expenses: msg.expenses.filter((e) => e.id !== id) })));
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const isEmpty = loaded && !loadError && messages.length === 0;
  const hasExpenses = messages.some((m) => m.expenses.length > 0) || messages.length > 6;
  const suggestions = hasExpenses ? REPORT_SUGGESTIONS : STARTER_SUGGESTIONS;

  return (
    <div className="flex h-dvh flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
            <div>
              <h1 className="text-base font-semibold leading-tight text-zinc-900 dark:text-zinc-100">Expenses</h1>
              <p className="text-xs leading-tight text-zinc-500">Just tell me what you spent</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/history"
              className="rounded-full px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            >
              History
            </Link>
            <button onClick={logout} className="rounded-full px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-4">
          {!loaded && <p className="py-10 text-center text-sm text-zinc-400">Loading…</p>}
          {loadError && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{loadError}</p>
          )}
          {isEmpty && (
            <div className="py-10 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl dark:bg-emerald-900/40">
                💬
              </div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Log an expense</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Type it the way you&apos;d say it. Later, ask for reports like &quot;monthly average&quot; or tips on where to
                cut back.
              </p>
            </div>
          )}

          {messages.map((msg) =>
            msg.role === "user" ? (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-emerald-600 px-4 py-2 text-white">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={msg.id} className="flex flex-col items-start gap-2">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white px-4 py-2 text-zinc-800 shadow-sm dark:bg-zinc-900 dark:text-zinc-200">
                  {msg.content}
                </div>
                {msg.report && (
                  <div className="w-full max-w-md">
                    <ReportCard report={msg.report} />
                  </div>
                )}
                {msg.advice && (
                  <div className="w-full max-w-md">
                    <AdviceCard advice={msg.advice} />
                  </div>
                )}
                {msg.expenses.length > 0 && (
                  <div className="flex w-full max-w-md flex-col gap-2">
                    {msg.expenses.map((e) => (
                      <ExpenseCard key={e.id} expense={e} onChange={updateExpense} onDelete={removeExpense} />
                    ))}
                    {msg.expenses.length > 1 && (
                      <div className="px-1 text-right text-xs text-zinc-500">
                        Total {formatMoney(msg.expenses.reduce((s, e) => s + e.amount, 0), msg.expenses[0].currency)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ),
          )}

          {sending && (
            <div className="flex items-center gap-1 self-start rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm dark:bg-zinc-900">
              <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-2xl px-3 pt-2 pb-3">
          {loaded && (
            <div className="-mx-3 mb-2 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={sending}
                  className="shrink-0 rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="e.g. 25 rupees for tea today"
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-base text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
