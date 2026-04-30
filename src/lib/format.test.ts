import { describe, expect, it } from "vitest";
import { formatTokenAmount, parseTokenAmount, shortAddress, validateJobInput } from "./format";

describe("token amount formatting", () => {
  it("parses decimal token input into stroops", () => {
    expect(parseTokenAmount("12.345")).toBe(123450000n);
  });

  it("formats stroops without noisy trailing zeros", () => {
    expect(formatTokenAmount("250000000")).toBe("25");
    expect(formatTokenAmount("250010000")).toBe("25.001");
  });

  it("rejects invalid job input before wallet signing", () => {
    expect(
      validateJobInput({
        title: "Pay",
        provider: "not-a-public-key",
        amount: "0"
      })
    ).toBe("Describe the service in at least 4 characters.");
  });

  it("shortens Stellar addresses for dense cards", () => {
    expect(shortAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ234")).toContain("...");
  });
});
