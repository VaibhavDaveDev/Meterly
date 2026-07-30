import { describe, it, expect } from "vitest";
import {
  SuccessResponse,
  SimpleSuccessResponse,
  MessageResponse,
  ErrorResponse,
  IdParam,
} from "./openapi-schemas";

describe("openapi-schemas", () => {
  describe("SuccessResponse", () => {
    it("accepts success=true with any data payload", () => {
      const result = SuccessResponse.safeParse({
        success: true,
        data: { foo: "bar" },
      });
      expect(result.success).toBe(true);
    });

    it("rejects success=false", () => {
      const result = SuccessResponse.safeParse({
        success: false,
        data: {},
      });
      expect(result.success).toBe(false);
    });

    it("accepts primitive, array, and null data payloads", () => {
      expect(SuccessResponse.safeParse({ success: true, data: 42 }).success).toBe(
        true
      );
      expect(
        SuccessResponse.safeParse({ success: true, data: [1, 2, 3] }).success
      ).toBe(true);
      expect(SuccessResponse.safeParse({ success: true, data: null }).success).toBe(
        true
      );
    });

    it("rejects a missing success field", () => {
      const result = SuccessResponse.safeParse({ data: {} });
      expect(result.success).toBe(false);
    });
  });

  describe("SimpleSuccessResponse", () => {
    it("accepts only success=true with no other required fields", () => {
      const result = SimpleSuccessResponse.safeParse({ success: true });
      expect(result.success).toBe(true);
    });

    it("rejects success=false", () => {
      const result = SimpleSuccessResponse.safeParse({ success: false });
      expect(result.success).toBe(false);
    });
  });

  describe("MessageResponse", () => {
    it("accepts success=true with a string message", () => {
      const result = MessageResponse.safeParse({
        success: true,
        message: "Done",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a missing message field", () => {
      const result = MessageResponse.safeParse({ success: true });
      expect(result.success).toBe(false);
    });

    it("rejects a non-string message", () => {
      const result = MessageResponse.safeParse({
        success: true,
        message: 123,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ErrorResponse", () => {
    it("accepts a well-formed error payload", () => {
      const result = ErrorResponse.safeParse({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Not authorized" },
      });
      expect(result.success).toBe(true);
    });

    it("rejects success=true", () => {
      const result = ErrorResponse.safeParse({
        success: true,
        error: { code: "UNAUTHORIZED", message: "Not authorized" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects a missing error.code field", () => {
      const result = ErrorResponse.safeParse({
        success: false,
        error: { message: "Not authorized" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects a missing error.message field", () => {
      const result = ErrorResponse.safeParse({
        success: false,
        error: { code: "UNAUTHORIZED" },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("IdParam", () => {
    it("accepts a string id", () => {
      const result = IdParam.safeParse({ id: "abc123uuid" });
      expect(result.success).toBe(true);
    });

    it("rejects a missing id", () => {
      const result = IdParam.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects a non-string id", () => {
      const result = IdParam.safeParse({ id: 123 });
      expect(result.success).toBe(false);
    });
  });

  it("no longer exports the removed SimpleError and TokenParam schemas", async () => {
    const mod = await import("./openapi-schemas");
    expect((mod as Record<string, unknown>).SimpleError).toBeUndefined();
    expect((mod as Record<string, unknown>).TokenParam).toBeUndefined();
  });
});