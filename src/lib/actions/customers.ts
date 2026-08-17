"use server";

import { revalidatePath } from "next/cache";
import { eq, desc, or, ilike } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { customerSchema } from "@/lib/validation";
import { stateCodeFromGstin, STATE_CODES, isExport } from "@/lib/gst";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function listCustomers(query?: string) {
  const q = query?.trim();
  if (q) {
    return db
      .select()
      .from(customers)
      .where(
        or(
          ilike(customers.name, `%${q}%`),
          ilike(customers.gstin, `%${q}%`),
          ilike(customers.phone, `%${q}%`),
          ilike(customers.city, `%${q}%`),
        ),
      )
      .orderBy(customers.name)
      .limit(100);
  }
  return db.select().from(customers).orderBy(customers.name).limit(500);
}

export async function getCustomer(id: number) {
  const rows = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveCustomer(
  raw: unknown,
): Promise<ActionResult<{ id: number }>> {
  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const value = parsed.data;

  // A GSTIN already encodes the state, so derive the code when it is
  // missing rather than making the user pick it twice.
  let stateCode = value.stateCode ?? null;
  let state = value.state ?? null;
  if (!stateCode && value.gstin) {
    stateCode = stateCodeFromGstin(value.gstin);
  }
  if (stateCode && !state) {
    state = STATE_CODES.find((s) => s.code === stateCode)?.name ?? null;
  }

  // Indian state codes and GSTIN are meaningless for an overseas buyer.
  let gstin = value.gstin ?? null;
  if (isExport(value.country)) {
    stateCode = null;
    gstin = null;
  }

  const payload = { ...value, gstin, stateCode, state };
  delete (payload as { id?: number }).id;

  try {
    if (value.id) {
      await db.update(customers).set(payload).where(eq(customers.id, value.id));
      revalidatePath("/customers");
      return { ok: true, data: { id: value.id } };
    }
    const inserted = await db
      .insert(customers)
      .values(payload)
      .returning({ id: customers.id });
    revalidatePath("/customers");
    return { ok: true, data: { id: inserted[0].id } };
  } catch (e) {
    return { ok: false, error: describeDbError(e) };
  }
}

export async function deleteCustomer(id: number): Promise<ActionResult> {
  try {
    await db.delete(customers).where(eq(customers.id, id));
    revalidatePath("/customers");
    return { ok: true, data: undefined };
  } catch {
    // The foreign key is RESTRICT, so this is the usual failure.
    return {
      ok: false,
      error:
        "This customer has quotations or invoices on record, so they cannot be deleted.",
    };
  }
}

export async function recentCustomers(limit = 8) {
  return db
    .select()
    .from(customers)
    .orderBy(desc(customers.createdAt))
    .limit(limit);
}

function describeDbError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (message.includes("does not exist")) {
    return "The database tables are missing. Run `npm run db:push` to create them.";
  }
  return message;
}
