import { describe, expect, it } from "vitest";
import {
  hasAuthErrors,
  validateEmail,
  validateNickname,
  validatePassword
} from "./authValidation";

describe("auth validation", () => {
  it("validates email structure", () => {
    expect(validateEmail("learner@example.com")).toBeUndefined();
    expect(validateEmail("not-an-email")).toBeTruthy();
  });

  it("uses the server-compatible password byte range", () => {
    expect(validatePassword("12345678")).toBeUndefined();
    expect(validatePassword("1234567")).toBeTruthy();
    expect(validatePassword("番".repeat(25))).toBeTruthy();
  });

  it("validates nickname and error collections", () => {
    expect(validateNickname("番茄同学")).toBeUndefined();
    expect(validateNickname("")).toBeTruthy();
    expect(hasAuthErrors({ email: undefined })).toBe(false);
    expect(hasAuthErrors({ email: "错误" })).toBe(true);
  });
});
