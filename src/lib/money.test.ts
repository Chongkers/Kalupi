import { describe, expect, it } from "vitest";
import { formatPeso, formatSignedPeso, parseOptionalPeso, parsePeso, toInputValue } from "./money";

describe("formatPeso", () => {
  it("formats centavos with two decimals", () => {
    expect(formatPeso(123450)).toBe("₱1,234.50");
    expect(formatPeso(0)).toBe("₱0.00");
  });

  it("uses a true minus sign for negatives", () => {
    expect(formatPeso(-5000)).toBe("−₱50.00");
  });

  it("rounds to whole pesos when asked", () => {
    expect(formatPeso(234049, { whole: true })).toBe("₱2,340");
    expect(formatPeso(234050, { whole: true })).toBe("₱2,341");
  });
});

describe("formatSignedPeso", () => {
  it("signs by direction, whatever the input's sign", () => {
    expect(formatSignedPeso(6200000, "in")).toBe("+₱62,000.00");
    expect(formatSignedPeso(3148000, "out")).toBe("−₱31,480.00");
    expect(formatSignedPeso(-100, "in")).toBe("+₱1.00");
  });
});

describe("parsePeso", () => {
  it.each([
    ["1250", 125000],
    ["1,250.5", 125050],
    ["₱1,250.50", 125050],
    [" 1250.00 ", 125000],
    ["0.01", 1],
    ["999999999.99", 99_999_999_999],
  ])("reads %j as %i centavos", (input, centavos) => {
    expect(parsePeso(input)).toBe(centavos);
  });

  it.each(["", "abc", "-5", "1.234", "0", "0.00", "1e3", "1000000000"])("rejects %j", (input) => {
    expect(parsePeso(input)).toBeNull();
  });

  it("ignores commas wherever they are", () => {
    // Lenient on purpose: a misplaced comma is read as a typo, not an error
    expect(parsePeso("1,25.00")).toBe(12500);
  });

  it("adds without float errors", () => {
    expect(parsePeso("0.1")! + parsePeso("0.2")!).toBe(30);
  });
});

describe("parseOptionalPeso", () => {
  it("treats blank and zero as zero", () => {
    expect(parseOptionalPeso("")).toBe(0);
    expect(parseOptionalPeso("  ")).toBe(0);
    expect(parseOptionalPeso("0")).toBe(0);
    expect(parseOptionalPeso("0.00")).toBe(0);
    expect(parseOptionalPeso("₱0")).toBe(0);
  });

  it("otherwise parses like parsePeso", () => {
    expect(parseOptionalPeso("5,000")).toBe(500000);
    expect(parseOptionalPeso("abc")).toBeNull();
  });
});

describe("toInputValue", () => {
  it("prefills amounts and leaves zero blank", () => {
    expect(toInputValue(125050)).toBe("1250.50");
    expect(toInputValue(0)).toBe("");
  });

  it("round-trips through parsePeso", () => {
    for (const centavos of [1, 99, 100, 123456, 99_999_999_999]) {
      expect(parsePeso(toInputValue(centavos))).toBe(centavos);
    }
  });
});
