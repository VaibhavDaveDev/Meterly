# Properties Components DOX

## Purpose

- React components for property management, tenant leasing, rate settings, and reading submissions.

## Ownership

- `PropertyDetails.tsx` owns the property management dashboard tabs (Overview, Tenants, Billing History, Rates, Charges, Settings).
- `PropertySettings.tsx` owns property configuration (solar toggle, solo mode toggle, reading approval toggle).
- `SubmitReadingForm.tsx` owns meter reading input forms and live preview calculations (delegated to `useSubmitReading`).

## Local Contracts

- Mobile-responsive and WCAG compliant.
- All calculations must display full transparency (showing base rates, split percentages, solar credit, and formulas).

## Work Guidance

- `SubmitReadingForm` decomposes rendering into `MeterDeltasTable` and `BillPreviewBreakdown` to maintain low cognitive complexity.

## Verification

```bash
pnpm test --run src/components/properties
```

## Child DOX Index

No child DOX files.
