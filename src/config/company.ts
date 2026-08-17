/**
 * ============================================================
 *  YOUR COMPANY DETAILS — EDIT THIS FILE
 * ============================================================
 *  Everything printed on quotations and invoices comes from
 *  here. Change the values, save, redeploy. Nothing else in the
 *  app needs to be touched.
 *
 *  Logo:      public/logo/logo.png
 *  Signature: public/logo/signature.png  (stamp + sign block)
 * ============================================================
 */

export const COMPANY = {
  name: "KAVITA GLOBAL INDUSTRIAL SOLUTION",
  tagline: "Tradings and Services",

  address: {
    line1: "Flat No: A-1103, Param Skywalk",
    line2: "Chala",
    city: "Vapi",
    state: "Gujarat",
    /** Two-digit GST state code. Must match the first 2 digits of the GSTIN. */
    stateCode: "24",
    pincode: "396191",
    country: "India",
  },

  gstin: "24ELLPBB8167B1Z8",
  pan: "ELLPB8167B",
  /** Importer Exporter Code, printed on export documents. */
  iec: "ELLPB8167B",
  /** Authorized Dealer Code (7 digits) issued by bank and registered with Customs. */
  adCode: "0361712",
  /** Default Letter of Undertaking (LUT) reference number for exports without IGST. */
  defaultLutNumber: "",
  defaultLutDate: "",

  phone: "+91-9998726601 / 9724485878",
  email: "",
  website: "",

  bank: {
    name: "AXIS BANK",
    accountName: "KAVITA GLOBAL INDUSTRIAL SOLUTION",
    accountNumber: "925020036171211",
    ifsc: "UTIB0003080",
    branch: "",
    micr: "396211131",
    /** SWIFT code, printed only on export documents. Leave "" to hide. */
    swift: "",
    upi: "",
  },

  /** Logo path under /public. Set to "" to print the company name as text. */
  logoPath: "/logo/logo.png",

  /**
   * Stamp and signature block, printed at the bottom of every document.
   * This image already carries the "For ..." and "Authorised Signature"
   * wording, so those lines are not drawn separately when it is set.
   */
  signaturePath: "/logo/signature.png",

  /**
   * Terms printed at the bottom of the document. `common` appears on
   * everything; the rest is added according to what is being printed.
   */
  terms: {
    common: [
      "PAYMENT — 100% advance against Proforma Invoice.",
      "DELIVERY — 3-4 weeks.",
      "Subject to Vapi jurisdiction.",
    ],
    quotation: [
      "VALIDITY — This quotation is valid up to the date shown above only.",
      "SUITABILITY — Please confirm suitability before placing the order.",
      "CANCELLATION — Order once placed will not be cancelled under any circumstances.",
      "ORDER REFERENCE — Please mention this quotation no. in your purchase order.",
    ],
    proforma: [
      "PURPOSE — This Proforma Invoice is issued for customs clearance, import license, and LC opening.",
      "REFERENCE — Please mention this Proforma Invoice no. in all bank remittances and orders.",
      "INCOTERMS — Delivery and price terms are as specified on this invoice.",
    ],
    invoice: [
      "Please mention the invoice no. in all correspondence and payments.",
      "Interest @18% p.a. will be charged on payments overdue beyond the due date.",
      "Goods once sold will not be taken back or exchanged.",
    ],
    /** Appended only when the document is an export. */
    export: [
      "This is a zero-rated supply of goods exported out of India.",
      "Any duties, taxes or levies in the destination country are to the buyer's account.",
    ],
  },

  /** Default validity shown on quotations, in days. */
  quotationValidityDays: 15,

  /**
   * Document numbering, producing e.g. QTN-2026-KGIS010, PI-2026-KGIS010.
   * Pattern: {prefix}-{year}-{series}{sequence}
   */
  numbering: {
    quotationPrefix: "QTN",
    proformaPrefix: "PI",
    invoicePrefix: "INV",
    series: "KGIS",
    /** Change this each year. The sequence keeps counting up regardless. */
    year: "2026",
    /** Zero-padding width for the sequence number. */
    pad: 3,
  },
} as const;

export type Company = typeof COMPANY;
