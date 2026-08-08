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

function readFtypBrands(b: Uint8Array): string[] | null {
  if (b.length < 12) return null;
  if (b[4] !== 0x66 || b[5] !== 0x74 || b[6] !== 0x79 || b[7] !== 0x70)
    return null;
  const size = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
  const end = Math.min(size >= 16 ? size : 16, b.length);
  const brands: string[] = [String.fromCharCode(b[8], b[9], b[10], b[11])];
  for (let o = 16; o + 4 <= end; o += 4) {
    brands.push(String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]));
  }
  return brands;
}

function isValidHeic(b: Uint8Array): boolean {
  const brands = readFtypBrands(b);
  return brands !== null && brands.some((x) => HEIC_ONLY_BRANDS.has(x));
}

function isValidHeif(b: Uint8Array): boolean {
  const brands = readFtypBrands(b);
  return brands !== null && brands.some((x) => HEIF_ONLY_BRANDS.has(x));
}

function checkMagicBytes(buffer: ArrayBuffer, mimeType: string): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 64));
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

// ---------------------------------------------------------------------------
// End-of-file consistency check — detects polyglot "trailing payload" attacks.
//
// For each supported format, we locate the format's logical end marker and
// confirm that no bytes follow it in the buffer.
//
// LIMITATION (by design): this check only detects data appended *after* the
// image's logical end. It does NOT detect payloads hidden *inside* valid
// image segments or chunks (e.g. JPEG comment segments, PNG ancillary chunks
// before IEND). Those are length-consistent and indistinguishable from normal
// image data at this layer.
// ---------------------------------------------------------------------------
function checkNoTrailingData(
  buffer: ArrayBuffer,
  mimeType: string
): { ok: boolean; error?: string } {
  const bytes = new Uint8Array(buffer);
  const len = bytes.length;

  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    // Walk JPEG markers forward from SOI. Prevents the backwards-scan bypass where
    // an attacker appends [payload + FF D9] — the forward walk finds the first
    // structurally valid EOI and rejects any bytes that follow it.
    //
    // Marker structure:
    //   - Standalone (no payload): SOI (D8), EOI (D9), RST0-RST7 (D0-D7), TEM (01)
    //   - Payload markers: 2-byte big-endian length (includes the 2 length bytes)
    //   - SOS (DA): read header length, then scan entropy-coded data for next marker
    //     (FF 00 = stuffed byte, FF FF = fill byte — neither is a real marker;
    //      FF D0-FF D7 = restart markers — skip 2 bytes and continue scanning)
    if (len < 2 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      return {
        ok: false,
        error: "JPEG is missing the Start-of-Image marker (FF D8).",
      };
    }
    let offset = 2; // skip SOI
    while (offset < len) {
      // Skip 0xFF fill bytes preceding the marker byte
      while (offset < len && bytes[offset] === 0xff) {
        offset++;
      }
      if (offset >= len) {
        return {
          ok: false,
          error: "JPEG is missing the End-of-Image marker (FF D9).",
        };
      }
      const markerByte = bytes[offset];
      offset++;

      if (markerByte === 0xd9) {
        // EOI — nothing must follow
        if (offset < len) {
          return {
            ok: false,
            error:
              "File contains extra data after the image end — possible polyglot or corrupted file.",
          };
        }
        return { ok: true };
      }

      // Standalone markers with no payload
      if (
        (markerByte >= 0xd0 && markerByte <= 0xd7) || // RST0-RST7
        markerByte === 0x01 // TEM
      ) {
        continue;
      }

      // SOS (Start-of-Scan): read header length, then scan entropy-coded data
      if (markerByte === 0xda) {
        if (offset + 2 > len) {
          return {
            ok: false,
            error: "JPEG SOS header extends past the file — truncated.",
          };
        }
        const sosLength = (bytes[offset] << 8) | bytes[offset + 1];
        if (sosLength < 2) {
          return {
            ok: false,
            error: "JPEG SOS header has invalid length — corrupted.",
          };
        }
        offset += sosLength; // skip SOS header (length includes its own 2 bytes)
        // Scan entropy-coded data for next real marker.
        // FF 00 = stuffed byte (not a marker), FF FF = fill byte — skip both.
        // FF D0-FF D7 = restart markers inside the entropy stream — skip the
        // two-byte RST sequence and continue scanning (do NOT pass them to the
        // outer loop, which would try to read a length field from the following
        // entropy data and reject a perfectly valid file).
        while (offset < len - 1) {
          if (bytes[offset] === 0xff) {
            const next = bytes[offset + 1];
            if (next >= 0xd0 && next <= 0xd7) {
              offset += 2; // skip restart marker (RST0-RST7) and keep scanning
              continue;
            }
            if (next !== 0x00 && next !== 0xff) {
              break; // real marker found — outer loop will handle it
            }
          }
          offset++;
        }
        continue;
      }

      // All other payload markers: read 2-byte big-endian length and skip
      if (offset + 2 > len) {
        return {
          ok: false,
          error:
            "JPEG segment length field extends past the file — truncated or corrupted.",
        };
      }
      const segLength = (bytes[offset] << 8) | bytes[offset + 1];
      if (segLength < 2) {
        return {
          ok: false,
          error: "JPEG segment has invalid length — corrupted file.",
        };
      }
      offset += segLength;
      if (offset > len) {
        return {
          ok: false,
          error: "JPEG segment extends past the file — truncated or corrupted.",
        };
      }
    }
    return {
      ok: false,
      error: "JPEG is missing the End-of-Image marker (FF D9).",
    };
  }

  if (mimeType === "image/png") {
    // PNG files start with an 8-byte signature, then a sequence of chunks.
    // Each chunk: 4-byte length (big-endian), 4-byte type, N bytes data, 4-byte CRC.
    // The last chunk must be IEND (length === 0, type "IEND").
    // After the IEND chunk (offset + 12 bytes) there must be nothing.
    const PNG_SIG_SIZE = 8;
    const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (len < PNG_SIG_SIZE || PNG_SIG.some((v, i) => bytes[i] !== v)) {
      return {
        ok: false,
        error: "PNG signature is invalid — corrupted or spoofed file.",
      };
    }
    const view = new DataView(buffer);
    let offset = PNG_SIG_SIZE;

    while (offset + 12 <= len) {
      // Read 4-byte big-endian unsigned length.
      // DataView.getUint32 prevents the signed-integer overflow that occurs with
      // JS bitwise shifts on values >= 0x80000000 (would produce a negative
      // chunkLen, making chunkEnd negative, causing ~179M loop iterations).
      const chunkLen = view.getUint32(offset, false);

      const chunkType = String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7]
      );

      const chunkEnd = offset + 4 + 4 + chunkLen + 4; // length + type + data + CRC

      if (chunkEnd > len) {
        return {
          ok: false,
          error:
            "PNG chunk declares a length that extends past the file — truncated or corrupted file.",
        };
      }

      if (chunkType === "IEND") {
        // IEND must have length 0
        if (chunkLen !== 0) {
          return {
            ok: false,
            error: "PNG IEND chunk has non-zero length — corrupted file.",
          };
        }
        const afterIend = chunkEnd;
        if (afterIend < len) {
          return {
            ok: false,
            error:
              "File contains extra data after the image end — possible polyglot or corrupted file.",
          };
        }
        return { ok: true };
      }

      offset = chunkEnd;
    }

    // If we exit the loop without finding IEND, the file is truncated
    return {
      ok: false,
      error: "PNG is missing the IEND chunk — truncated or corrupted file.",
    };
  }

  if (mimeType === "image/webp") {
    // WebP RIFF container: bytes 0–3 "RIFF", bytes 4–7 ChunkSize (little-endian),
    // bytes 8–11 "WEBP". Total declared file size = 8 + ChunkSize.
    if (len < 12) {
      return {
        ok: false,
        error: "WebP file is too short to contain a valid RIFF header.",
      };
    }
    const chunkSize =
      (bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)) >>> 0;
    const declaredEnd = 8 + chunkSize;

    if (declaredEnd < len) {
      return {
        ok: false,
        error:
          "File contains extra data after the image end — possible polyglot or corrupted file.",
      };
    }
    if (declaredEnd > len) {
      return {
        ok: false,
        error:
          "WebP RIFF ChunkSize declares more bytes than the file contains — truncated or corrupted file.",
      };
    }
    return { ok: true };
  }

  if (mimeType === "image/heic" || mimeType === "image/heif") {
    // Walk ISO BMFF top-level boxes. A valid ftyp brand alone does not prove the
    // buffer is an image — an attacker can append arbitrary data after the 12-byte
    // ftyp header. A full box-structure walk rejects any non-BMFF payload.
    //
    // Box layout: 4-byte big-endian size (includes header) + 4-byte type.
    // size=0 → box extends to EOF (valid only as the last box).
    // size=1 → 64-bit extended size (reject — not expected in normal HEIC files).
    const heifView = new DataView(buffer);
    let offset = 0;
    while (offset < len) {
      if (offset + 8 > len) {
        return {
          ok: false,
          error:
            "HEIC/HEIF file has a box header that extends past the file — truncated or corrupted.",
        };
      }
      const boxSize = heifView.getUint32(offset, false);
      const boxType = String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7]
      );
      if (boxSize === 1) {
        return {
          ok: false,
          error:
            "HEIC/HEIF file uses unsupported extended box size — corrupted or non-standard file.",
        };
      }
      if (boxSize === 0) {
        // Extends to EOF — only accept for media data, never for arbitrary types.
        if (boxType !== "mdat") {
          return {
            ok: false,
            error:
              "HEIC/HEIF file has an open-ended box that is not media data — possible polyglot file.",
          };
        }
        offset = len;
        break;
      }
      if (boxSize < 8) {
        return {
          ok: false,
          error: "HEIC/HEIF file has a box with invalid size — corrupted file.",
        };
      }
      if (offset + boxSize > len) {
        return {
          ok: false,
          error:
            "HEIC/HEIF box declares a size that extends past the file — truncated or corrupted.",
        };
      }
      offset += boxSize;
    }
    if (offset !== len) {
      return {
        ok: false,
        error:
          "File contains extra data after the HEIC/HEIF container end — possible polyglot or corrupted file.",
      };
    }
    return { ok: true };
  }

  // Every accepted MIME type must have a structural check above. Fail closed so
  // that adding a type to the endpoint allowlists cannot silently skip this check.
  return {
    ok: false,
    error: "Unsupported file format — structural validation is not available.",
  };
}

export async function validateUploadedFile(
  file: File,
  endpoint: "meter-photo" | "bill-document"
): Promise<{
  valid: boolean;
  verifiedMimeType?: string;
  error?: string;
  buffer?: ArrayBuffer;
}> {
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

  // End-of-file consistency check (polyglot detection)
  const trailingCheck = checkNoTrailingData(buffer, verifiedMimeType);
  if (!trailingCheck.ok) {
    return { valid: false, error: trailingCheck.error };
  }

  return { valid: true, verifiedMimeType, buffer };
}
