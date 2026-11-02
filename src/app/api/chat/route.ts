import { NextResponse } from "next/server";
import { buildAdviceSummary, previousPeriod } from "@/lib/advice";
import { generateAdvice, interpretMessage, type HistoryTurn, type InterpretResult } from "@/lib/assistant";
import {
  addChatMessage,
  deleteExpense,
  firstExpenseDate,
  insertExpenses,
  listExpenses,
  recentChat,
  recentExpenses,
  updateExpense,
  type ExpensePatch,
} from "@/lib/db";
import { isValidISODate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { computeReport, summarizeReport } from "@/lib/reports";
import type { Advice, ChatMessage, Expense, Report } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Last few turns as plain text, alternating and starting with a user turn. */
function toHistory(msgs: { role: "user" | "assistant"; content: string }[], maxTurns = 8): HistoryTurn[] {
  const out: HistoryTurn[] = [];
  for (const m of msgs.slice(-maxTurns)) {
    if (out.length === 0 && m.role !== "user") continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += `\n${m.content}`;
    else out.push({ role: m.role, content: m.content });
  }
  // The new user message is appended separately, so history must end on an assistant turn.
  if (out.length && out[out.length - 1].role === "user") out.pop();
  return out;
}

const cleanAmount = (n: number) => Math.round(n * 100) / 100;
const validAmount = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0 && n < 1e10;

function orderRange(start: string, end: string, today: string): { start: string; end: string } {
  const s = isValidISODate(start) ? start : today;
  const e = isValidISODate(end) ? end : today;
  return s <= e ? { start: s, end: e } : { start: e, end: s };
}

async function applyChanges(result: InterpretResult, message: string, recent: Expense[], today: string) {
  const knownIds = new Set(recent.map((e) => e.id));
  const touched: Expense[] = [];

  const toInsert = result.new_expenses
    .filter((e) => validAmount(e.amount))
    .map((e) => ({
      amount: cleanAmount(e.amount),
      category: e.category,
      description: e.description.trim().slice(0, 200) || e.category,
      spentOn: isValidISODate(e.date) ? e.date : today,
      isOneOff: e.is_one_off,
      sourceText: message,
    }));
  if (toInsert.length) touched.push(...(await insertExpenses(toInsert)));

  for (const u of result.updates) {
    if (!knownIds.has(u.id)) continue;
    const patch: ExpensePatch = {};
    if (validAmount(u.amount)) patch.amount = cleanAmount(u.amount);
    if (u.category) patch.category = u.category;
    if (u.description?.trim()) patch.description = u.description.trim().slice(0, 200);
    if (u.date && isValidISODate(u.date)) patch.spentOn = u.date;
    if (typeof u.is_one_off === "boolean") patch.isOneOff = u.is_one_off;
    if (!Object.keys(patch).length) continue;
    const updated = await updateExpense(u.id, patch);
    if (updated) touched.push(updated);
  }

  let deleted = 0;
  for (const id of result.delete_ids) {
    if (knownIds.has(id) && (await deleteExpense(id))) deleted += 1;
  }
  return { touched, deleted };
}

async function buildReport(req: NonNullable<InterpretResult["report"]>, today: string, firstTracked: string | null): Promise<Report> {
  const { start, end } = orderRange(req.start, req.end, today);
  const expenses = await listExpenses(start, end);
  return computeReport(
    expenses,
    {
      title: req.title.trim().slice(0, 80) || "Report",
      start,
      end,
      averageUnit: req.average_unit,
      excludeCategories: req.exclude_categories,
      excludeTerms: req.exclude_terms.map((t) => t.trim()).filter(Boolean).slice(0, 10),
    },
    { today, firstTracked, currency: process.env.APP_CURRENCY || "INR" },
  );
}

async function buildAdvice(req: NonNullable<InterpretResult["advice"]>, today: string, firstTracked: string | null): Promise<Advice> {
  const { start, end } = orderRange(req.start, req.end, today);
  const prev = previousPeriod(start, end);
  const [current, previous] = await Promise.all([listExpenses(start, end), listExpenses(prev.start, prev.end)]);
  const summary = buildAdviceSummary(
    current,
    previous,
    { start, end, previousStart: prev.start, previousEnd: prev.end },
    { today, firstTracked },
  );
  const result = await generateAdvice(summary, req.focus || "general");
  return {
    headline: result.headline,
    tips: result.tips.slice(0, 6).map((t) => ({
      title: t.title,
      detail: t.detail,
      estimatedMonthlySaving: validAmount(t.estimated_monthly_saving) ? Math.round(t.estimated_monthly_saving) : null,
    })),
    start,
    end,
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { message?: unknown };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Message is empty" }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: "Message is too long" }, { status: 400 });

  const [chat, recent, firstTracked] = await Promise.all([recentChat(10), recentExpenses(40), firstExpenseDate()]);
  const history = toHistory(chat);
  const userMsg = await addChatMessage("user", message);
  const userOut: ChatMessage = { id: userMsg.id, role: "user", content: message, expenses: [], report: null, advice: null, createdAt: userMsg.createdAt };
  const today = todayISO();

  const fail = async (reply: string) => {
    const saved = await addChatMessage("assistant", reply);
    const assistant: ChatMessage = { id: saved.id, role: "assistant", content: reply, expenses: [], report: null, advice: null, createdAt: saved.createdAt };
    return NextResponse.json({ user: userOut, assistant });
  };

  let result: InterpretResult;
  try {
    result = await interpretMessage(message, history, recent);
  } catch (err) {
    console.error("interpret error", err);
    return fail("Sorry, I couldn't reach the AI just now. Please try again in a moment.");
  }

  const { touched, deleted } = await applyChanges(result, message, recent, today);
  // Reports and advice should see the changes made by this same message.
  const first = touched.length ? await firstExpenseDate() : firstTracked;

  let report: Report | null = null;
  let advice: Advice | null = null;
  let reply = result.reply.trim();
  try {
    if (result.report) {
      report = await buildReport(result.report, today, first);
      const summary = summarizeReport(report, (n) => formatMoney(n, report!.currency));
      // Keep the model's confirmation when the same message also changed expenses.
      reply = touched.length || deleted ? `${reply} ${summary}` : summary;
    }
  } catch (err) {
    console.error("report error", err);
    reply += " (I couldn't build the report this time. Please try again.)";
  }
  try {
    if (result.advice) advice = await buildAdvice(result.advice, today, first);
  } catch (err) {
    console.error("advice error", err);
    reply += " (I couldn't put the advice together this time. Please try again.)";
  }
  if (deleted && !reply) reply = `Deleted ${deleted} expense${deleted === 1 ? "" : "s"}.`;
  if (!reply) reply = "Done.";

  const saved = await addChatMessage("assistant", reply, { expenseIds: touched.map((e) => e.id), report, advice });
  const assistant: ChatMessage = {
    id: saved.id,
    role: "assistant",
    content: reply,
    expenses: touched,
    report,
    advice,
    createdAt: saved.createdAt,
  };
  return NextResponse.json({ user: userOut, assistant });
}
