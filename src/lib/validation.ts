import { z } from "zod";
import { GSTIN_REGEX } from "./gst";
import { CURRENCIES } from "./currency";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => CURRENCIES.some((c) => c.code === v), {
    message: "Unknown currency.",
  });

export const customerSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1, "Customer name is required."),
  contactPerson: optionalText,
  gstin: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => v === "" || GSTIN_REGEX.test(v), {
      message: "That does not look like a valid 15-character GSTIN.",
    })
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  phone: optionalText,
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "Enter a valid email address.",
    })
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  addressLine1: optionalText,
  addressLine2: optionalText,
  city: optionalText,
  state: optionalText,
  stateCode: optionalText,
  pincode: optionalText,
  country: z.string().trim().min(1).default("India"),
  currency: currencyCode.default("INR"),
  notes: optionalText,
});

export type CustomerInput = z.input<typeof customerSchema>;

export const productSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1, "Product name is required."),
  description: optionalText,
  hsn: optionalText,
  unit: z.string().trim().min(1).default("Nos"),
  rate: z.coerce.number().min(0, "Rate cannot be negative."),
  gstRate: z.coerce.number().min(0).max(100),
  isActive: z.coerce.boolean().default(true),
});

export const lineItemSchema = z.object({
  productId: z.coerce.number().int().positive().nullable().optional(),
  section: optionalText,
  name: z.string().trim().min(1, "Each line needs a description."),
  description: optionalText,
  remark: optionalText,
  hsn: optionalText,
  unit: z.string().trim().default("Nos"),
  quantity: z.coerce.number().gt(0, "Quantity must be more than zero."),
  rate: z.coerce.number().min(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  gstRate: z.coerce.number().min(0).max(100),
});

export const customTaxSchema = z.object({
  name: z.string().trim().min(1, "Give the tax a name."),
  percent: z.coerce.number().min(0).max(100),
});

export const documentSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  type: z.enum(["quotation", "invoice"]),
  status: z
    .enum(["draft", "sent", "accepted", "rejected", "paid", "cancelled"])
    .default("draft"),
  customerId: z.coerce.number().int().positive({
    message: "Pick a customer first.",
  }),
  currency: currencyCode.default("INR"),
  machineRef: optionalText,
  issueDate: z.string().min(1),
  dueDate: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  poNumber: optionalText,
  notes: optionalText,
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  shipping: z.coerce.number().min(0).default(0),
  customTaxes: z.array(customTaxSchema).default([]),
  items: z.array(lineItemSchema).min(1, "Add at least one line item."),
});

export type DocumentFormInput = z.input<typeof documentSchema>;
export type DocumentFormValues = z.output<typeof documentSchema>;
