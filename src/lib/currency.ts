/**
 * Currencies a document can be raised in.
 *
 * Every amount in the system is stored as an integer in the currency's
 * *minor* unit — paise, cents, fils. `decimals` says how many minor
 * units make up one major unit, which is 2 almost everywhere but 0 for
 * yen and won.
 *
 * `grouping` picks the digit grouping used both for display and for
 * the amount-in-words line: "indian" gives 1,23,456 and lakh/crore,
 * "western" gives 123,456 and thousand/million.
 */

export type Grouping = "indian" | "western";

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  /** BCP-47 locale used for digit grouping. */
  locale: string;
  decimals: number;
  grouping: Grouping;
  /** Plural name of the major unit, used in the words line. */
  majorName: string;
  /** Plural name of the minor unit. Empty when the currency has none. */
  minorName: string;
  /**
   * Whether totals are rounded to a whole major unit, with the
   * difference shown as a round-off line. Standard practice on Indian
   * invoices; not done on export documents priced in cents.
   */
  roundToWhole: boolean;
}

export const CURRENCIES: Currency[] = [
  { code: "INR", name: "Indian Rupee", symbol: "₹", locale: "en-IN", decimals: 2, grouping: "indian", majorName: "Rupees", minorName: "Paise", roundToWhole: true },
  { code: "USD", name: "US Dollar", symbol: "$", locale: "en-US", decimals: 2, grouping: "western", majorName: "US Dollars", minorName: "Cents", roundToWhole: false },
  { code: "EUR", name: "Euro", symbol: "€", locale: "de-DE", decimals: 2, grouping: "western", majorName: "Euros", minorName: "Cents", roundToWhole: false },
  { code: "GBP", name: "Pound Sterling", symbol: "£", locale: "en-GB", decimals: 2, grouping: "western", majorName: "Pounds", minorName: "Pence", roundToWhole: false },
  { code: "AED", name: "UAE Dirham", symbol: "AED", locale: "en-AE", decimals: 2, grouping: "western", majorName: "Dirhams", minorName: "Fils", roundToWhole: false },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR", locale: "en-SA", decimals: 2, grouping: "western", majorName: "Riyals", minorName: "Halalas", roundToWhole: false },
  { code: "QAR", name: "Qatari Riyal", symbol: "QAR", locale: "en-QA", decimals: 2, grouping: "western", majorName: "Riyals", minorName: "Dirhams", roundToWhole: false },
  { code: "OMR", name: "Omani Rial", symbol: "OMR", locale: "en-OM", decimals: 3, grouping: "western", majorName: "Rials", minorName: "Baisa", roundToWhole: false },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KWD", locale: "en-KW", decimals: 3, grouping: "western", majorName: "Dinars", minorName: "Fils", roundToWhole: false },
  { code: "BHD", name: "Bahraini Dinar", symbol: "BHD", locale: "en-BH", decimals: 3, grouping: "western", majorName: "Dinars", minorName: "Fils", roundToWhole: false },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", locale: "en-SG", decimals: 2, grouping: "western", majorName: "Dollars", minorName: "Cents", roundToWhole: false },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", locale: "en-MY", decimals: 2, grouping: "western", majorName: "Ringgit", minorName: "Sen", roundToWhole: false },
  { code: "THB", name: "Thai Baht", symbol: "฿", locale: "en-TH", decimals: 2, grouping: "western", majorName: "Baht", minorName: "Satang", roundToWhole: false },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", locale: "en-ID", decimals: 2, grouping: "western", majorName: "Rupiah", minorName: "Sen", roundToWhole: false },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", locale: "en-VN", decimals: 0, grouping: "western", majorName: "Dong", minorName: "", roundToWhole: true },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", locale: "ja-JP", decimals: 0, grouping: "western", majorName: "Yen", minorName: "", roundToWhole: true },
  { code: "CNY", name: "Chinese Yuan", symbol: "CN¥", locale: "zh-CN", decimals: 2, grouping: "western", majorName: "Yuan", minorName: "Fen", roundToWhole: false },
  { code: "KRW", name: "South Korean Won", symbol: "₩", locale: "ko-KR", decimals: 0, grouping: "western", majorName: "Won", minorName: "", roundToWhole: true },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", locale: "en-AU", decimals: 2, grouping: "western", majorName: "Dollars", minorName: "Cents", roundToWhole: false },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", locale: "en-NZ", decimals: 2, grouping: "western", majorName: "Dollars", minorName: "Cents", roundToWhole: false },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", locale: "en-CA", decimals: 2, grouping: "western", majorName: "Dollars", minorName: "Cents", roundToWhole: false },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", locale: "de-CH", decimals: 2, grouping: "western", majorName: "Francs", minorName: "Rappen", roundToWhole: false },
  { code: "ZAR", name: "South African Rand", symbol: "R", locale: "en-ZA", decimals: 2, grouping: "western", majorName: "Rand", minorName: "Cents", roundToWhole: false },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", locale: "en-KE", decimals: 2, grouping: "western", majorName: "Shillings", minorName: "Cents", roundToWhole: false },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", locale: "en-NG", decimals: 2, grouping: "western", majorName: "Naira", minorName: "Kobo", roundToWhole: false },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£", locale: "en-EG", decimals: 2, grouping: "western", majorName: "Pounds", minorName: "Piastres", roundToWhole: false },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", locale: "tr-TR", decimals: 2, grouping: "western", majorName: "Lira", minorName: "Kurus", roundToWhole: false },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", locale: "pt-BR", decimals: 2, grouping: "western", majorName: "Reais", minorName: "Centavos", roundToWhole: false },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$", locale: "es-MX", decimals: 2, grouping: "western", majorName: "Pesos", minorName: "Centavos", roundToWhole: false },
  { code: "RUB", name: "Russian Ruble", symbol: "₽", locale: "ru-RU", decimals: 2, grouping: "western", majorName: "Rubles", minorName: "Kopeks", roundToWhole: false },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", locale: "en-BD", decimals: 2, grouping: "indian", majorName: "Taka", minorName: "Poisha", roundToWhole: false },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs", locale: "en-LK", decimals: 2, grouping: "indian", majorName: "Rupees", minorName: "Cents", roundToWhole: false },
  { code: "NPR", name: "Nepalese Rupee", symbol: "NRs", locale: "en-NP", decimals: 2, grouping: "indian", majorName: "Rupees", minorName: "Paisa", roundToWhole: false },
  { code: "PKR", name: "Pakistani Rupee", symbol: "PKRs", locale: "en-PK", decimals: 2, grouping: "indian", majorName: "Rupees", minorName: "Paisa", roundToWhole: false },
];

export const DEFAULT_CURRENCY = "INR";

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

/** Falls back to INR rather than throwing, so a bad code never blanks a document. */
export function getCurrency(code: string | null | undefined): Currency {
  return BY_CODE.get((code ?? "").toUpperCase()) ?? BY_CODE.get(DEFAULT_CURRENCY)!;
}

/** 10^decimals — how many minor units make one major unit. */
export function minorPerMajor(currency: Currency): number {
  return 10 ** currency.decimals;
}
