import { NextResponse } from "next/server";
import { isCategory } from "@/lib/categories";
import { deleteExpense, updateExpense, type ExpensePatch } from "@/lib/db";
import { isValidISODate } from "@/lib/dates";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: ExpensePatch = {};
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }
    patch.amount = Math.round(amount * 100) / 100;
  }
  if (body.category !== undefined) {
    if (typeof body.category !== "string" || !isCategory(body.category)) {
      return NextResponse.json({ error: "Unknown category" }, { status: 400 });
    }
    patch.category = body.category;
  }
  if (body.description !== undefined) {
    patch.description = String(body.description).trim().slice(0, 200);
  }
  if (body.spentOn !== undefined) {
    if (typeof body.spentOn !== "string" || !isValidISODate(body.spentOn)) {
      return NextResponse.json({ error: "Date must be YYYY-MM-DD" }, { status: 400 });
    }
    patch.spentOn = body.spentOn;
  }
  if (body.isOneOff !== undefined) patch.isOneOff = Boolean(body.isOneOff);

  const expense = await updateExpense(id, patch);
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ expense });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const ok = await deleteExpense(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
