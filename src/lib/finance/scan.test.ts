// Text shaped like what Tesseract reads from real receipts, misreads included.
// Add a case here whenever a real screenshot picks the wrong amount.
import { describe, expect, it } from "vitest";
import { findAmounts } from "./scan";

const best = (text: string) => findAmounts(text)[0]?.amount ?? null;

describe("findAmounts", () => {
  it("GCash send: picks the amount, skips phone, reference and time", () => {
    const text = `Sent via GCash
Juan D.
+63 917 123 4567
Amount 500.00
Total Amount Sent P500.00
Ref No. 1234 567 890123 Oct 24, 2026 1:23 PM`;
    expect(best(text)).toBe(50000);
  });

  it("bank transfer: prefers the amount over the available balance", () => {
    const text = `Transfer successful
PHP 1,250.00
From Savings ****1234
To GCash 09171234567
Service fee PHP 0.00
Reference number 202610241234
Available balance PHP 52,300.15`;
    expect(best(text)).toBe(125000);
  });

  it("Maya payment with ₱ misread as ®", () => {
    expect(best(`You paid\n® 249.75\nto Jollibee\nOct 24, 2026, 12:01 PM`)).toBe(24975);
  });

  it("₱ misread as F", () => {
    expect(best(`Payment successful\nF1,999.00`)).toBe(199900);
  });

  it("a total with no currency sign", () => {
    expect(best(`Payment\nTotal 3,499.00\nDate 10/24/2026`)).toBe(349900);
  });

  it("a whole amount with a currency sign", () => {
    expect(best(`Cash out\n₱2,000`)).toBe(200000);
  });

  it("finds nothing in text without money", () => {
    expect(findAmounts(`Hello 2026 world 12:30\nOTP 123456`)).toEqual([]);
  });

  it("offers the other amounts as alternatives, best first", () => {
    const amounts = findAmounts(`Amount ₱150.00\nVoucher ₱20.00`).map((c) => c.amount);
    expect(amounts).toEqual([15000, 2000]);
  });

  it("keeps the line each amount came from", () => {
    expect(findAmounts(`Total Amount Sent ₱500.00`)[0].line).toBe("Total Amount Sent ₱500.00");
  });
});
