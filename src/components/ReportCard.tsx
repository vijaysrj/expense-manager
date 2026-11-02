"use client";

import { useState } from "react";
import { CATEGORY_EMOJI } from "@/lib/categories";
import { formatDay, formatMoney, localTodayISO } from "@/lib/format";
import type { Report } from "@/lib/types";

const UNIT_LABEL = { day: "day", week: "week", month: "month", year: "year" } as const;

function rangeLabel(start: string, end: string): string {
  const fmt = (iso: string) =>
    new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

export default function ReportCard({ report }: { report: Report }) {
  const [typical, setTypical] = useState(report.oneOffTotal > 0);
  const money = (n: number) => formatMoney(Math.round(n), report.currency);
  const hasOneOffs = report.oneOffTotal > 0;
  const unit = UNIT_LABEL[report.spec.averageUnit];

  const cats = report.categories
    .map((c) => ({ ...c, value: typical ? c.typicalTotal : c.total }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
  const catMax = Math.max(1, ...cats.map((c) => c.value));
  const catSum = cats.reduce((s, c) => s + c.value, 0);
  const trendVals = report.trend.map((b) => (typical ? b.typicalTotal : b.total));
  const trendMax = Math.max(1, ...trendVals);
  const excluded = [...report.spec.excludeCategories, ...report.spec.excludeTerms.map((t) => `“${t}”`)];

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-100 px-4 pt-4 pb-3 dark:border-zinc-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{report.spec.title}</h3>
            <p className="text-xs text-zinc-500">{rangeLabel(report.spec.start, report.effectiveEnd)}</p>
          </div>
          {hasOneOffs && (
            <div className="flex shrink-0 rounded-full bg-zinc-100 p-0.5 text-xs dark:bg-zinc-800">
              <button
                onClick={() => setTypical(true)}
                className={`rounded-full px-2.5 py-1 ${typical ? "bg-white font-medium text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100" : "text-zinc-500"}`}
              >
                Typical
              </button>
              <button
                onClick={() => setTypical(false)}
                className={`rounded-full px-2.5 py-1 ${!typical ? "bg-white font-medium text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100" : "text-zinc-500"}`}
              >
                All
              </button>
            </div>
          )}
        </div>
      </div>

      {report.count === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-zinc-500">No expenses in this period yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px bg-zinc-100 dark:bg-zinc-800">
            <div className="bg-white px-4 py-3 dark:bg-zinc-900">
              <div className="text-xs text-zinc-500">Average per {unit}</div>
              <div className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {money(typical ? report.typicalAverage : report.average)}
              </div>
              {hasOneOffs && (
                <div className="text-[11px] text-zinc-500">
                  {typical ? `${money(report.average)} with one-offs` : `${money(report.typicalAverage)} without one-offs`}
                </div>
              )}
            </div>
            <div className="bg-white px-4 py-3 dark:bg-zinc-900">
              <div className="text-xs text-zinc-500">Total spent</div>
              <div className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {money(typical ? report.typicalTotal : report.total)}
              </div>
              <div className="text-[11px] text-zinc-500">
                {report.count} expense{report.count === 1 ? "" : "s"}
                {hasOneOffs && typical ? ` · ${money(report.oneOffTotal)} one-offs hidden` : ""}
              </div>
            </div>
          </div>

          {report.trend.length > 1 && (
            <div className="px-4 pt-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                By {report.trendUnit}
              </div>
              <div className="flex h-24 items-end gap-1">
                {report.trend.map((b, i) => (
                  <div key={b.start} className="group relative flex h-full flex-1 flex-col justify-end" title={`${b.label}: ${money(trendVals[i])}`}>
                    <div
                      className="w-full rounded-t bg-emerald-500/80 dark:bg-emerald-500/70"
                      style={{ height: `${Math.max(trendVals[i] > 0 ? 3 : 0, (trendVals[i] / trendMax) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-1 text-[10px] text-zinc-400">
                {report.trend.map((b, i) => (
                  <div key={b.start} className="flex-1 truncate text-center">
                    {report.trend.length <= 12 || i % Math.ceil(report.trend.length / 8) === 0 ? b.label : ""}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-4 py-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">By category</div>
            <ul className="flex flex-col gap-2.5">
              {cats.map((c) => (
                <li key={c.category}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate text-zinc-800 dark:text-zinc-200">
                      {CATEGORY_EMOJI[c.category]} {c.category}
                    </span>
                    <span className="shrink-0 tabular-nums text-zinc-900 dark:text-zinc-100">
                      {money(c.value)}{" "}
                      <span className="text-xs text-zinc-400">{Math.round((c.value / Math.max(1, catSum)) * 100)}%</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${(c.value / catMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {report.oneOffs.length > 0 && (
            <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">One-offs</div>
              <ul className="flex flex-col gap-1 text-sm">
                {report.oneOffs.map((e) => (
                  <li key={e.id} className="flex justify-between gap-2">
                    <span className="truncate text-zinc-700 dark:text-zinc-300">
                      {e.description} <span className="text-xs text-zinc-400">· {formatDay(e.spentOn, localTodayISO())}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-zinc-900 dark:text-zinc-100">{money(e.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {(excluded.length > 0 || report.effectiveStart > report.spec.start) && (
        <div className="space-y-0.5 border-t border-zinc-100 bg-zinc-50 px-4 py-2 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40">
          {excluded.length > 0 && (
            <p>
              Leaving out {excluded.join(", ")}
              {report.excludedCount > 0 ? ` (${report.excludedCount} item${report.excludedCount === 1 ? "" : "s"}, ${money(report.excludedTotal)})` : " (nothing matched)"}.
            </p>
          )}
          {report.effectiveStart > report.spec.start && (
            <p>Averages use the {report.days} day{report.days === 1 ? "" : "s"} since you started tracking.</p>
          )}
        </div>
      )}
    </div>
  );
}
