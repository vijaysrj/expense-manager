import { computeReport } from "./reports";
import type { Expense } from "./types";

const DAY_MS = 86_400_000;
const toUTC = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The period of equal length right before [start, end]. */
export function previousPeriod(start: string, end: string): { start: string; end: string } {
  const len = toUTC(end) - toUTC(start) + DAY_MS;
  return { start: fromUTC(toUTC(start) - len), end: fromUTC(toUTC(start) - DAY_MS) };
}

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Plain-text spending summary for the advice prompt. Only aggregates, so the prompt stays small. */
export function buildAdviceSummary(
  current: Expense[],
  previous: Expense[],
  range: { start: string; end: string; previousStart: string; previousEnd: string },
  opts: { today: string; firstTracked: string | null },
): string {
  const spec = { title: "", averageUnit: "month" as const, excludeCategories: [], excludeTerms: [] };
  const cur = computeReport(current, { ...spec, start: range.start, end: range.end }, opts);
  const prev = computeReport(previous, { ...spec, start: range.previousStart, end: range.previousEnd }, opts);

  const lines: string[] = [];
  lines.push(`Period analysed: ${cur.effectiveStart} to ${cur.effectiveEnd} (${cur.days} days of tracked data).`);
  lines.push(`Total: ${money(cur.total)} over ${cur.count} expenses. Everyday spending (without one-offs): ${money(cur.typicalTotal)}. One-offs: ${money(cur.oneOffTotal)}.`);
  lines.push(`Average per month: ${money(cur.typicalAverage)} without one-offs, ${money(cur.average)} with them.`);

  lines.push("", "By category (everyday spending / including one-offs / number of expenses):");
  for (const c of cur.categories) {
    const p = prev.categories.find((x) => x.category === c.category);
    const change = p && p.typicalTotal > 0 ? ` (previous period: ${money(p.typicalTotal)})` : "";
    lines.push(`- ${c.category}: ${money(c.typicalTotal)} / ${money(c.total)} / ${c.count}${change}`);
  }
  if (prev.count > 0) {
    lines.push(`Previous period of the same length: everyday spending ${money(prev.typicalTotal)} over ${prev.count} expenses.`);
  }

  // Recurring items: same description bought repeatedly.
  const groups = new Map<string, { label: string; category: string; count: number; total: number }>();
  for (const e of current.filter((x) => !x.isOneOff)) {
    const key = e.description.trim().toLowerCase();
    const g = groups.get(key) ?? { label: e.description.trim(), category: e.category, count: 0, total: 0 };
    g.count += 1;
    g.total += e.amount;
    groups.set(key, g);
  }
  const recurring = [...groups.values()].filter((g) => g.count >= 2).sort((a, b) => b.total - a.total).slice(0, 12);
  if (recurring.length) {
    lines.push("", "Repeated purchases (count, total, average each):");
    for (const g of recurring) lines.push(`- ${g.label} (${g.category}): ${g.count}x, ${money(g.total)}, ${money(g.total / g.count)} each`);
  }

  if (cur.biggest.length) {
    lines.push("", "Largest single expenses:");
    for (const e of cur.biggest) lines.push(`- ${e.spentOn} ${e.description} (${e.category}${e.isOneOff ? ", one-off" : ""}): ${money(e.amount)}`);
  }
  return lines.join("\n");
}
