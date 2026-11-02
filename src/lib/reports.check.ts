import assert from "node:assert/strict";
import { computeReport } from "./reports";
import type { Expense } from "./types";

let id = 0;
const e = (spentOn: string, amount: number, category: Expense["category"], description: string, isOneOff = false): Expense => ({
  id: ++id, amount, currency: "INR", category, description, spentOn, isOneOff,
});
const data = [
  e("2026-09-05", 100, "Food & Drinks", "Tea"),
  e("2026-10-01", 300, "Groceries", "Vegetables"),
  e("2026-10-10", 45000, "Education", "School fees", true),
  e("2026-10-20", 200, "Food & Drinks", "Tea"),
  e("2026-11-01", 500, "Transport", "Cab"),
];
const base = { excludeCategories: [], excludeTerms: [] };
const year = computeReport(data, { ...base, title: "This year", start: "2026-01-01", end: "2026-12-31", averageUnit: "month" }, { today: "2026-11-02", firstTracked: "2026-09-05" });
assert.equal(year.total, 46100);
assert.equal(year.typicalTotal, 1100);
assert.equal(year.effectiveStart, "2026-09-05");
assert.equal(year.effectiveEnd, "2026-11-02");
assert.equal(year.days, 59);
// 59 days = 1.938 months
assert.ok(Math.abs(year.typicalAverage - 1100 / (59 / 30.4375)) < 0.01);
assert.equal(year.categories[0].category, "Education");
assert.equal(year.trendUnit, "month");
assert.deepEqual(year.trend.map((b) => b.start), ["2026-01-01","2026-02-01","2026-03-01","2026-04-01","2026-05-01","2026-06-01","2026-07-01","2026-08-01","2026-09-01","2026-10-01","2026-11-01"]);
assert.equal(year.trend[9].total, 45500);
assert.equal(year.trend[9].typicalTotal, 500);

const noFees = computeReport(data, { ...base, excludeTerms: ["school fee"], title: "x", start: "2026-01-01", end: "2026-12-31", averageUnit: "month" }, { today: "2026-11-02", firstTracked: "2026-09-05" });
assert.equal(noFees.total, 1100);
assert.equal(noFees.excludedCount, 1);
assert.equal(noFees.excludedTotal, 45000);

const week = computeReport(data, { ...base, title: "This week", start: "2026-11-02", end: "2026-11-08", averageUnit: "day" }, { today: "2026-11-02", firstTracked: "2026-09-05" });
assert.equal(week.count, 0);
assert.equal(week.days, 1);
assert.equal(week.trendUnit, "day");

const oct = computeReport(data, { ...base, excludeCategories: ["Education"], title: "October", start: "2026-10-01", end: "2026-10-31", averageUnit: "week" }, { today: "2026-11-02", firstTracked: "2026-09-05" });
assert.equal(oct.total, 500);
assert.equal(oct.trendUnit, "week");
assert.equal(oct.trend[0].start, "2026-09-28"); // Monday
// Short period: monthly average after 5 days isn't scaled up
const short = computeReport(data, { ...base, title: "x", start: "2026-11-01", end: "2026-11-30", averageUnit: "month" }, { today: "2026-11-02", firstTracked: "2026-11-01" });
assert.equal(short.average, 500);
console.log("report checks passed");
