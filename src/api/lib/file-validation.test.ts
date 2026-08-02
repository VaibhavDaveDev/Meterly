import { describe, it, expect } from "vitest";
import { validateUploadedFile } from "./file-validation";

describe("validateUploadedFile", () => {
  const createMockFile = (size: number, type: string, magicBytes: number[]) => {
    const data = new Uint8Array(size);
    data.set(magicBytes);
    return new File([data], "test.bin", { type });
  };

  it("rejects empty file", async () => {
    const file = new File([], "empty.jpg", { type: "image/jpeg" });
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/empty/);
  });

  it("bill-document: accepts valid PDF under 10MB", async () => {
    const file = createMockFile(
      1024,
      "application/pdf",
      [0x25, 0x50, 0x44, 0x46, 0x2d]
    );
    const result = await validateUploadedFile(file, "bill-document");
    expect(result.valid).toBe(true);
  });

  it("bill-document: rejects PDF over 5MB", async () => {
    const file = createMockFile(
      6 * 1024 * 1024,
      "application/pdf",
      [0x25, 0x50, 0x44, 0x46]
    );
    const result = await validateUploadedFile(file, "bill-document");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/under 5 MB/);
  });

  it("bill-document: rejects PNG", async () => {
    const file = createMockFile(1024, "image/png", [0x89, 0x50, 0x4e, 0x47]);
    const result = await validateUploadedFile(file, "bill-document");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Only WebP, JPEG, or PDF/);
  });

  it("meter-photo: accepts valid JPEG under 20MB", async () => {
    const file = createMockFile(1024, "image/jpeg", [0xff, 0xd8, 0xff]);
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(true);
  });

  it("meter-photo: rejects JPEG over 5MB", async () => {
    const file = createMockFile(
      6 * 1024 * 1024,
      "image/jpeg",
      [0xff, 0xd8, 0xff]
    );
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/under 5 MB/);
  });

  it("meter-photo: accepts PNG", async () => {
    const file = createMockFile(1024, "image/png", [0x89, 0x50, 0x4e, 0x47]);
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(true);
  });

  it("meter-photo: rejects PDF", async () => {
    const file = createMockFile(
      1024,
      "application/pdf",
      [0x25, 0x50, 0x44, 0x46]
    );
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Only WebP, JPEG, PNG, or HEIC/);
  });

  it("rejects file with spoofed extension (mismatched magic bytes)", async () => {
    // Declared as JPEG but has PDF magic bytes
    const file = createMockFile(
      1024,
      "image/jpeg",
      [0x25, 0x50, 0x44, 0x46, 0x2d]
    );
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/corrupted or spoofed/);
  });

  it('meter-photo: accepts valid HEIC file with "heic" brand', async () => {
    // ftyp box at bytes 4–7, brand "heic" at bytes 8–11
    const magic = [
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
    ];
    const file = createMockFile(1024, "image/heic", magic);
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(true);
  });

  it("meter-photo: rejects ISO-BMFF ftyp with MP4 brand (not HEIC)", async () => {
    // ftyp at 4–7, brand "mp42" at 8–11
    const magic = [
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
    ];
    const file = createMockFile(1024, "image/heic", magic);
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/corrupted or spoofed/);
  });

  it('meter-photo: accepts HEIF file with "mif1" brand', async () => {
    const magic = [
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31,
    ];
    const file = createMockFile(1024, "image/heif", magic);
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(true);
  });
});
