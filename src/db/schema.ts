import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  numeric,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const docTypeEnum = pgEnum("doc_type", [
  "quotation",
  "invoice",
  "proforma",
]);
export const docStatusEnum = pgEnum("doc_status", [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "paid",
  "cancelled",
]);

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  gstin: text("gstin"),
  phone: text("phone"),
  email: text("email"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  state: text("state"),
  /** Two-digit GST state code — drives CGST+SGST vs IGST. */
  stateCode: text("state_code"),
  pincode: text("pincode"),
  /** Anything other than India marks the sale as an export. */
  country: text("country").default("India").notNull(),
  /** Default currency for this customer's documents. */
  currency: text("currency").default("INR").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  /** HSN (goods) or SAC (services) code. */
  hsn: text("hsn"),
  unit: text("unit").default("Nos").notNull(),
  /** Rate per unit, exclusive of GST. */
  rate: numeric("rate", { precision: 14, scale: 2 }).default("0").notNull(),
  /** GST slab percentage: 0, 5, 12, 18, 28. */
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 })
    .default("18")
    .notNull(),
  isActive: integer("is_active").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    type: docTypeEnum("type").notNull(),
    status: docStatusEnum("status").default("draft").notNull(),
    /** Human-facing number, e.g. INV/26-27/0007. Unique per document. */
    number: text("number").notNull().unique(),
    /** Sequence within the type, used to generate the next number. */
    seq: integer("seq").notNull(),

    customerId: integer("customer_id")
      .references(() => customers.id, { onDelete: "restrict" })
      .notNull(),

    /** Snapshot of customer details at issue time, so edits later don't rewrite history. */
    customerSnapshot: text("customer_snapshot").notNull(),

    issueDate: timestamp("issue_date").defaultNow().notNull(),
    dueDate: timestamp("due_date"),
    /** Quotations only. */
    validUntil: timestamp("valid_until"),

    /**
     * "cgst_sgst" same state, "igst" other state, "export" outside
     * India (zero-rated, custom taxes only).
     */
    taxMode: text("tax_mode").notNull(),

    /** ISO currency code the document is priced in. */
    currency: text("currency").default("INR").notNull(),

    /** Free-text machine or project reference, printed in the header. */
    machineRef: text("machine_ref"),

    /** Export compliance & logistics fields (Indian Customs & GST Sec 16) */
    exportScheme: text("export_scheme").default("lut"),
    exportLutNumber: text("export_lut_number"),
    exportLutDate: text("export_lut_date"),
    portOfLoading: text("port_of_loading"),
    portOfDischarge: text("port_of_discharge"),
    incoterms: text("incoterms"),
    modeOfShipment: text("mode_of_shipment"),
    countryOfOrigin: text("country_of_origin").default("India"),
    totalPackages: text("total_packages"),
    netWeight: text("net_weight"),
    grossWeight: text("gross_weight"),

    /**
     * Named taxes entered by hand, stored as JSON:
     * [{ "name": "VAT", "percent": 5 }]. Each is a percentage of the
     * taxable value. Used for destination-country taxes on exports.
     */
    customTaxes: text("custom_taxes").default("[]").notNull(),

    /** Order-level discount applied on subtotal, as a percentage. */
    discountPercent: numeric("discount_percent", { precision: 5, scale: 2 })
      .default("0")
      .notNull(),

    /** Flat charge added before tax, e.g. freight or packing. */
    shipping: numeric("shipping", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    notes: text("notes"),
    poNumber: text("po_number"),

    /** Computed totals, stored so printed documents never drift. */
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).notNull(),
    taxableValue: numeric("taxable_value", { precision: 14, scale: 2 }).notNull(),
    cgst: numeric("cgst", { precision: 14, scale: 2 }).notNull(),
    sgst: numeric("sgst", { precision: 14, scale: 2 }).notNull(),
    igst: numeric("igst", { precision: 14, scale: 2 }).notNull(),
    /** Sum of the custom tax rows. */
    customTaxTotal: numeric("custom_tax_total", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    roundOff: numeric("round_off", { precision: 14, scale: 2 }).notNull(),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),

    /** Set when a quotation/proforma has been converted, pointing at the new document. */
    convertedToId: integer("converted_to_id"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("documents_type_seq_idx").on(t.type, t.seq),
    index("documents_customer_idx").on(t.customerId),
  ],
);

export const lineItems = pgTable(
  "line_items",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id")
      .references(() => documents.id, { onDelete: "cascade" })
      .notNull(),
    /** Nullable: lines can be typed freehand without a saved product. */
    productId: integer("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    position: integer("position").notNull(),

    /**
     * Section heading this line sits under, e.g. a machine reference
     * like "M2407 — SPARE ELECTRICAL". Empty means an ungrouped line.
     * Sections are contiguous runs ordered by `position`.
     */
    section: text("section"),

    name: text("name").notNull(),
    description: text("description"),
    /** Short note printed beside the line, e.g. "SAME TO SAME". */
    remark: text("remark"),
    hsn: text("hsn"),
    unit: text("unit").default("Nos").notNull(),

    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    rate: numeric("rate", { precision: 14, scale: 2 }).notNull(),
    /** Per-line discount percentage. */
    discountPercent: numeric("discount_percent", { precision: 5, scale: 2 })
      .default("0")
      .notNull(),
    gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull(),

    /** Computed per-line values. */
    lineSubtotal: numeric("line_subtotal", { precision: 14, scale: 2 }).notNull(),
    lineTaxable: numeric("line_taxable", { precision: 14, scale: 2 }).notNull(),
    lineTax: numeric("line_tax", { precision: 14, scale: 2 }).notNull(),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
  },
  (t) => [index("line_items_document_idx").on(t.documentId)],
);

export const documentsRelations = relations(documents, ({ one, many }) => ({
  customer: one(customers, {
    fields: [documents.customerId],
    references: [customers.id],
  }),
  items: many(lineItems),
}));

export const lineItemsRelations = relations(lineItems, ({ one }) => ({
  document: one(documents, {
    fields: [lineItems.documentId],
    references: [documents.id],
  }),
  product: one(products, {
    fields: [lineItems.productId],
    references: [products.id],
  }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  documents: many(documents),
}));

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type DocumentRow = typeof documents.$inferSelect;
export type LineItemRow = typeof lineItems.$inferSelect;
