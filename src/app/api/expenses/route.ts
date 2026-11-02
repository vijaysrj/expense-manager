import { NextResponse } from "next/server";
import { listExpenses } from "@/lib/db";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** GET /api/expenses?month=YYYY-MM — that month's expenses, newest first. */
export async function GET(req: Request) {
  const param = new URL(req.url).searchParams.get("month");
  const month = param && /^\d{4}-(0[1-9]|1[0-2])$/.test(param) ? param : todayISO().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const expenses = await listExpenses(`${month}-01`, `${month}-${String(last).padStart(2, "0")}`);
  return NextResponse.json({ month, expenses: expenses.reverse() });
}
