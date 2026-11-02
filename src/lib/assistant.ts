import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CATEGORIES } from "./categories";
import { APP_TIMEZONE, todayISO, weekdayName } from "./dates";
import type { Expense } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const ADVICE_MODEL = process.env.ANTHROPIC_ADVICE_MODEL || MODEL;
const CURRENCY = process.env.APP_CURRENCY || "INR";
const CITY = process.env.APP_CITY || "";

// Accept either name for the key; ANTHROPIC_KEY is also common.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY });

const DATE = z.string().describe("A date as YYYY-MM-DD.");

const NewExpense = z.object({
  amount: z.number().describe("Positive amount in the user's currency. Convert words like '2k' to 2000."),
  category: z.enum(CATEGORIES),
  description: z.string().describe("Short, human label, e.g. 'Tea', 'Auto to office', 'School fees - term 2'."),
  date: DATE.describe("Date of the expense as YYYY-MM-DD, resolved from words like today, yesterday, last Friday."),
  is_one_off: z
    .boolean()
    .describe(
      "True for large, irregular expenses that would distort normal averages: school or college fees, annual insurance premiums, big appliance or gadget purchases, home repairs, travel bookings, medical procedures, festival or wedding spending. False for everyday spending.",
    ),
});

const ExpenseUpdate = z.object({
  id: z.number().int().describe("id of an existing expense from the recent expenses list."),
  amount: z.number().nullable().describe("New amount, or null to keep."),
  category: z.enum(CATEGORIES).nullable().describe("New category, or null to keep."),
  description: z.string().nullable().describe("New description, or null to keep."),
  date: DATE.nullable().describe("New date, or null to keep."),
  is_one_off: z.boolean().nullable().describe("New one-off flag, or null to keep."),
});

const ReportRequest = z.object({
  title: z.string().describe("Short title, e.g. 'This month', 'October 2026', 'This year', 'Last 7 days'."),
  start: DATE.describe("First day of the period (inclusive)."),
  end: DATE.describe("Last day of the period (inclusive). Use today for periods that are still running."),
  average_unit: z
    .enum(["day", "week", "month", "year"])
    .describe("Unit for the average: 'weekly average' = week, 'monthly average' = month, and so on. Default to day for a week or shorter, week for a month, month for a year or longer."),
  exclude_categories: z.array(z.enum(CATEGORIES)).describe("Categories the user asked to leave out entirely."),
  exclude_terms: z
    .array(z.string())
    .describe("Words matching descriptions of expenses the user asked to leave out, e.g. ['school fees']. Use the wording from the recent expenses list when possible."),
});

const AdviceRequest = z.object({
  start: DATE.describe("First day of the period to analyse. Default: 90 days ago."),
  end: DATE.describe("Last day of the period to analyse. Default: today."),
  focus: z.string().describe("What the user wants advice on, e.g. 'food spending', 'where to cut', or 'general'."),
});

const InterpretOutput = z.object({
  new_expenses: z.array(NewExpense).describe("Expenses the latest message asks to record. Empty if none."),
  updates: z.array(ExpenseUpdate).describe("Changes to existing expenses the latest message asks for. Empty if none."),
  delete_ids: z.array(z.number().int()).describe("ids of existing expenses the user asked to delete or undo. Empty if none."),
  report: ReportRequest.nullable().describe("Set when the user asks for totals, averages, breakdowns, top categories or a summary. Otherwise null."),
  advice: AdviceRequest.nullable().describe("Set when the user asks for advice, tips, savings ideas, where to cut, or cheaper options. Otherwise null."),
  reply: z.string().describe("A short, friendly reply in plain text (one or two sentences, no markdown)."),
});

export type InterpretResult = z.infer<typeof InterpretOutput>;

const SYSTEM_PROMPT = `You are the assistant inside a personal expense manager chat app. The user types casual messages to record spending, fix entries, and ask about their spending.

Recording expenses ("25 rupees for tea today", "auto 80, lunch 150", "paid 45000 school fees yesterday"):
- Return one entry in new_expenses per expense. Amounts are in ${CURRENCY} unless stated. Understand "rs", "₹", "rupees", "/-", "k" (thousand) and "lakh".
- Resolve relative dates against the current date given with the message. No date means today. Never use a future date unless the user clearly says so.
- Pick the best category. Tea, coffee, snacks, restaurants and food delivery are "Food & Drinks"; vegetables, milk and household supplies are "Groceries"; auto, cab, bus, metro and parking are "Transport".
- Set is_one_off for large irregular expenses that would distort everyday averages (fees, annual premiums, big purchases, travel bookings).
- If the amount is missing or the message is ambiguous, record nothing and ask a short question.

Fixing entries ("change yesterday's tea to 30", "that was transport not food", "delete the last one", "mark the laptop as one-off", "school fees isn't a one-off"):
- Find the expense in the recent expenses list and use its id in updates or delete_ids. Only use ids from that list. If you can't tell which expense is meant, ask instead of guessing.

Reports ("monthly average", "how much did I spend this week", "top category this year", "average without school fees", "food spending in October"):
- Fill report. The app computes the numbers itself and always shows averages both with and without one-off expenses, so you never calculate amounts.
- Weeks start on Monday. "This month" runs from the 1st to today; "last month" is the full previous calendar month; "this year" is from 1 January to today.
- For "average without X", put the category in exclude_categories when X is a whole category, otherwise put matching words in exclude_terms.
- For "how much on food", use a report and mention the category in the title; the breakdown shows each category.

Advice ("where can I cut", "how can I save", "any cheaper options for groceries?"): fill advice. The app analyses the data and writes the tips separately.

A single message can do several of these at once. Earlier turns are context only; never re-record expenses from earlier turns.

The reply confirms what happened in a few words, for example "Logged ₹25 for tea today." or "Here's your report for this month." Don't repeat amounts the app shows on its cards and don't invent numbers. Use the ₹ symbol for INR.`;

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

function fallbackParams(model: string) {
  // Claude Haiku has no server-side refusal fallback; other current models do.
  return model.startsWith("claude-haiku")
    ? {}
    : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
}

function expenseLine(e: Expense): string {
  return `id ${e.id} | ${e.spentOn} | ${e.description} | ${e.category} | ${e.amount}${e.isOneOff ? " | one-off" : ""}`;
}

export async function interpretMessage(
  message: string,
  history: HistoryTurn[],
  recent: Expense[],
): Promise<InterpretResult> {
  const today = todayISO();
  const recentBlock = recent.length ? recent.map(expenseLine).join("\n") : "(none yet)";
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.map((t) => ({ role: t.role, content: t.content })),
    {
      role: "user",
      content: `Current date: ${today} (${weekdayName(today)}), timezone ${APP_TIMEZONE}.\n\nRecent expenses (newest first):\n${recentBlock}\n\nUser message: ${message}`,
    },
  ];

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages,
    output_config: { effort: "low", format: betaZodOutputFormat(InterpretOutput) },
    ...fallbackParams(MODEL),
  });

  if (response.stop_reason === "refusal") {
    return { new_expenses: [], updates: [], delete_ids: [], report: null, advice: null, reply: "Sorry, I couldn't process that message. Could you rephrase it?" };
  }
  if (!response.parsed_output) {
    throw new Error(`Assistant returned no parseable output (stop_reason: ${response.stop_reason})`);
  }
  return response.parsed_output;
}

const AdviceOutput = z.object({
  headline: z.string().describe("One or two sentences summarising the spending pattern in plain language."),
  tips: z
    .array(
      z.object({
        title: z.string().describe("Short action, e.g. 'Make tea at home on weekdays'."),
        detail: z.string().describe("Two or three sentences: what you saw in the data, what to do, and cheaper or better alternatives."),
        estimated_monthly_saving: z.number().nullable().describe("Rough monthly saving in the user's currency, or null if unclear."),
      }),
    )
    .describe("Three to five practical tips, biggest saving first."),
});

const ADVICE_PROMPT = `You are a practical, friendly personal-finance helper inside an expense tracking app used in India. You receive a summary of one person's spending and write specific, realistic advice.

- Base every tip on the data given: name the category or item and the amounts involved. Don't invent spending that isn't in the data.
- Prefer small, realistic habit changes over drastic cuts. Never shame the user.
- Suggest concrete cheaper or better alternatives where they fit, such as buying in bulk or from wholesale markets, monthly passes for metro or bus, cooking or making tea at home, comparing quick-commerce prices, annual instead of monthly plans, generic medicines, or bank and UPI offers.
- Treat one-off expenses (fees, big purchases) separately. Don't tell the user to cut essentials like school fees or medicine; at most suggest planning or saving for them in advance.
- If there's too little data for useful advice, say so in the headline and give at most two general tips.
- Use the ₹ symbol. Plain text only, no markdown.`;

export interface AdviceResult {
  headline: string;
  tips: { title: string; detail: string; estimated_monthly_saving: number | null }[];
}

export async function generateAdvice(summary: string, focus: string): Promise<AdviceResult> {
  const response = await client.beta.messages.parse({
    model: ADVICE_MODEL,
    max_tokens: 8192,
    system: ADVICE_PROMPT,
    messages: [
      {
        role: "user",
        content: `${CITY ? `The user lives in ${CITY}.\n` : ""}What they asked for: ${focus}\n\nSpending data:\n${summary}`,
      },
    ],
    output_config: { effort: "medium", format: betaZodOutputFormat(AdviceOutput) },
    ...fallbackParams(ADVICE_MODEL),
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Advice generation failed (stop_reason: ${response.stop_reason})`);
  }
  return response.parsed_output;
}
