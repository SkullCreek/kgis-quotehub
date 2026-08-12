"use server";

import { revalidatePath } from "next/cache";
import { eq, or, ilike, and } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { productSchema } from "@/lib/validation";
import type { ActionResult } from "./customers";

export async function listProducts(query?: string, includeInactive = false) {
  const q = query?.trim();
  const activeFilter = includeInactive ? undefined : eq(products.isActive, 1);

  if (q) {
    const search = or(
      ilike(products.name, `%${q}%`),
      ilike(products.hsn, `%${q}%`),
      ilike(products.description, `%${q}%`),
    );
    return db
      .select()
      .from(products)
      .where(activeFilter ? and(activeFilter, search) : search)
      .orderBy(products.name)
      .limit(100);
  }

  return db
    .select()
    .from(products)
    .where(activeFilter)
    .orderBy(products.name)
    .limit(500);
}

export async function saveProduct(
  raw: unknown,
): Promise<ActionResult<{ id: number }>> {
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const v = parsed.data;
  const payload = {
    name: v.name,
    description: v.description ?? null,
    hsn: v.hsn ?? null,
    unit: v.unit,
    rate: v.rate.toFixed(2),
    gstRate: v.gstRate.toFixed(2),
    isActive: v.isActive ? 1 : 0,
  };

  try {
    if (v.id) {
      await db.update(products).set(payload).where(eq(products.id, v.id));
      revalidatePath("/products");
      return { ok: true, data: { id: v.id } };
    }
    const inserted = await db
      .insert(products)
      .values(payload)
      .returning({ id: products.id });
    revalidatePath("/products");
    return { ok: true, data: { id: inserted[0].id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteProduct(id: number): Promise<ActionResult> {
  try {
    // Soft delete: existing documents keep their line items intact.
    await db.update(products).set({ isActive: 0 }).where(eq(products.id, id));
    revalidatePath("/products");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
