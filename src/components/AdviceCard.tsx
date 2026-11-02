import { formatMoney } from "@/lib/format";
import type { Advice } from "@/lib/types";

export default function AdviceCard({ advice }: { advice: Advice }) {
  const totalSaving = advice.tips.reduce((s, t) => s + (t.estimatedMonthlySaving ?? 0), 0);
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm dark:border-amber-900/60 dark:bg-zinc-900">
      <div className="bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
        <div className="flex items-center gap-2">
          <span className="text-lg">💡</span>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Smart advice</h3>
          {totalSaving > 0 && (
            <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              Save up to {formatMoney(totalSaving)}/mo
            </span>
          )}
        </div>
        <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">{advice.headline}</p>
      </div>
      <ol className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {advice.tips.map((t, i) => (
          <li key={i} className="flex gap-3 px-4 py-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{t.title}</span>
                {t.estimatedMonthlySaving ? (
                  <span className="text-xs text-emerald-700 dark:text-emerald-400">≈ {formatMoney(t.estimatedMonthlySaving)}/mo</span>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{t.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
