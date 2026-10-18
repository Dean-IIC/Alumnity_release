import { describe, expect, it, vi } from "vitest";
import { passwordRefusal, SAME_PASSWORD } from "../lib/server/auth-provider";
import { passwordProblem } from "../lib/server/secrets";

describe("Supabase refusing a password", () => {
  it("knows 'the same as the old one' in Supabase's own words (seen live), so a join's retry goes through", () => {
    expect(passwordRefusal({ code: "same_password", message: "New password should be different from the old password." })).toBe(SAME_PASSWORD);
    expect(passwordRefusal({ message: "New password should be different from the old password." })).toBe(SAME_PASSWORD);
  });

  it("passes any other rule on in Supabase's words, and logs it", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(passwordRefusal({ code: "weak_password", message: "Password should contain at least one character of each: abc, 123." })).toBe(
      "That password can’t be used: should contain at least one character of each: abc, 123."
    );
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("a password with a common word in it", () => {
  it("names the word it found, not another one", () => {
    expect(passwordProblem("Teacher1-Alumnity-2026")).toBe("Leave out “alumnity”: it’s too easy to guess.");
    expect(passwordProblem("my hkbk days 1997")).toBe("Leave out “hkbk”: it’s too easy to guess.");
    expect(passwordProblem("chalk and lanterns 41")).toBeNull();
  });
});
