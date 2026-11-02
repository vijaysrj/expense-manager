import type { Category } from "./categories";
import type { AverageUnit, CategoryTotal, Expense, Report, ReportSpec, TrendBucket } from "./types";

const DAY_MS = 86_400_000;
const UNIT_DAYS: Record<AverageUnit, number> = { day: 1, week: 7, month: 30.4375, year: 365.25 };

function toUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const minISO = (a: string, b: string) => (a < b ? a : b);
const maxISO = (a: string, b: string) => (a > b ? a : b);

export function isExcluded(e: Expense, spec: Pick<ReportSpec, "excludeCategories" | "excludeTerms">): boolean {
  if (spec.excludeCategories.includes(e.category)) return true;
  const desc = e.description.toLowerCase();
  return spec.excludeTerms.some((t) => t.trim() && desc.includes(t.trim().toLowerCase()));
}

function bucketStart(iso: string, unit: "day" | "week" | "month"): string {
  if (unit === "day") return iso;
  if (unit === "month") return iso.slice(0, 7) + "-01";
  // Weeks start on Monday.
  const ms = toUTC(iso);
  const dow = (new Date(ms).getUTCDay() + 6) % 7;
  return fromUTC(ms - dow * DAY_MS);
}

function nextBucket(iso: string, unit: "day" | "week" | "month"): string {
  if (unit === "day") return fromUTC(toUTC(iso) + DAY_MS);
  if (unit === "week") return fromUTC(toUTC(iso) + 7 * DAY_MS);
  const [y, m] = iso.split("-").map(Number);
  return fromUTC(Date.UTC(y, m, 1));
}

function bucketLabel(iso: string, unit: "day" | "week" | "month", multiYear: boolean): string {
  const d = new Date(toUTC(iso));
  if (unit === "day") return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", timeZone: "UTC" });
  if (unit === "week") return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  return d.toLocaleDateString("en-IN", { month: "short", ...(multiYear ? { year: "2-digit" } : {}), timeZone: "UTC" });
}

/**
 * Builds a report from the expenses in [spec.start, spec.end].
 * `firstTracked` is the date of the user's first ever expense; averages never count days before it
 * (or after today), so a "yearly average" in the first month of use isn't diluted by empty months.
 */
export function computeReport(
  expensesInRange: Expense[],
  spec: ReportSpec,
  opts: { today: string; firstTracked: string | null; currency?: string },
): Report {
  const effectiveEnd = minISO(spec.end, opts.today);
  const effectiveStart = opts.firstTracked ? maxISO(spec.start, opts.firstTracked) : spec.start;
  const days = Math.max(1, Math.round((toUTC(effectiveEnd) - toUTC(effectiveStart)) / DAY_MS) + 1);

  const inRange = expensesInRange.filter((e) => e.spentOn >= spec.start && e.spentOn <= spec.end);
  const excluded = inRange.filter((e) => isExcluded(e, spec));
  const included = inRange.filter((e) => !isExcluded(e, spec));

  const total = included.reduce((s, e) => s + e.amount, 0);
  const oneOffTotal = included.filter((e) => e.isOneOff).reduce((s, e) => s + e.amount, 0);
  const typicalTotal = total - oneOffTotal;
  const units = days / UNIT_DAYS[spec.averageUnit];
  // A period shorter than one unit (e.g. "monthly average" after 5 days) is reported as-is, not scaled up.
  const divisor = Math.max(1, units);

  const byCat = new Map<Category, CategoryTotal>();
  for (const e of included) {
    const c = byCat.get(e.category) ?? { category: e.category, total: 0, typicalTotal: 0, count: 0, share: 0 };
    c.total += e.amount;
    if (!e.isOneOff) c.typicalTotal += e.amount;
    c.count += 1;
    byCat.set(e.category, c);
  }
  const categories = [...byCat.values()]
    .map((c) => ({ ...c, total: round2(c.total), typicalTotal: round2(c.typicalTotal), share: total ? c.total / total : 0 }))
    .sort((a, b) => b.total - a.total);

  const spanDays = Math.round((toUTC(effectiveEnd) - toUTC(spec.start)) / DAY_MS) + 1;
  const trendUnit: Report["trendUnit"] = spanDays <= 14 ? "day" : spanDays <= 92 ? "week" : "month";
  const multiYear = spec.start.slice(0, 4) !== effectiveEnd.slice(0, 4);
  const buckets = new Map<string, TrendBucket>();
  if (spec.start <= effectiveEnd) {
    for (let b = bucketStart(spec.start, trendUnit); b <= effectiveEnd; b = nextBucket(b, trendUnit)) {
      buckets.set(b, { label: bucketLabel(b, trendUnit, multiYear), start: b, total: 0, typicalTotal: 0 });
    }
  }
  for (const e of included) {
    const b = buckets.get(bucketStart(e.spentOn, trendUnit));
    if (!b) continue;
    b.total += e.amount;
    if (!e.isOneOff) b.typicalTotal += e.amount;
  }
  const trend = [...buckets.values()].map((b) => ({ ...b, total: round2(b.total), typicalTotal: round2(b.typicalTotal) }));

  return {
    spec,
    currency: opts.currency ?? "INR",
    effectiveStart,
    effectiveEnd,
    days,
    count: included.length,
    total: round2(total),
    typicalTotal: round2(typicalTotal),
    oneOffTotal: round2(oneOffTotal),
    excludedTotal: round2(excluded.reduce((s, e) => s + e.amount, 0)),
    excludedCount: excluded.length,
    average: round2(total / divisor),
    typicalAverage: round2(typicalTotal / divisor),
    categories,
    trend,
    trendUnit,
    biggest: [...included].sort((a, b) => b.amount - a.amount).slice(0, 5),
    oneOffs: included.filter((e) => e.isOneOff).sort((a, b) => b.amount - a.amount).slice(0, 5),
  };
}

/** One-line, data-driven summary shown above the report card. */
export function summarizeReport(r: Report, fmt: (n: number) => string): string {
  if (r.count === 0) return `No expenses recorded for ${r.spec.title.toLowerCase()}.`;
  const unit = r.spec.averageUnit;
  const parts = [`You spent ${fmt(r.total)} across ${r.count} expense${r.count === 1 ? "" : "s"}.`];
  if (r.oneOffTotal > 0) {
    parts.push(`Without one-offs, your average is ${fmt(r.typicalAverage)} a ${unit} (${fmt(r.average)} with them).`);
  } else {
    parts.push(`That's an average of ${fmt(r.average)} a ${unit}.`);
  }
  if (r.oneOffTotal > 0 && r.typicalTotal > 0) {
    const top = [...r.categories].sort((a, b) => b.typicalTotal - a.typicalTotal)[0];
    parts.push(`${top.category} was your biggest everyday category at ${Math.round((top.typicalTotal / r.typicalTotal) * 100)}%.`);
  } else if (r.categories[0]) {
    const top = r.categories[0];
    parts.push(`${top.category} was the biggest category at ${Math.round(top.share * 100)}%.`);
  }
  return parts.join(" ");
}
