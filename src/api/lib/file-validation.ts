// HEVC-coded HEIC brands (file extension: .heic)
const HEIC_ONLY_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
]);

// Generic HEIF structural brands (codec-agnostic, file extension: .heif)
const HEIF_ONLY_BRANDS = new Set(["mif1", "msf1"]);

function isValidHeic(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  if (b[4] !== 0x66 || b[5] !== 0x74 || b[6] !== 0x79 || b[7] !== 0x70)
    return false;
  const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
  return HEIC_ONLY_BRANDS.has(brand);
}

function isValidHeif(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  if (b[4] !== 0x66 || b[5] !== 0x74 || b[6] !== 0x79 || b[7] !== 0x70)
    return false;
  const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
  return HEIF_ONLY_BRANDS.has(brand);
}

function checkMagicBytes(buffer: ArrayBuffer, mimeType: string): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 12));
  if (bytes.length < 12) return false;

  const SIGNATURES: Record<string, (b: Uint8Array) => boolean> = {
    "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    "image/jpg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    "image/png": (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
    "application/pdf": (b) =>
      b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
    "image/webp": (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
    "image/heic": isValidHeic,
    "image/heif": isValidHeif,
  };

  return SIGNATURES[mimeType]?.(bytes) ?? false;
}

// Detect the actual MIME type from magic bytes (server-side, not trusting client header).
// Returns null if no signature matches.
function detectMimeType(buffer: ArrayBuffer): string | null {
  const candidates = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/pdf",
  ];
  for (const mime of candidates) {
    if (checkMagicBytes(buffer, mime)) return mime;
  }
  return null;
}

export async function validateUploadedFile(
  file: File,
  endpoint: "meter-photo" | "bill-document"
): Promise<{ valid: boolean; verifiedMimeType?: string; error?: string }> {
  if (file.size === 0) {
    return { valid: false, error: "File is empty" };
  }

  if (endpoint === "bill-document") {
    if (file.size > 5 * 1024 * 1024) {
      return { valid: false, error: "File must be under 5 MB." };
    }
    const allowed = ["image/webp", "image/jpeg", "image/jpg"];
    if (!allowed.includes(file.type)) {
      return {
        valid: false,
        error: "Only WebP or JPEG images are accepted for bill documents.",
      };
    }
  } else {
    if (file.size > 5 * 1024 * 1024) {
      return { valid: false, error: "File must be under 5 MB." };
    }
    const allowed = [
      "image/webp",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/heic",
      "image/heif",
    ];
    if (!allowed.includes(file.type)) {
      return {
        valid: false,
        error: "Only WebP, JPEG, PNG, or HEIC images are accepted.",
      };
    }
  }

  const buffer = await file.arrayBuffer();
  const verifiedMimeType = detectMimeType(buffer);
  if (!verifiedMimeType || !checkMagicBytes(buffer, file.type)) {
    return {
      valid: false,
      error: "File format does not match its extension (corrupted or spoofed).",
    };
  }

  return { valid: true, verifiedMimeType };
}
