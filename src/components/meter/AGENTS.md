# Purpose
Meter reading submission UI components, including the photo upload feature.

# Ownership
Frontend developers.

# Local Contracts
- `BillPhotoUpload.tsx` handles photo compression (Canvas) and delegates OCR to `src/lib/ocr-worker.ts`.
- `SubmitConfirmDialog.tsx` handles confirming submission of meter readings when photo attachments are present.
- `UploadedPhotos.tsx` renders WebP thumbnail list, fullscreen viewing overlays, and handles photo deletions.
- `CreatePeriodForm.tsx` supports creating a new current or historical billing period and saving initial/final readings.
- Meter readings are validated locally before submission.

# Work Guidance
- Use the standard `shadcn/ui` components for inputs and buttons.
- Photo uploads must compress images client-side before sending to the backend to save bandwidth.
- OCR is opt-in, default OFF. The `enableOcr` state in `BillPhotoUpload.tsx` gates `runOcrOnImage`. Toggle only renders for meter purposes, not `bill_document`.

# Verification
- Ensure that the reading preview updates dynamically when readings are entered manually or via photo upload.

# Child DOX Index
- None.
