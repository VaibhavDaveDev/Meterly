import { describe, it, expect } from "vitest";
import { validateUploadedFile } from "./file-validation";

describe("validateUploadedFile", () => {
  const createMockFile = (size: number, type: string, magicBytes: number[]) => {
    const data = new Uint8Array(size);
    data.set(magicBytes);
    return new File([data], "test.bin", { type });
  };

  const makeFile = (bytes: Uint8Array, name: string, type: string): File =>
    new File([bytes as unknown as BlobPart], name, { type });

  // Layout: ftyp box (16 bytes) + mdat box with size=0 (extends to EOF, 8 bytes).
  const makeHeicBuffer = (brand: string): Uint8Array => {
    const b = brand.split("").map((c) => c.charCodeAt(0));
    return new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x10, // ftyp box size = 16
      0x66,
      0x74,
      0x79,
      0x70, // "ftyp"
      b[0],
      b[1],
      b[2],
      b[3], // major brand
      0x00,
      0x00,
      0x00,
      0x00, // minor version
      0x00,
      0x00,
      0x00,
      0x00, // mdat box size = 0 (extends to EOF)
      0x6d,
      0x64,
      0x61,
      0x74, // "mdat"
    ]);
  };

  // Builds a structurally-valid minimal JPEG buffer for tests.
  // 12 bytes minimum required by checkMagicBytes.
  const makeValidJpeg = (): Uint8Array =>
    new Uint8Array([
      0xff,
      0xd8, // SOI
      0xff,
      0xe0,
      0x00,
      0x10, // APP0, length 16 (includes 2 bytes for length)
      0x4a,
      0x46,
      0x49,
      0x46,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // 14 bytes of payload
      0xff,
      0xd9, // EOI
    ]);

  /**
   * Builds a structurally-valid minimal PNG buffer.
   * Layout: 8-byte signature + IHDR chunk (13 bytes) + optional extra chunks + IEND chunk.
   * Pass extra bytes to append after IEND for polyglot/trailing-data tests.
   */
  const makePng = (extra: number[] = []): Uint8Array => {
    const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const IHDR = [
      0x00,
      0x00,
      0x00,
      0x0d, // length = 13
      0x49,
      0x48,
      0x44,
      0x52, // "IHDR"
      ...new Array(13).fill(0x00), // IHDR data (width, height, bit depth, etc.)
      0x00,
      0x00,
      0x00,
      0x00, // CRC
    ];
    const IEND = [
      0x00,
      0x00,
      0x00,
      0x00, // length = 0
      0x49,
      0x45,
      0x4e,
      0x44, // "IEND"
      0xae,
      0x42,
      0x60,
      0x82, // Standard IEND CRC
    ];
    return new Uint8Array([...PNG_SIG, ...IHDR, ...IEND, ...extra]);
  };

  it("rejects empty file", async () => {
    const file = new File([], "empty.jpg", { type: "image/jpeg" });
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/empty/);
  });

  it("bill-document: rejects raw PDF", async () => {
    const file = createMockFile(
      1024,
      "application/pdf",
      [0x25, 0x50, 0x44, 0x46, 0x2d]
    );
    const result = await validateUploadedFile(file, "bill-document");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Only WebP or JPEG/);
  });

  it("bill-document: rejects PNG", async () => {
    const file = createMockFile(1024, "image/png", [0x89, 0x50, 0x4e, 0x47]);
    const result = await validateUploadedFile(file, "bill-document");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Only WebP or JPEG/);
  });

  it("meter-photo: accepts valid JPEG under 5MB", async () => {
    const file = makeFile(makeValidJpeg(), "test.jpg", "image/jpeg");
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
    const png = makePng();
    const file = makeFile(png, "test.png", "image/png");
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
    const file = makeFile(makeHeicBuffer("heic"), "test.heic", "image/heic");
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(true);
  });

  it("meter-photo: rejects ISO-BMFF ftyp with MP4 brand (not HEIC)", async () => {
    const file = makeFile(makeHeicBuffer("mp42"), "test.heic", "image/heic");
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/corrupted or spoofed/);
  });

  it('meter-photo: accepts HEIF file with "mif1" brand', async () => {
    const file = makeFile(makeHeicBuffer("mif1"), "test.heif", "image/heif");
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(true);
    expect(result.verifiedMimeType).toBe("image/heif");
  });

  it('meter-photo: accepts HEIF file with "msf1" brand and returns image/heif', async () => {
    const file = makeFile(makeHeicBuffer("msf1"), "test.heif", "image/heif");
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(true);
    expect(result.verifiedMimeType).toBe("image/heif");
  });

  it('meter-photo: accepts HEIC file with "heic" brand and returns image/heic', async () => {
    const file = makeFile(makeHeicBuffer("heic"), "test.heic", "image/heic");
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(true);
    expect(result.verifiedMimeType).toBe("image/heic");
  });

  it("bill-document: accepts valid WebP and returns verifiedMimeType", async () => {
    const chunkSize = 8;
    const webp = new Uint8Array([
      0x52,
      0x49,
      0x46,
      0x46,
      chunkSize & 0xff,
      (chunkSize >> 8) & 0xff,
      (chunkSize >> 16) & 0xff,
      (chunkSize >> 24) & 0xff,
      0x57,
      0x45,
      0x42,
      0x50,
      0x00,
      0x00,
      0x00,
      0x00,
    ]);
    const file = new File([webp], "test.webp", { type: "image/webp" });
    const result = await validateUploadedFile(file, "bill-document");
    expect(result.valid).toBe(true);
    expect(result.verifiedMimeType).toBe("image/webp");
  });

  it("meter-photo: returns verifiedMimeType for a valid JPEG", async () => {
    const file = makeFile(makeValidJpeg(), "test.jpg", "image/jpeg");
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(true);
    expect(result.verifiedMimeType).toBe("image/jpeg");
  });

  it("rejects a truncated buffer shorter than 12 bytes", async () => {
    const data = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45,
    ]);
    const file = new File([data], "trunc.webp", { type: "image/webp" });
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(false);
  });

  // ── Polyglot: trailing data appended after the logical image end ──────────────

  it("JPEG: rejects file with bytes appended after FF D9", async () => {
    // Build: valid JPEG header bytes + FF D9 EOI + appended ZIP bytes (PK magic)
    const validJpeg = makeValidJpeg();
    const jpeg = new Uint8Array(validJpeg.length + 4);
    jpeg.set(validJpeg);
    jpeg.set([0x50, 0x4b, 0x03, 0x04], validJpeg.length); // PK ZIP magic appended AFTER EOI

    const file = new File([jpeg], "poly.jpg", { type: "image/jpeg" });
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/extra data after the image end/);
  });

  it("PNG: rejects file with bytes appended after IEND chunk", async () => {
    const APPENDED = [0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e]; // "<html>"
    const png = makePng(APPENDED);
    const file = makeFile(png, "poly.png", "image/png");
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/extra data after the image end/);
  });

  it("WebP: rejects file with bytes appended after RIFF ChunkSize", async () => {
    const chunkSize = 4;
    const webp = new Uint8Array([
      0x52,
      0x49,
      0x46,
      0x46, // "RIFF"
      chunkSize & 0xff,
      (chunkSize >> 8) & 0xff,
      (chunkSize >> 16) & 0xff,
      (chunkSize >> 24) & 0xff, // ChunkSize LE
      0x57,
      0x45,
      0x42,
      0x50, // "WEBP"
      0x00,
      0x00,
      0x00,
      0x00, // 4 bytes of payload
      0xff,
      0xff,
      0xff, // 3 extra bytes APPENDED
    ]);
    const file = new File([webp], "poly.webp", { type: "image/webp" });
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/extra data after the image end/);
  });

  // ── Truncated: declared size exceeds actual buffer ────────────────────────────

  it("PNG: rejects file where a chunk length runs past the buffer", async () => {
    const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const FAKE_CHUNK = [
      0x00,
      0x00,
      0x27,
      0x0f, // length = 9999
      0x49,
      0x48,
      0x44,
      0x52, // type = "IHDR"
      0x00,
      0x00,
      0x00,
      0x00, // padding so offset + 12 <= len and the length field is read
    ];
    const png = new Uint8Array([...PNG_SIG, ...FAKE_CHUNK]);
    const file = new File([png], "truncated.png", { type: "image/png" });
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(
      /declares a length that extends past the file/
    );
  });

  it("WebP: rejects file where RIFF ChunkSize exceeds actual buffer", async () => {
    const chunkSize = 999999;
    const webp = new Uint8Array([
      0x52,
      0x49,
      0x46,
      0x46,
      chunkSize & 0xff,
      (chunkSize >> 8) & 0xff,
      (chunkSize >> 16) & 0xff,
      (chunkSize >> 24) & 0xff,
      0x57,
      0x45,
      0x42,
      0x50,
    ]);
    const file = new File([webp], "truncated.webp", { type: "image/webp" });
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/truncated/);
  });

  // ── Clean files: must still be accepted ──────────────────────────────────────

  it("JPEG: clean file with no appended data is accepted", async () => {
    const file = makeFile(makeValidJpeg(), "clean.jpg", "image/jpeg");
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(true);
  });

  it("PNG: clean file ending precisely with IEND is accepted", async () => {
    const png = makePng();
    const file = makeFile(png, "clean.png", "image/png");
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(true);
  });

  it("WebP: clean file with ChunkSize matching actual size is accepted", async () => {
    const chunkSize = 8;
    const webp = new Uint8Array([
      0x52,
      0x49,
      0x46,
      0x46,
      chunkSize & 0xff,
      (chunkSize >> 8) & 0xff,
      (chunkSize >> 16) & 0xff,
      (chunkSize >> 24) & 0xff,
      0x57,
      0x45,
      0x42,
      0x50,
      0x00,
      0x00,
      0x00,
      0x00, // 4 bytes payload
    ]);
    const file = new File([webp], "clean.webp", { type: "image/webp" });
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(true);
  });

  it("HEIC: valid structurally-correct ISO BMFF buffer is accepted", async () => {
    const file = makeFile(makeHeicBuffer("heic"), "clean.heic", "image/heic");
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(true);
  });

  it("HEIF: valid structurally-correct ISO BMFF buffer is accepted", async () => {
    const file = makeFile(makeHeicBuffer("mif1"), "clean.heif", "image/heif");
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(true);
  });

  // ── JPEG byte stuffing must not trigger a false rejection ────────────────────

  it("JPEG: restart markers inside entropy-coded data are accepted", async () => {
    const jpeg = new Uint8Array([
      0xff,
      0xd8, // SOI
      0xff,
      0xda,
      0x00,
      0x08,
      0x01,
      0x01,
      0x00,
      0x00,
      0x3f,
      0x00, // SOS header (8 bytes incl. length)
      0x7f,
      0x7f, // entropy data
      0xff,
      0xd0, // RST0 inside the entropy stream
      0x7f,
      0x7f, // more entropy data
      0xff,
      0xd1, // RST1
      0x7f,
      0xff,
      0xd9, // EOI
    ]);
    const file = new File([jpeg], "restart.jpg", { type: "image/jpeg" });
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(true);
  });

  it("JPEG: FF 00 byte stuffing in entropy-coded data does not cause false rejection", async () => {
    // Structure: SOI → APP0 (length=4, 2 data bytes) → SOS (8-byte header)
    //            → FF 00 stuffed bytes in entropy-coded data → EOI
    // APP0 length=4 means: 2 (length field) + 2 (data) = 4 bytes. Offset advances by 4 from
    // the marker position, landing correctly on the next FF.
    const jpeg = new Uint8Array([
      0xff,
      0xd8, // SOI
      0xff,
      0xe0,
      0x00,
      0x04,
      0xaa,
      0xbb, // APP0: length=4, 2 data bytes
      0xff,
      0xda,
      0x00,
      0x08,
      0x01,
      0x01,
      0x00,
      0x00,
      0x3f,
      0x00, // SOS header (8 bytes incl length)
      0xff,
      0x00, // stuffed byte in entropy-coded data
      0xff,
      0x00, // another stuffed byte
      0xff,
      0xd9, // EOI — at the true end
    ]);
    const file = new File([jpeg], "stuffed.jpg", { type: "image/jpeg" });
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(true);
  });

  it("JPEG: rejects polyglot where appended payload ends with FF D9 (backwards-scan bypass)", async () => {
    // Attacker's trick: [valid JPEG + real EOI] + [payload] + [fake FF D9]
    // The old backwards scan would pick the trailing FF D9 and accept the file.
    // The forward walk finds the first EOI and detects trailing data after it.
    const jpeg = new Uint8Array([
      0xff,
      0xd8, // SOI
      0xff,
      0xe0,
      0x00,
      0x04,
      0xaa,
      0xbb, // APP0
      0xff,
      0xd9, // real EOI
      0x50,
      0x4b,
      0x03,
      0x04, // ZIP magic (payload)
      0xff,
      0xd9, // attacker's trailing FF D9
    ]);
    const file = new File([jpeg], "poly-bypass.jpg", { type: "image/jpeg" });
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/extra data after the image end/);
  });

  it("PNG: rejects file with high-bit chunk length (0x80000000) without infinite loop", async () => {
    // 0x80 << 24 in JS = -2147483648 (signed). DataView.getUint32 reads it as
    // 2147483648 (unsigned), making chunkEnd > len → correctly rejected as truncated.
    const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const HIGH_BIT_CHUNK = [
      0x80,
      0x00,
      0x00,
      0x00, // length = 2147483648
      0x49,
      0x48,
      0x44,
      0x52, // type = "IHDR"
      0x00,
      0x00,
      0x00,
      0x00, // padding so offset + 12 <= len and the length field is actually read
    ];
    const png = new Uint8Array([...PNG_SIG, ...HIGH_BIT_CHUNK]);
    const file = new File([png], "highbit.png", { type: "image/png" });
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(
      /declares a length that extends past the file/
    );
  });

  it("HEIC: rejects arbitrary payload appended after valid ftyp brand header", async () => {
    // This is the exact attack vector: valid 12-byte ftyp magic + ZIP payload.
    // The ftyp box here declares size=0x18=24. Bytes 12-23 are the ftyp payload.
    // Bytes 24+ are a ZIP header — not a valid ISO BMFF box.
    const heic = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x18, // ftyp box size = 24
      0x66,
      0x74,
      0x79,
      0x70, // "ftyp"
      0x68,
      0x65,
      0x69,
      0x63, // major brand "heic"
      0x00,
      0x00,
      0x00,
      0x00, // minor version
      0x68,
      0x65,
      0x69,
      0x63, // compatible brand "heic"
      0x6d,
      0x69,
      0x66,
      0x31, // compatible brand "mif1"
      0x50,
      0x4b,
      0x03,
      0x04,
      0x00,
      0x00, // ZIP magic — NOT a valid BMFF box
    ]);
    const file = new File([heic], "poly.heic", { type: "image/heic" });
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(false);
  });

  it("HEIC: accepts file where major brand is mif1 but compatible brand includes heic", async () => {
    // Real-world case: ftyp major brand "mif1" (generic) with "heic" in compatible brands.
    // Old code: rejected (isValidHeic only checked major brand, mif1 not in HEIC_ONLY_BRANDS).
    // New code: accepted (readFtypBrands finds "heic" in compatible brands list).
    //
    // ftyp box layout:
    //   [00 00 00 18] = size 24
    //   [66 74 79 70] = "ftyp"
    //   [6d 69 66 31] = major brand "mif1"
    //   [00 00 00 00] = minor version
    //   [6d 69 66 31] = compatible brand "mif1"
    //   [68 65 69 63] = compatible brand "heic"  <- triggers new code path
    // Then: mdat box with size=0 (extends to EOF)
    const heic = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x18, // ftyp size = 24
      0x66,
      0x74,
      0x79,
      0x70, // "ftyp"
      0x6d,
      0x69,
      0x66,
      0x31, // major brand "mif1"
      0x00,
      0x00,
      0x00,
      0x00, // minor version
      0x6d,
      0x69,
      0x66,
      0x31, // compatible brand "mif1"
      0x68,
      0x65,
      0x69,
      0x63, // compatible brand "heic"
      0x00,
      0x00,
      0x00,
      0x00, // mdat size = 0 (extends to EOF)
      0x6d,
      0x64,
      0x61,
      0x74, // "mdat"
    ]);
    const file = new File([heic], "compat.heic", { type: "image/heic" });
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(true);
    expect(result.verifiedMimeType).toBe("image/heic");
  });

  it("HEIC: rejects payload appended inside an open-ended non-mdat box", async () => {
    // Attack: ftyp(heic) + size=0 box with type "free" (not "mdat") + arbitrary payload.
    // Before fix: size=0 accepted any box type -> ok: true -> payload accepted.
    // After fix:  size=0 with type != "mdat" -> rejected.
    //
    // Box layout:
    //   [00 00 00 10] ftyp size=16
    //   [66 74 79 70] "ftyp"
    //   [68 65 69 63] major brand "heic"
    //   [00 00 00 00] minor version
    //   [00 00 00 00] size=0 (open-ended box)
    //   [66 72 65 65] type "free" (NOT mdat)
    //   [...payload ] ZIP magic + HTML bytes
    const heic = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x10, // ftyp size = 16
      0x66,
      0x74,
      0x79,
      0x70, // "ftyp"
      0x68,
      0x65,
      0x69,
      0x63, // major brand "heic"
      0x00,
      0x00,
      0x00,
      0x00, // minor version
      0x00,
      0x00,
      0x00,
      0x00, // open-ended box size = 0
      0x66,
      0x72,
      0x65,
      0x65, // type = "free" (not "mdat")
      0x50,
      0x4b,
      0x03,
      0x04, // ZIP magic
      0x3c,
      0x68,
      0x74,
      0x6d,
      0x6c, // "<html>"
    ]);
    const file = new File([heic], "open-free.heic", { type: "image/heic" });
    const result = await validateUploadedFile(file, "meter-photo");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/open-ended box that is not media data/);
  });

  describe("JPEG trailing data checks", () => {
    const createJpeg = (bytes: number[]) => {
      return new File([new Uint8Array(bytes)], "test.jpg", {
        type: "image/jpeg",
      });
    };

    it("Test A — valid minimal JPEG passes", async () => {
      // SOI + DQT (8 bytes) + EOI
      const file = createJpeg([
        0xff, 0xd8, 0xff, 0xdb, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0xff, 0xd9,
      ]);
      const result = await validateUploadedFile(file, "meter-photo");
      expect(result.valid).toBe(true);
      expect(result.verifiedMimeType).toBe("image/jpeg");
    });

    it("Test B — appended garbage is rejected", async () => {
      const file = createJpeg([
        0xff, 0xd8, 0xff, 0xdb, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0xff, 0xd9, 0x00, 0x41, 0x42,
      ]);
      const result = await validateUploadedFile(file, "meter-photo");
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/extra data/);
    });

    it("Test C — appended payload ending in FF D9 is rejected (polyglot bypass test)", async () => {
      const file = createJpeg([
        0xff, 0xd8, 0xff, 0xdb, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0xff, 0xd9, 0xde, 0xad, 0xff, 0xd9,
      ]);
      const result = await validateUploadedFile(file, "meter-photo");
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/extra data/);
    });

    it("Test D — JPEG missing EOI is rejected", async () => {
      const file = createJpeg([
        0xff, 0xd8, 0xff, 0xdb, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]);
      const result = await validateUploadedFile(file, "meter-photo");
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/End-of-Image/);
    });

    it("Test E — JPEG with real SOS + EOI, then appended bytes, is rejected", async () => {
      const file = createJpeg([
        0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
        0x7f, 0x7f, 0x7f, 0xff, 0xd9, 0xcc, 0xcc,
      ]);
      const result = await validateUploadedFile(file, "meter-photo");
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/extra data/);
    });
  });
});
