import React, { useState, useRef, useCallback } from "react";
import { Camera, X, Loader2, CheckCircle } from "lucide-react";
import { setCachedPhoto } from "../../lib/image-cache";
import { BillExtractResult, getPdfPageAsBlob } from "../../lib/pdf-extract";
import {
  validateFilePreFlight,
  processPdfFile,
  processImageFile,
  runOcrOnImage,
} from "../../lib/ocr-extraction";
import { Switch } from "../ui/switch";

export interface ExtractedData {
  type: "pdf" | "image";
  pdfResult?: BillExtractResult;
  imageResult?: { value: number | null; confidence: number };
}

interface BillPhotoUploadProps {
  periodId: string;
  propertyId: string;
  purpose?: "import_meter" | "export_meter" | "solar_meter" | "bill_document";
  editRequestId?: string;
  onReadingExtracted?: (data: ExtractedData) => void;
  onUploadSuccess?: () => void;
}

type UploadState =
  | { status: "idle" }
  | { status: "compressing" }
  | { status: "uploading" }
  | { status: "running-ocr" }
  | { status: "done"; objectKey?: string; message?: string }
  | { status: "error"; message: string };

export function BillPhotoUpload({
  periodId,
  propertyId,
  purpose,
  editRequestId,
  onReadingExtracted,
  onUploadSuccess,
}: BillPhotoUploadProps) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [enableOcr, setEnableOcr] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showOcrToggle = purpose !== "bill_document";

  const handleFile = useCallback(
    async (file: File) => {
      const error = validateFilePreFlight(file);
      if (error) {
        setState({ status: "error", message: error });
        return;
      }

      const isPdf = file.type === "application/pdf";
      let fileToCompress = file;
      const fileForOcr = file;

      if (isPdf) {
        setState({ status: "running-ocr" });
        const { success, message, result } = await processPdfFile(file);

        if (!success) {
          setState({ status: "error", message });
          return;
        }

        // Convert PDF page to image so we can upload it as proof
        setState({ status: "compressing" });
        const pdfBlob = await getPdfPageAsBlob(file, 1);
        if (!pdfBlob) {
          setState({
            status: "error",
            message: "Failed to generate preview image from PDF.",
          });
          return;
        }

        fileToCompress = new File([pdfBlob], "page.png", { type: "image/png" });

        if (onReadingExtracted && result) {
          // We'll call this after upload succeeds
          onReadingExtracted({ type: "pdf", pdfResult: result });
        }
      }

      // Step 1: Compress image
      setState({ status: "compressing" });
      const {
        success: imgSuccess,
        message: imgMessage,
        compressed,
      } = await processImageFile(fileToCompress);

      if (!imgSuccess || !compressed) {
        setState({ status: "error", message: imgMessage });
        return;
      }

      // Show preview
      const previewUrl = URL.createObjectURL(compressed.blob);
      setPreview(previewUrl);

      // Step 2: Upload to R2
      setState({ status: "uploading" });
      const formData = new FormData();
      formData.append(
        "photo",
        new File([compressed.blob], "photo.webp", { type: "image/webp" })
      );
      formData.append("periodId", periodId);
      formData.append("propertyId", propertyId);
      formData.append("purpose", purpose || "import_meter");
      if (editRequestId) {
        formData.append("editRequestId", editRequestId);
      }

      try {
        const res = await fetch("/api/uploads/bill-photo", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const json = (await res.json()) as {
          success: boolean;
          data?: { objectKey: string };
          error?: { message: string };
        };

        if (!json.success) {
          setState({
            status: "error",
            message: json.error?.message || "Failed to upload photo.",
          });
          return;
        }

        if (json.data) {
          await setCachedPhoto(json.data.objectKey, compressed.blob);
        }
      } catch {
        setState({ status: "error", message: "Network error during upload." });
        return;
      }

      if (onUploadSuccess) {
        onUploadSuccess();
      }

      if (isPdf) {
        setState({
          status: "done",
          message: "PDF processed and preview saved successfully.",
        });
        return;
      }

      // Step 4: Run OCR
      if (enableOcr) {
        setState({ status: "running-ocr" });
        const imageResult = await runOcrOnImage(fileForOcr);

        setState({
          status: "done",
          message:
            imageResult.value !== null
              ? `Found reading: ${imageResult.value} (${Math.round(imageResult.confidence)}% confidence)`
              : "Could not read a number from the photo. Enter it manually below.",
        });

        if (imageResult.value !== null && onReadingExtracted) {
          onReadingExtracted({ type: "image", imageResult });
        }
      } else {
        setState({
          status: "done",
          message:
            "Photo saved. Enter the meter reading manually in the fields below.",
        });
      }
    },
    [
      periodId,
      propertyId,
      purpose,
      editRequestId,
      onReadingExtracted,
      onUploadSuccess,
      enableOcr,
    ]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setState({ status: "idle" });
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      {state.status === "idle" && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-accent/50 hover:bg-surface-raised transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground mb-1">
            Upload meter photo{" "}
            <span className="text-muted-foreground font-normal">
              (Optional)
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Drag & drop or click to select. JPEG, PNG, or PDF. Max 20MB image,
            10MB PDF.
            <br />
            <span className="opacity-75">
              You can skip this and just enter the numbers manually below.
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            We'll compress it to WebP.
          </p>

          {showOcrToggle && (
            <div
              className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <Switch
                id="ocr-toggle"
                checked={enableOcr}
                onCheckedChange={setEnableOcr}
              />
              <label
                htmlFor="ocr-toggle"
                className="text-xs text-muted-foreground cursor-pointer select-none text-left"
              >
                Auto-read meter value (OCR)
                <span className="block text-[11px] opacity-60">
                  Takes a few extra seconds. Works best on clear photos.
                </span>
              </label>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg, image/png, image/webp, image/heic, application/pdf"
            capture="environment"
            className="hidden"
            onChange={handleInputChange}
          />
        </div>
      )}

      {/* Compressing / Uploading / OCR states */}
      {(state.status === "compressing" ||
        state.status === "uploading" ||
        state.status === "running-ocr") && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-surface">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
          <p className="text-sm text-foreground">
            {state.status === "compressing" && "Compressing image..."}
            {state.status === "uploading" && "Uploading..."}
            {state.status === "running-ocr" &&
              "Reading meter value with OCR..."}
          </p>
        </div>
      )}

      {/* Done state */}
      {state.status === "done" && (
        <div className="flex items-start gap-4 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-700">
                Photo processed successfully
              </p>
            </div>
            <p
              className={`text-xs ${state.message?.includes("Could not") ? "text-amber-600/80" : "text-emerald-600/80"}`}
            >
              {state.message}
            </p>
            <button
              onClick={reset}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline mt-2"
            >
              Upload a different photo or document
            </button>
          </div>
          {preview && (
            <img
              src={preview}
              alt="Preview"
              className="w-16 h-16 object-cover rounded-lg border border-emerald-500/20"
            />
          )}
        </div>
      )}

      {/* Error state */}
      {state.status === "error" && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-red-600 mb-1">
              Upload failed
            </p>
            <p className="text-xs text-red-600/80">{state.message}</p>
          </div>
          <button onClick={reset} className="p-1 hover:bg-red-500/10 rounded">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}
    </div>
  );
}
