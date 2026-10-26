// Money is stored as whole centavos (₱1.00 = 100) so sums never pick up float errors.
// These helpers convert between centavos and what people read and type.

const MINUS = "−"; // U+2212, the true minus sign used in the mockups

const withDecimals = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholePesos = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

type FormatOptions = {
  /** Drop the centavos: "₱2,340" instead of "₱2,340.00" (compact mobile lists). Rounds to the nearest peso. */
  whole?: boolean;
};

/** 123450 → "₱1,234.50". Negative values get a true minus: "−₱1,234.50". */
export function formatPeso(centavos: number, { whole = false }: FormatOptions = {}): string {
  const formatter = whole ? wholePesos : withDecimals;
  const text = formatter.format(Math.abs(centavos) / 100);
  return centavos < 0 ? `${MINUS}${text}` : text;
}

/** Amount with a direction sign: in → "+₱62,000.00", out → "−₱31,480.00". Pass the positive stored amount. */
export function formatSignedPeso(centavos: number, direction: "in" | "out", options?: FormatOptions): string {
  return `${direction === "in" ? "+" : MINUS}${formatPeso(Math.abs(centavos), options)}`;
}

// Upper bound for typed amounts: ₱999,999,999.99
const MAX_CENTAVOS = 99_999_999_999;

/**
 * What someone typed → centavos, or null if it isn't a valid positive amount.
 * Accepts "1250", "1,250.5", "₱1,250.50", " 1250.00 ". Rejects "", "abc", "-5", "1.234", "0".
 * Parses the digits as text (not parseFloat) so "0.1" + "0.2" style float errors can't creep in.
 */
export function parsePeso(input: string): number | null {
  const cleaned = input.trim().replace(/^₱\s*/, "").replace(/,/g, "");
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;

  const [, pesos, fraction = ""] = match;
  const centavos = Number(pesos) * 100 + Number(fraction.padEnd(2, "0"));

  if (centavos <= 0 || centavos > MAX_CENTAVOS) return null;
  return centavos;
}

/** Like parsePeso, but an empty field or "0" means zero (optional amounts: starting balances, limits). */
export function parseOptionalPeso(input: string): number | null {
  const cleaned = input.trim().replace(/^₱\s*/, "");
  if (cleaned === "" || /^0+(\.0*)?$/.test(cleaned)) return 0;
  return parsePeso(input);
}

/** Centavos → the text to prefill an amount input with: 125050 → "1250.50", 0 → "". */
export function toInputValue(centavos: number): string {
  return centavos > 0 ? (centavos / 100).toFixed(2) : "";
}
