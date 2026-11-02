import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CATEGORIES } from "./categories";
import { APP_TIMEZONE, todayISO, weekdayName } from "./dates";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const CURRENCY = process.env.APP_CURRENCY || "INR";

// Accept either name for the key; ANTHROPIC_KEY is also common.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY });

const ParsedExpense = z.object({
  amount: z.number().describe("Positive amount in the user's currency. Convert words like '2k' to 2000."),
  category: z.enum(CATEGORIES),
  description: z.string().describe("Short, human label, e.g. 'Tea', 'Auto to office', 'School fees - term 2'."),
  date: z.string().describe("Date of the expense as YYYY-MM-DD, resolved from words like today, yesterday, last Friday."),
  is_one_off: z
    .boolean()
    .describe(
      "True for large, irregular expenses that would distort normal averages: school or college fees, annual insurance premiums, big appliance or gadget purchases, home repairs, travel bookings, medical procedures, festival or wedding spending. False for everyday spending.",
    ),
});

const AssistantOutput = z.object({
  expenses: z
    .array(ParsedExpense)
    .describe("Every expense the latest user message asks to record. Empty if it records nothing."),
  reply: z
    .string()
    .describe("A short, friendly reply in plain text (one or two sentences, no markdown)."),
});

export type AssistantResult = z.infer<typeof AssistantOutput>;

const SYSTEM_PROMPT = `You are the assistant inside a personal expense manager chat app. The user logs spending by typing casual messages such as "25 rupees for tea today", "auto 80, lunch 150", or "paid 45000 school fees yesterday".

Your job for each message:
- Extract every expense the latest user message asks to record. A single message can contain several expenses; return one entry for each.
- Amounts are in ${CURRENCY} unless the user says otherwise. Understand "rs", "₹", "rupees", "/-", "k" (thousand) and "lakh".
- Resolve relative dates ("today", "yesterday", "last Sunday", "on the 3rd") against the current date given below. If no date is mentioned, use today. Never use a future date unless the user clearly says so.
- Pick the single best category from the allowed list. Tea, coffee, snacks, restaurants and food delivery are "Food & Drinks"; vegetables, milk and household supplies are "Groceries"; auto, cab, bus, metro and parking are "Transport".
- Mark is_one_off for large, irregular expenses that would distort everyday averages (fees, annual premiums, big purchases, travel bookings). The user can change this later.
- If an amount is missing or the message is ambiguous, record nothing and ask a short clarifying question in reply.
- Earlier turns are context only. Never re-record expenses from earlier turns.

The reply confirms what you recorded in a few words, for example "Logged ₹25 for tea today." Do not repeat every field, because the app shows a card for each expense. Use the ₹ symbol for INR.

This version of the app can only log expenses. If the user asks for reports, averages, edits or advice, record nothing and say briefly that reports and smart advice are coming soon, and that they can edit or undo an entry using the buttons on its card.`;

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export async function runAssistant(message: string, history: HistoryTurn[]): Promise<AssistantResult> {
  const today = todayISO();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.map((t) => ({ role: t.role, content: t.content })),
    {
      role: "user",
      content: `Current date: ${today} (${weekdayName(today)}), timezone ${APP_TIMEZONE}.\n\nUser message: ${message}`,
    },
  ];

  // Claude Haiku has no server-side refusal fallback; other current models do.
  const useFallbacks = !MODEL.startsWith("claude-haiku");

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages,
    output_config: { effort: "low", format: betaZodOutputFormat(AssistantOutput) },
    ...(useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  });

  if (response.stop_reason === "refusal") {
    return { expenses: [], reply: "Sorry, I couldn't process that message. Could you rephrase it?" };
  }
  if (!response.parsed_output) {
    throw new Error(`Assistant returned no parseable output (stop_reason: ${response.stop_reason})`);
  }
  return response.parsed_output;
}
