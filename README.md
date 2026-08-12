# QuoteHub — quotations & invoices for Kavita Global Industrial Solution

An internal web app for creating GST quotations and tax invoices for
domestic customers, and zero-rated export documents in any currency.
You store your customers and products once; every document then needs
only a customer, a few line items, and quantities. All tax maths is
worked out for you.

**Domestic**

- CGST + SGST for customers in Gujarat, IGST for other states, switched
  automatically from the GST state code
- Per-line GST slabs (0 / 0.25 / 3 / 5 / 12 / 18 / 28%)
- HSN/SAC tax summary and round-off, as GST rules require

**Export**

- Any customer with a country other than India is treated as an export:
  GST is dropped entirely and the document is marked zero-rated under
  Section 16 of the IGST Act
- **Custom taxes** — add your own named tax rows (VAT, Customs Duty,
  Withholding Tax, anything) as a percentage of the taxable value
- **34 currencies** with correct symbols, digit grouping, decimal
  places, and amount-in-words

**Both**

- Line items grouped into named **sections** with their own subtotals,
  for quoting several machines on one document
- A **Remark** column per line (SAME TO SAME, WITHOUT PROG, MODEL CHANGE)
- Line-level and order-level discounts, freight apportioned across lines
- Company logo, stamp and signature printed on every document
- One click to turn an accepted quotation into an invoice
- Print or save as PDF straight from the browser

---

## 1. Company details

**`src/config/company.ts`** already holds your details: name, address,
GSTIN `24ELLPBB8167B1Z8`, IEC, phone numbers, Axis Bank account, terms
and the document numbering. That one file feeds every printed document —
edit it if anything changes.

Your logo and your stamp/signature are already installed at
`public/logo/logo.png` and `public/logo/signature.png`, with their white
backgrounds removed so they sit cleanly on the page. Replace either file
to change it; no code change needed.

Two things worth knowing:

- The GSTIN's first two digits (`24`) must match `address.stateCode`.
  That code is what decides CGST+SGST versus IGST.
- `bank.swift` is empty. Fill it in and it will print on export
  documents, where overseas buyers usually need it to remit payment.

---

## 2. Get a free database

Sign up at **[neon.tech](https://neon.tech)** and create a project. The
free tier is genuinely free with no card: 0.5 GB of storage and a
Postgres database that sleeps when idle. For a business writing a few
hundred invoices a month you will not come close to the limit.

From the Neon dashboard, copy the **pooled** connection string.

Then in the project folder:

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in three values:

| Variable       | What to put                                               |
| -------------- | --------------------------------------------------------- |
| `DATABASE_URL` | The Neon connection string you just copied                 |
| `APP_PASSWORD` | The password everyone types to get in. Make it long.       |
| `AUTH_SECRET`  | Run `openssl rand -base64 32` and paste the result         |

Create the tables:

```bash
npm install
npm run db:push
```

Optionally load a few sample customers and products to click around
with:

```bash
npm run db:seed
```

---

## 3. Run it

```bash
npm run dev
```

Open <http://localhost:3000>, enter your `APP_PASSWORD`, and you are in.

---

## 4. Put it online

Push the project to GitHub, then import it at
**[vercel.com](https://vercel.com)**. Vercel's Hobby plan is free for
this kind of internal tool.

During import, add the same three environment variables
(`DATABASE_URL`, `APP_PASSWORD`, `AUTH_SECRET`) under
**Settings → Environment Variables**. Deploy, and the app is live on a
URL you can open from any phone or laptop.

Nothing else needs configuring. The database tables were already created
in step 2 and Neon is reachable from Vercel out of the box.

---

## Day-to-day use

**Customers** — add each business once. Set the **country**: leave it as
India for a domestic customer, or type the destination country for an
overseas one. That single field decides everything else — an overseas
customer gets no GST, an export declaration on the document, and a
default currency you can set alongside it. For Indian customers, pasting
the GSTIN fills the state in, which is what decides CGST+SGST vs IGST.

**Sections** — a quotation covering two machines can be split into
"M2407 — SPARE ELECTRICAL" and "M2408 — SPARES", each with its own
subtotal, using **Add section**. Leave the section name blank and the
document prints as one plain list.

**Custom taxes** — the panel under the line items. Press a preset chip
(VAT 5%, Customs Duty 10%) or **Add tax** and type your own name and
percentage. Each row is charged on the taxable value; they do not
compound on each other. They print as their own lines in the totals.
Available on domestic documents too, for anything GST does not cover.

**Currency** — set per document, defaulting to the customer's. Rates you
type are in that currency. The product catalogue holds one base rate in
rupees, so adjust the rate on the line when quoting abroad — the app
does not convert, deliberately, since a stale exchange rate on a printed
quotation is worse than none.

**Products** — save anything you sell more than once, with its HSN or
SAC code, unit, rate and GST slab. Line items then fill themselves in
from a dropdown. You can always type a line by hand instead.

**Quotations and invoices** — pick a customer, add lines, watch the
totals update as you type. Save, then use **Print / Save PDF** and
choose "Save as PDF" as the destination to get a file you can email.

**Converting** — open an accepted quotation and press **Convert to
invoice**. Every line is copied across, a fresh invoice number is
allocated, and the quotation is marked accepted and linked to its
invoice. A quotation can only be converted once.

**Status** — quotations move through draft → sent → accepted/rejected,
invoices through draft → sent → paid. The dashboard totals read from
these, so keeping them current is what makes "Outstanding" meaningful.

---

## How the tax is worked out

Worth knowing, because it is the part that has to be right.

1. **Place of supply decides the split.** Country other than India →
   export, no GST at all. Same state as you → CGST + SGST at half the
   slab each. Different Indian state → IGST at the full slab.
2. **Discounts reduce the taxable value**, they are never applied after
   tax. An order-level discount is spread across lines in proportion to
   their value so each line keeps its own slab.
3. **Freight** is treated as part of a composite supply and apportioned
   the same way, inheriting each line's slab.
4. **GST is calculated per line and then added up** — never on the grand
   total. With mixed slabs any other order produces a figure that will
   not reconcile with GSTR-1.
5. **Custom taxes** are charged on the taxable value, each independently.
   They do not compound on one another, and they do not compound on GST.
6. **Rounding** to a whole unit happens only for currencies where that
   is the convention — rupees and yen. A USD document keeps its cents,
   because rounding an export invoice to whole dollars would not match
   the buyer's remittance.

All money is held as integer minor units internally — paise, cents,
fils — so nothing drifts as percentages are applied and re-applied.
Currencies with three decimals (Kuwaiti dinar) and zero decimals (yen)
are handled correctly rather than assumed to be two.

The rules above are covered by tests:

```bash
npm test
```

---

## Changing the document numbering

`src/config/company.ts` → `numbering` builds numbers as
`{prefix}-{year}-{series}{sequence}`, giving `QTN-2026-KGIS001` and
`INV-2026-KGIS001`. **Change `year` each January** — the sequence keeps
counting up from where it was, so if you want it to restart at 001 you
will need a fresh database or a manual adjustment. Numbers already
issued never change.

---

## What is deliberately not here

- **No editing of company details in the UI.** They live in a file so
  that they cannot be changed by accident, and so a wrong GSTIN cannot
  quietly go out on 50 invoices.
- **No currency conversion.** The app never guesses an exchange rate. You
  type the rate in the document's currency.
- **No e-invoicing / IRN generation.** Mandatory only above the
  turnover threshold; it needs a GSP integration.
- **No shipping bill / packing list / certificate of origin.** These are
  the other export documents; the schema would support them.
- **No e-way bills, credit notes, or payment tracking.** Straightforward
  to add later on top of this schema.

---

## A note on page breaks

The bank details, terms and signature block are kept together so they
never split across a page. On a short document that can push them to a
second page, leaving space at the bottom of the first — the same thing
your current quotations do. On a full-length quotation they simply land
at the end of the last page.

---

## Tech

Next.js (App Router) · TypeScript · Tailwind · Drizzle ORM · Postgres.

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Start the dev server                          |
| `npm run build`     | Production build                              |
| `npm test`          | Run the GST calculation tests                 |
| `npm run db:push`   | Create or update the database tables          |
| `npm run db:seed`   | Insert sample customers and products          |
| `npm run db:studio` | Browse the database in a local UI             |
