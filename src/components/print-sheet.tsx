import { COMPANY } from "@/config/company";
import type { FullDocument } from "@/lib/actions/documents";
import { amountInWords, decimalStringToMinor, formatMoney, formatQty } from "@/lib/money";
import { getCurrency } from "@/lib/currency";
import type { LineItemRow } from "@/db/schema";

const formatDate = (d: Date | string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export function PrintSheet({ doc }: { doc: FullDocument }) {
  const isInvoice = doc.type === "invoice";
  const isProforma = doc.type === "proforma";
  const isExport = doc.taxMode === "export";
  const isIgst = doc.taxMode === "igst";
  const c = doc.customer;
  const currency = getCurrency(doc.currency);

  /** Stored decimals -> minor units, using this document's currency. */
  const m = (v: string | null) => decimalStringToMinor(v, currency);
  const money = (minor: number, withSymbol = true) =>
    formatMoney(minor, currency, withSymbol);

  const heading = isProforma
    ? "PROFORMA INVOICE"
    : isInvoice
      ? isExport
        ? "EXPORT INVOICE"
        : "TAX INVOICE"
      : "QUOTATION";

  const total = m(doc.total);
  const roundOff = m(doc.roundOff);

  // Group lines into the contiguous sections they were saved in.
  const sections: { name: string | null; items: LineItemRow[] }[] = [];
  for (const item of doc.items) {
    const last = sections[sections.length - 1];
    if (last && last.name === item.section) last.items.push(item);
    else sections.push({ name: item.section, items: [item] });
  }
  const hasNamedSections = sections.some((s) => (s.name ?? "").trim() !== "");
  const showRemark = doc.items.some((i) => (i.remark ?? "").trim() !== "");

  // Rebuild the slab summary from the stored lines so the printed
  // figures always match what was saved, never a recomputation.
  const summary = new Map<
    string,
    { hsn: string; gstRate: number; taxable: number; tax: number }
  >();
  for (const item of doc.items) {
    const hsn = (item.hsn ?? "").trim() || "—";
    const gstRate = Number(item.gstRate);
    const key = `${hsn}::${gstRate}`;
    const row = summary.get(key) ?? { hsn, gstRate, taxable: 0, tax: 0 };
    row.taxable += m(item.lineTaxable);
    row.tax += m(item.lineTax);
    summary.set(key, row);
  }
  const summaryRows = [...summary.values()].sort(
    (a, b) => a.gstRate - b.gstRate || a.hsn.localeCompare(b.hsn),
  );

  const terms = [
    ...(isProforma
      ? COMPANY.terms.proforma
      : isInvoice
        ? COMPANY.terms.invoice
        : COMPANY.terms.quotation),
    ...COMPANY.terms.common,
    ...(isExport ? COMPANY.terms.export : []),
  ];

  let lineNumber = 0;

  return (
    <div className="print-sheet print-keep-color mx-auto w-full max-w-[210mm] bg-white p-6 text-[11px] leading-snug text-slate-900 shadow-sm">
      {/* ---------------- Header ---------------- */}
      <div className="flex items-start gap-4 border-b-2 border-slate-900 pb-4">
        {COMPANY.logoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={COMPANY.logoPath}
            alt=""
            className="h-16 w-auto max-w-[210px] object-contain"
          />
        ) : null}

        <div className="min-w-0 flex-1 text-right">
          <h1 className="text-[15px] font-bold tracking-tight">
            {COMPANY.name}
          </h1>
          <p className="mt-0.5 text-slate-600">
            {COMPANY.address.line1}
            {COMPANY.address.line2 ? `, ${COMPANY.address.line2}` : ""},{" "}
            {COMPANY.address.city} - {COMPANY.address.pincode}
          </p>
          <p className="text-slate-600">
            GSTIN: <span className="font-mono">{COMPANY.gstin}</span>
            {COMPANY.iec ? (
              <>
                {" "}
                | IEC: <span className="font-mono">{COMPANY.iec}</span>
              </>
            ) : null}
            {isExport && COMPANY.adCode ? (
              <>
                {" "}
                | AD Code: <span className="font-mono">{COMPANY.adCode}</span>
              </>
            ) : null}
          </p>
          <p className="text-slate-600">
            Mobile: {COMPANY.phone}
            {COMPANY.email ? ` | ${COMPANY.email}` : ""}
          </p>
        </div>
      </div>

      {/* ---------------- Title ---------------- */}
      <div className="my-4 text-center">
        <span className="print-keep-color inline-block rounded bg-[#8b1a1a] px-8 py-1.5 text-[13px] font-bold tracking-[0.2em] text-white">
          {heading}
        </span>
      </div>

      {/* ---------------- Parties and meta ---------------- */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded border-l-4 border-[#8b1a1a] bg-slate-50 p-3">
          <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-slate-500">
            {isProforma
              ? "Proforma Invoice to"
              : isInvoice
                ? "Bill to"
                : "Quotation to"}
          </div>
          <div className="text-[12px] font-bold">{c.name}</div>
          {c.contactPerson ? (
            <div className="text-slate-600">Attn: {c.contactPerson}</div>
          ) : null}
          <div className="mt-1 text-slate-600">
            {[c.addressLine1, c.addressLine2].filter(Boolean).join(", ")}
            {c.addressLine1 || c.addressLine2 ? <br /> : null}
            {[c.city, c.pincode].filter(Boolean).join(" - ")}
            {c.state ? `, ${c.state}` : ""}
            {c.country && c.country !== "India" ? `, ${c.country}` : ""}
          </div>
          {c.phone || c.email ? (
            <div className="mt-1 text-slate-600">
              {[c.phone, c.email].filter(Boolean).join(" · ")}
            </div>
          ) : null}
          {isExport && !c.gstin ? null : (
            <div className="mt-1.5 border-t border-slate-200 pt-1.5">
              <span className="text-slate-500">
                {isExport ? "Buyer Tax ID: " : "GSTIN: "}
              </span>
              <span className="font-mono font-semibold">
                {c.gstin ?? (isExport ? "Not applicable" : "Unregistered")}
              </span>
            </div>
          )}
          <div>
            <span className="text-slate-500">Place of supply: </span>
            {isExport
              ? `${c.country} (export)`
              : `${c.state ?? COMPANY.address.state}${c.stateCode ? ` (${c.stateCode})` : ""}`}
          </div>
        </div>

        <div className="rounded border-l-4 border-amber-500 bg-slate-50 p-3">
          <table className="w-full">
            <tbody>
              <Meta
                label={
                  isProforma
                    ? "Proforma no."
                    : isInvoice
                      ? "Invoice no."
                      : "Quotation no."
                }
                value={<span className="font-mono font-bold">{doc.number}</span>}
              />
              <Meta label="Date" value={formatDate(doc.issueDate)} />
              {isInvoice && doc.dueDate ? (
                <Meta label="Payment due" value={formatDate(doc.dueDate)} />
              ) : null}
              {(doc.type === "quotation" || doc.type === "proforma") &&
              doc.validUntil ? (
                <Meta label="Valid until" value={formatDate(doc.validUntil)} />
              ) : null}
              {doc.machineRef ? (
                <Meta label="Machine ref." value={<b>{doc.machineRef}</b>} />
              ) : null}
              {doc.poNumber ? (
                <Meta label="Your reference" value={doc.poNumber} />
              ) : null}
              {isExport && doc.incoterms ? (
                <Meta label="Incoterms" value={<b>{doc.incoterms}</b>} />
              ) : null}
              {isExport && doc.portOfLoading ? (
                <Meta label="Port of loading" value={doc.portOfLoading} />
              ) : null}
              {isExport && doc.portOfDischarge ? (
                <Meta label="Port of discharge" value={doc.portOfDischarge} />
              ) : null}
              <Meta
                label="Currency"
                value={
                  <b>
                    {currency.code} — {currency.name}
                  </b>
                }
              />
              <Meta
                label="Tax type"
                value={
                  isExport
                    ? "Export — zero-rated"
                    : isIgst
                      ? "IGST (inter-state)"
                      : "CGST + SGST (intra-state)"
                }
              />
              {doc.status === "cancelled" ? (
                <Meta
                  label="Status"
                  value={<span className="font-bold text-red-600">CANCELLED</span>}
                />
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- Line items, by section ---------------- */}
      {sections.map((section, si) => {
        const sectionTotal = section.items.reduce(
          (a, i) => a + m(i.lineTotal),
          0,
        );
        return (
          <div key={si} className="mt-4">
            {hasNamedSections ? (
              <div className="print-keep-color rounded-t bg-[#1e3a5f] px-3 py-1.5 text-[11px] font-bold tracking-wide text-white">
                {(section.name ?? "").trim() || "OTHER ITEMS"}
              </div>
            ) : null}

            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col style={{ width: "4%" }} />
                <col style={{ width: showRemark ? "27%" : "37%" }} />
                {showRemark ? <col style={{ width: "12%" }} /> : null}
                <col style={{ width: "9%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "11%" }} />
                {!isExport ? <col style={{ width: "6%" }} /> : null}
                <col style={{ width: isExport ? "18%" : "12%" }} />
              </colgroup>
              <thead>
                <tr className="print-keep-color bg-slate-700 text-left text-[9px] uppercase tracking-wider text-white">
                  <th className="border border-slate-700 px-2 py-1.5 font-semibold">
                    SL
                  </th>
                  <th className="border border-slate-700 px-2 py-1.5 font-semibold">
                    Description
                  </th>
                  {showRemark ? (
                    <th className="border border-slate-700 px-2 py-1.5 font-semibold">
                      Remark
                    </th>
                  ) : null}
                  <th className="border border-slate-700 px-2 py-1.5 font-semibold">
                    HSN/SAC
                  </th>
                  <th className="border border-slate-700 px-2 py-1.5 text-right font-semibold">
                    Qty
                  </th>
                  <th className="border border-slate-700 px-2 py-1.5 text-right font-semibold">
                    Rate ({currency.code})
                  </th>
                  {!isExport ? (
                    <th className="border border-slate-700 px-2 py-1.5 text-right font-semibold">
                      GST
                    </th>
                  ) : null}
                  <th className="border border-slate-700 px-2 py-1.5 text-right font-semibold">
                    Amount ({currency.code})
                  </th>
                </tr>
              </thead>
              <tbody>
                {section.items.map((item) => {
                  lineNumber += 1;
                  return (
                    <tr key={item.id} className="align-top">
                      <td className="border border-slate-300 px-2 py-1.5 text-slate-500">
                        {lineNumber}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5">
                        <div className="font-medium">{item.name}</div>
                        {item.description ? (
                          <div className="text-[10px] text-slate-500">
                            {item.description}
                          </div>
                        ) : null}
                      </td>
                      {showRemark ? (
                        <td className="border border-slate-300 px-2 py-1.5 text-[9px] uppercase text-slate-500">
                          {item.remark ?? ""}
                        </td>
                      ) : null}
                      <td className="border border-slate-300 px-2 py-1.5 font-mono text-[10px]">
                        {item.hsn ?? "—"}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right whitespace-nowrap">
                        {formatQty(item.quantity)} {item.unit}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right">
                        {money(m(item.rate), false)}
                        {Number(item.discountPercent) > 0 ? (
                          <div className="text-[9px] text-emerald-600">
                            −{Number(item.discountPercent)}%
                          </div>
                        ) : null}
                      </td>
                      {!isExport ? (
                        <td className="border border-slate-300 px-2 py-1.5 text-right">
                          {Number(item.gstRate)}%
                        </td>
                      ) : null}
                      <td className="border border-slate-300 px-2 py-1.5 text-right font-medium">
                        {money(m(item.lineTotal), false)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {hasNamedSections ? (
                <tfoot>
                  <tr className="print-keep-color bg-amber-50">
                    <td
                      colSpan={showRemark ? (isExport ? 6 : 7) : isExport ? 5 : 6}
                      className="border border-slate-300 px-2 py-1 text-right text-[10px] font-semibold text-slate-600"
                    >
                      Subtotal — {(section.name ?? "").trim() || "Other items"}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-right text-[10px] font-bold">
                      {money(sectionTotal)}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        );
      })}

      {/* ---------------- Summary and totals ---------------- */}
      <div className="avoid-break mt-4 grid grid-cols-2 gap-4">
        <div>
          {!isExport ? (
            <>
              <div className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-slate-500">
                Tax summary
              </div>
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="border border-slate-300 px-2 py-1 font-semibold">
                      HSN/SAC
                    </th>
                    <th className="border border-slate-300 px-2 py-1 text-right font-semibold">
                      Taxable
                    </th>
                    <th className="border border-slate-300 px-2 py-1 text-right font-semibold">
                      Rate
                    </th>
                    <th className="border border-slate-300 px-2 py-1 text-right font-semibold">
                      Tax
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((r) => (
                    <tr key={`${r.hsn}-${r.gstRate}`}>
                      <td className="border border-slate-300 px-2 py-1 font-mono">
                        {r.hsn}
                      </td>
                      <td className="border border-slate-300 px-2 py-1 text-right">
                        {money(r.taxable, false)}
                      </td>
                      <td className="border border-slate-300 px-2 py-1 text-right">
                        {r.gstRate}%
                      </td>
                      <td className="border border-slate-300 px-2 py-1 text-right">
                        {money(r.tax, false)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          <div className="mt-3 rounded border border-slate-300 p-2">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">
              Amount in words
            </div>
            <div className="mt-0.5 font-medium">
              {amountInWords(total, currency)}
            </div>
          </div>
        </div>

        <div>
          <table className="w-full">
            <tbody>
              <Total label="Subtotal" value={m(doc.subtotal)} money={money} />
              {m(doc.discountAmount) > 0 ? (
                <Total
                  label="Discount"
                  value={-m(doc.discountAmount)}
                  money={money}
                />
              ) : null}
              {m(doc.shipping) > 0 ? (
                <Total
                  label="Freight / packing"
                  value={m(doc.shipping)}
                  money={money}
                />
              ) : null}
              <Total
                label="Taxable value"
                value={m(doc.taxableValue)}
                money={money}
                bordered
              />

              {isExport ? (
                <tr>
                  <td className="px-2 py-1 text-slate-600">GST</td>
                  <td className="px-2 py-1 text-right font-medium">
                    Zero-rated
                  </td>
                </tr>
              ) : isIgst ? (
                <Total label="IGST" value={m(doc.igst)} money={money} />
              ) : (
                <>
                  <Total label="CGST" value={m(doc.cgst)} money={money} />
                  <Total label="SGST" value={m(doc.sgst)} money={money} />
                </>
              )}

              {doc.parsedCustomTaxes.map((t, i) => (
                <Total
                  key={i}
                  label={`${t.name} @ ${t.percent}%`}
                  value={m(t.amount)}
                  money={money}
                />
              ))}

              {roundOff !== 0 ? (
                <Total label="Round off" value={roundOff} money={money} />
              ) : null}

              <tr className="print-keep-color bg-[#8b1a1a] text-white">
                <td className="px-2 py-2 text-[12px] font-bold">
                  Grand total ({currency.code})
                </td>
                <td className="px-2 py-2 text-right text-[14px] font-bold">
                  {money(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- Notes, bank, terms ---------------- */}
      <div className="avoid-break mt-4 grid grid-cols-2 gap-4">
        <div className="space-y-3">
          {doc.notes ? (
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">
                Notes
              </div>
              <p className="mt-0.5 whitespace-pre-line text-slate-700">
                {doc.notes}
              </p>
            </div>
          ) : null}

          <div>
            <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">
              Bank / A/C details
            </div>
            <table className="mt-0.5">
              <tbody className="text-slate-700">
                <BankRow label="Account name" value={COMPANY.bank.accountName} />
                <BankRow label="Bank" value={COMPANY.bank.name} />
                <BankRow
                  label="A/C no."
                  value={
                    <span className="font-mono">
                      {COMPANY.bank.accountNumber}
                    </span>
                  }
                />
                <BankRow
                  label="IFSC"
                  value={<span className="font-mono">{COMPANY.bank.ifsc}</span>}
                />
                {COMPANY.bank.micr ? (
                  <BankRow
                    label="MICR"
                    value={<span className="font-mono">{COMPANY.bank.micr}</span>}
                  />
                ) : null}
                {COMPANY.bank.branch ? (
                  <BankRow label="Branch" value={COMPANY.bank.branch} />
                ) : null}
                {isExport && COMPANY.bank.swift ? (
                  <BankRow
                    label="SWIFT"
                    value={<span className="font-mono">{COMPANY.bank.swift}</span>}
                  />
                ) : null}
                {COMPANY.bank.upi ? (
                  <BankRow
                    label="UPI"
                    value={<span className="font-mono">{COMPANY.bank.upi}</span>}
                  />
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">
            Terms &amp; conditions
          </div>
          <ol className="mt-0.5 list-decimal space-y-0.5 pl-4 text-[10px] text-slate-600">
            {terms.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>

          {/* Stamp and signature */}
          <div className="mt-auto pt-3 text-right">
            {COMPANY.signaturePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={COMPANY.signaturePath}
                alt="Authorised signature"
                className="ml-auto h-20 w-auto max-w-[240px] object-contain"
              />
            ) : (
              <div className="ml-auto w-64 border-t border-slate-400 pt-1 text-center">
                <div className="font-semibold">For {COMPANY.name}</div>
                <div className="text-[10px] text-slate-500">
                  Authorised signatory
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="mt-4 border-t border-slate-200 pt-2 text-center text-[9px] text-slate-400">
        {isProforma
          ? "This is a Proforma Invoice issued for customs clearance, LC opening, and pre-shipment documentation. It is not a tax invoice."
          : isInvoice
            ? "This is a computer-generated tax invoice and is valid without a physical signature."
            : `This quotation is valid until ${formatDate(doc.validUntil)} and is not a demand for payment.`}
      </p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td className="py-0.5 pr-3 align-top whitespace-nowrap text-slate-500">
        {label}
      </td>
      <td className="py-0.5 text-right">{value}</td>
    </tr>
  );
}

function Total({
  label,
  value,
  money,
  bordered = false,
}: {
  label: string;
  value: number;
  money: (minor: number, withSymbol?: boolean) => string;
  bordered?: boolean;
}) {
  return (
    <tr className={bordered ? "border-t border-slate-300" : ""}>
      <td className="px-2 py-1 text-slate-600">{label}</td>
      <td className="px-2 py-1 text-right font-medium">
        {value < 0 ? `− ${money(-value)}` : money(value)}
      </td>
    </tr>
  );
}

function BankRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td className="py-0.5 pr-3 align-top whitespace-nowrap text-slate-500">
        {label}
      </td>
      <td className="py-0.5">{value}</td>
    </tr>
  );
}
