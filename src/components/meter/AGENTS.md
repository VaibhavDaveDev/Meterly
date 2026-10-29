# Meter Components DOX

## Purpose

- Meter reading submission UI components, photo upload dropzones, and reading preview dialogs.

## Ownership

- `BillPhotoUpload.tsx` owns photo upload handling, canvas-based image compression, and optional OCR triggering.
- `SubmitConfirmDialog.tsx` owns confirmation dialogs when submitting readings with attached photos.
- `UploadedPhotos.tsx` owns thumbnail rendering, fullscreen photo preview modals, and photo deletion triggers.
- `CreatePeriodForm.tsx` owns billing period creation forms and initial/final reading inputs.

## Local Contracts

- Meter readings must be validated locally before submission.
- Photo uploads must compress images client-side before sending to backend.
- OCR is opt-in, default OFF (`enableOcr` gates `runOcrOnImage`).

## Work Guidance

- Use standard `shadcn/ui` components for inputs and buttons.

## Verification

```bash
pnpm test --run src/components/meter
```

## Child DOX Index

No child DOX files.
