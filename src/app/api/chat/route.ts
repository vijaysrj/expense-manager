import { NextResponse } from "next/server";
import { runAssistant, type HistoryTurn } from "@/lib/assistant";
import { addChatMessage, insertExpenses, recentChat } from "@/lib/db";
import { isValidISODate, todayISO } from "@/lib/dates";

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
  // The new user message is appended by the assistant, so history must end on an assistant turn.
  if (out.length && out[out.length - 1].role === "user") out.pop();
  return out;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { message?: unknown };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Message is empty" }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: "Message is too long" }, { status: 400 });

  const history = toHistory(await recentChat(10));
  const userMsg = await addChatMessage("user", message);

  let result;
  try {
    result = await runAssistant(message, history);
  } catch (err) {
    console.error("assistant error", err);
    const reply = "Sorry, I couldn't reach the AI just now. Please try again in a moment.";
    const saved = await addChatMessage("assistant", reply);
    return NextResponse.json({
      user: { id: userMsg.id, role: "user", content: message, expenses: [], createdAt: userMsg.createdAt },
      assistant: { id: saved.id, role: "assistant", content: reply, expenses: [], createdAt: saved.createdAt },
    });
  }

  const today = todayISO();
  const valid = result.expenses
    .filter((e) => Number.isFinite(e.amount) && e.amount > 0 && e.amount < 1e10)
    .map((e) => ({
      amount: Math.round(e.amount * 100) / 100,
      category: e.category,
      description: e.description.trim().slice(0, 200) || e.category,
      spentOn: isValidISODate(e.date) ? e.date : today,
      isOneOff: e.is_one_off,
      sourceText: message,
    }));

  const expenses = valid.length ? await insertExpenses(valid) : [];
  const saved = await addChatMessage(
    "assistant",
    result.reply,
    expenses.map((e) => e.id),
  );

  return NextResponse.json({
    user: { id: userMsg.id, role: "user", content: message, expenses: [], createdAt: userMsg.createdAt },
    assistant: { id: saved.id, role: "assistant", content: result.reply, expenses, createdAt: saved.createdAt },
  });
}
