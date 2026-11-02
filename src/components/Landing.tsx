import Link from "next/link";

const FEATURES = [
  {
    emoji: "💬",
    title: "Log by chatting",
    body: "Type it the way you'd say it. “25 rupees for tea today” becomes a dated, categorised expense in a second.",
  },
  {
    emoji: "📊",
    title: "Reports on request",
    body: "Ask for this week, last month or the whole year. Get totals, averages and your top categories in a clean card.",
  },
  {
    emoji: "🎯",
    title: "Averages without the spikes",
    body: "School fees or a new phone skew the picture. See your typical spend with and without big one-offs.",
  },
  {
    emoji: "💡",
    title: "Smart advice",
    body: "Find out where you can cut back and where cheaper or better options might be, based on how you actually spend.",
  },
];

const EXAMPLES = [
  "450 for groceries at DMart yesterday",
  "How much did I spend this month?",
  "Monthly average this year without school fees",
  "Which category did I spend most on this week?",
  "Where can I save money?",
];

function ChatPreview() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-3xl border border-zinc-200 bg-zinc-50 p-4 shadow-xl shadow-emerald-900/5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex justify-end">
        <div className="rounded-2xl rounded-br-md bg-emerald-600 px-4 py-2 text-sm text-white">25 rupees for tea today</div>
      </div>
      <div className="mt-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">☕</span>
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Tea</div>
              <div className="text-xs text-zinc-500">Food &amp; Drinks · Today</div>
            </div>
          </div>
          <div className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">₹25</div>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <div className="rounded-2xl rounded-br-md bg-emerald-600 px-4 py-2 text-sm text-white">Monthly average without school fees?</div>
      </div>
      <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid grid-cols-2 gap-px bg-zinc-100 dark:bg-zinc-800">
          <div className="bg-white px-4 py-3 dark:bg-zinc-950">
            <div className="text-xs text-zinc-500">Typical month</div>
            <div className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">₹18,240</div>
          </div>
          <div className="bg-white px-4 py-3 dark:bg-zinc-950">
            <div className="text-xs text-zinc-500">With one-offs</div>
            <div className="text-lg font-semibold tabular-nums text-zinc-400">₹26,610</div>
          </div>
        </div>
        <div className="space-y-2 px-4 py-3">
          {[
            ["🛒 Groceries", 72],
            ["🍽️ Food & Drinks", 48],
            ["🚌 Transport", 30],
          ].map(([label, pct]) => (
            <div key={label as string}>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">{label}</div>
              <div className="mt-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-dvh bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:px-6">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
          <span className="font-semibold">Expenses</span>
        </div>
        <Link
          href="/login"
          className="rounded-full px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
        >
          Sign in
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-4 pt-6 pb-14 sm:px-6 md:grid-cols-2 md:pt-12 md:pb-20">
          <div className="text-center md:text-left">
            <p className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
              Your AI expense manager
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Track spending by <span className="text-emerald-600 dark:text-emerald-400">just saying it.</span>
            </h1>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
              No forms, no spreadsheets. Chat what you spent, then ask for weekly, monthly or yearly reports and advice on
              where to save.
            </p>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start">
              <Link
                href="/login"
                className="w-full rounded-xl bg-emerald-600 px-6 py-3 text-center font-medium text-white shadow-sm hover:bg-emerald-700 sm:w-auto"
              >
                Sign in to start
              </Link>
              <a
                href="#features"
                className="w-full rounded-xl px-6 py-3 text-center font-medium text-zinc-700 hover:bg-zinc-100 sm:w-auto dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                See what it does
              </a>
            </div>
          </div>
          <ChatPreview />
        </section>

        <section id="features" className="border-t border-zinc-100 bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-900/40">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 md:py-20">
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">Everything happens in one chat</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="text-2xl">{f.emoji}</div>
                  <h3 className="mt-3 font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 md:py-20">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">Try asking</h2>
          <div className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-2">
            {EXAMPLES.map((e) => (
              <span
                key={e}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                “{e}”
              </span>
            ))}
          </div>
          <div className="mt-12 rounded-3xl bg-emerald-600 px-6 py-10 text-center text-white">
            <h2 className="text-2xl font-bold">Ready when you are</h2>
            <p className="mt-2 text-emerald-50">Sign in with your passcode and log your first expense.</p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-xl bg-white px-6 py-3 font-medium text-emerald-700 hover:bg-emerald-50"
            >
              Sign in
            </Link>
          </div>
        </section>
      </main>

      <footer className="pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-xs text-zinc-500">
        Amounts in rupees · Add it to your home screen for quick logging
      </footer>
    </div>
  );
}
