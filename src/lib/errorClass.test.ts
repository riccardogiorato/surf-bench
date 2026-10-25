import { describe, it, expect } from "vitest";
import { classifyError, isNonScoring, isRetryable } from "./errorClass.js";

// These cases are verbatim messages captured from real provider runs. They
// exist because each one was classified wrongly at some point, and a
// misclassification here silently turns a billing problem into a published
// quality verdict.
describe("errorClass", () => {
  it("treats a rate-limit message as a rate limit even when it links to billing docs", () => {
    // exa puts a billing URL inside its 429 text, which made this read as a
    // dead key before rate_limit was checked first.
    const msg =
      "Rate limit exceeded: 10 requests per second for your team. Wait at least 1 second before retrying, and reduce your request rate. For higher limits, see https://exa.ai/docs/admin/billing#rate-limits";
    expect(classifyError(msg)).toBe("rate_limit");
    expect(isRetryable(msg)).toBe(true);
  });

  it("recognises tavily's burst block as a rate limit", () => {
    expect(
      classifyError("Your request has been blocked due to excessive requests. Please reduce the rate of requests."),
    ).toBe("rate_limit");
  });

  it("classifies an unfunded account as quota", () => {
    expect(
      classifyError(
        '402 {"type":"error","error":{"message":"Insufficient credit in account, please check your plan and billing details."}}',
      ),
    ).toBe("quota");
    expect(
      classifyError(
        'Together HTTP 402: {"error":{"message":"Credit limit exceeded, please add credits"}}',
      ),
    ).toBe("quota");
    expect(
      classifyError("This request exceeds your plan's set usage limit. Please upgrade your plan or contact support@tavily.com"),
    ).toBe("quota");
  });

  it("keeps quota and rate_limit out of scoring, but scores real failures", () => {
    expect(isNonScoring("Too many requests")).toBe(true);
    expect(isNonScoring("402 Insufficient credit")).toBe(true);
    // A bot wall is part of what is measured: it must count.
    expect(isNonScoring("looks like a blocked/error page (captcha)")).toBe(false);
    expect(classifyError("looks like a blocked/error page (captcha)")).toBe("blocked");
    expect(isNonScoring("The target URL could not be reached")).toBe(false);
  });

  it("classifies timeouts and empty extractions as the provider's own result", () => {
    expect(classifyError("connection failed or timed out")).toBe("timeout");
    expect(classifyError("content too short (41 chars)")).toBe("empty");
    expect(isNonScoring("content too short (41 chars)")).toBe(false);
  });

  it("returns null for no error", () => {
    expect(classifyError(null)).toBeNull();
    expect(classifyError("")).toBeNull();
    expect(isNonScoring(null)).toBe(false);
  });
});
