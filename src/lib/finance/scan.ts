// Finding the ₱ amount in text read from a bank or e-wallet screenshot (roadmap Phase 10).
// OCR text is messy: "₱" often comes out as "P", "F" or "®", and receipts are full of other
// numbers (reference numbers, dates, times, phone numbers, balances). So every number gets a
// score from the clues around it, and the best one is suggested; the others stay one tap away.
import { parsePeso } from "@/lib/money";

export type AmountCandidate = {
  /** Centavos */
  amount: number;
  score: number;
  /** The line it came from, to show why it was picked */
  line: string;
};

// A peso sign (or how OCR misreads one) or "PHP" right before the number. The letter forms must
// stand alone, so the "P" ending "OTP" or "STEP" doesn't count.
const CURRENCY_BEFORE = /(?:₱|®|€|\$|(?<![A-Za-z])(?:php|p|f))\s*$/i;
// Words that mean "this is the amount that moved"
const AMOUNT_WORDS = /\b(total|amount|sent|paid|payment|pay|transfer(?:red)?|debit(?:ed)?|cash ?out|purchase|you (?:sent|paid)|received)\b/i;
// Numbers on these lines are something else
const OTHER_WORDS = /\b(balance|available|fee|charge|ref(?:erence)?|no\.|txn|trace|account|acct|mobile|number|id|points?)\b/i;

// 1,234.56 / 1 234.56 / 1234.56 / 1,234 / 500
const NUMBER = /(\d{1,3}(?:[,\s]\d{3})+|\d+)(?:[.,](\d{2}))?(?![\d:])/g;

export function findAmounts(text: string): AmountCandidate[] {
  const byAmount = new Map<number, AmountCandidate>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const amountLine = AMOUNT_WORDS.test(line);
    const otherLine = OTHER_WORDS.test(line);

    for (const match of line.matchAll(NUMBER)) {
      const [whole, digits, cents] = match;
      const before = line.slice(0, match.index);
      const start = match.index ?? 0;

      // Times (1:23), dates (10/24/2026, 2026-10-24) and anything glued to letters or longer numbers
      if (/[:/\-]\s*$/.test(before) || /^[:/\-]/.test(line.slice(start + whole.length))) continue;
      if (/[A-Za-z0-9]$/.test(before) && !CURRENCY_BEFORE.test(before)) continue;

      const hasCurrency = CURRENCY_BEFORE.test(before.slice(-5));
      const grouped = /[,\s]/.test(digits);
      const plainDigits = digits.replace(/[,\s]/g, "");
      // A bare whole number with no clues is more likely a year, count or code than money
      if (!cents && !hasCurrency && !grouped) continue;
      if (plainDigits.length > 9) continue;

      const amount = parsePeso(`${plainDigits}${cents ? `.${cents}` : ""}`);
      if (amount === null) continue;

      let score = 0;
      if (hasCurrency) score += 5;
      if (cents) score += 2;
      if (amountLine) score += 3;
      if (/\btotal\b/i.test(line)) score += 1;
      if (otherLine) score -= 4;

      const existing = byAmount.get(amount);
      if (existing) {
        // The same amount shown twice (e.g. "Amount" and "Total") is a strong sign
        existing.score += Math.max(1, score);
        if (score > 0 && !OTHER_WORDS.test(existing.line) && amountLine) existing.line = line;
      } else {
        byAmount.set(amount, { amount, score, line });
      }
    }
  }

  return [...byAmount.values()].filter((c) => c.score > 0).sort((a, b) => b.score - a.score || b.amount - a.amount);
}
