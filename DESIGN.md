---
name: Luminous Utility (Intercom Inspired)
description: Track solar-adjusted electricity bills transparently with a calm, editorial UI.
colors:
  accent: "#064E3B"
  success: "#10B981"
  warning: "#F59E0B"
  error: "#EF4444"
  bg-dark: "#0E0E12"
  surface-dark: "#16161A"
  surface-raised-dark: "#202026"
  border-dark: "#2A2A32"
  on-bg-dark: "#F4F4F6"
  bg-light: "#FCFCF9"
  surface-light: "#FFFFFF"
  surface-raised-light: "#F5F5F2"
  border-light: "#E5E5DF"
  on-bg-light: "#1C1C1F"
typography:
  display:
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontWeight: 700
  body:
    fontFamily: "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontWeight: 400
  mono:
    fontFamily: "'JetBrains Mono', 'Monaco', 'Courier New', monospace"
rounded:
  default: "0.5rem"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "48px"
  xl: "96px"
---

# Design System: Meterly (Luminous Utility)

## 1. Overview

**Creative North Star: "The Honest Ledger"**

Premium through intent, not decoration — clear, honest design built for pragmatic people solving a specific problem. Meterly exists to calculate and explain solar-adjusted electricity bills transparently. The visual system reflects this by stripping away SaaS clichés, glowing borders, and generic AI aesthetics. It draws inspiration from Intercom's calming UI: warm creme canvas in light mode, deep charcoal typography for reduced eye strain, and minimal chrome.

We explicitly reject gradient text, cards nested within cards, heavy borders, and decorative glassmorphism.

**Key Characteristics:**
- Utilitarian but premium, built on structural typography (Manrope and Work Sans).
- Form follows data: the dashboard uses precise right-alignment and semantic badges.
- Tonal layering for depth, avoiding heavy drop shadows.
- Invisible UI: contextual actions are revealed only when needed.

## 2. Colors

A disciplined palette driven by function. The base canvas is warm and easy on the eyes (creme), contrasting with crisp charcoal text. High-visibility elements use Deep Emerald sparingly.

### Primary / Accent
- **Deep Emerald** (#064E3B): The primary brand and action color. Replaces the old Electric Indigo. Used sparingly (occasionally) for primary CTAs, active states, and heavy headings to maintain a professional, high-tech fintech feel.

### Neutral (Light Mode — Intercom Inspired)
- **Creme Canvas** (#FCFCF9): The foundational page background. Warm and extremely easy on the eyes.
- **Charcoal Ink** (#1C1C1F): The primary text color for readability without the harshness of pure black.
- **Surface** (#FFFFFF): The default card and container background.
- **Hairline Border** (#E5E5DF): Structural dividers and subtle container outlines.

### Neutral (Dark Mode)
- **Deep Slate Canvas** (#0E0E12): A very dark, almost charcoal background.
- **Off-White Ink** (#F4F4F6): For text in dark mode.
- **Surface** (#16161A): Elevated cards and modules.

### Semantic
- **Success Mint** (#10B981): Used for "Paid" statuses and positive financial deltas.
- **Warning Amber** (#F59E0B): Used for pending states and alerts.
- **Error Red** (#EF4444): Used for destructive actions and validation failures.

**The One Voice Rule.** The primary accent (Deep Emerald) is used on ≤10% of any given screen. Its rarity is the point.

## 3. Typography

**Display Font:** Manrope
**Body Font:** Work Sans
**Label/Mono Font:** JetBrains Mono

**Character:** Structural, technical, and precise. Work Sans provides a neutral, highly legible experience for dense bill breakdowns, while Manrope gives headlines a balanced, modern geometric structure. JetBrains Mono is reserved exclusively for numbers, technical labels, and calculations to suggest high precision.

### Hierarchy
- **Display** (800, clamp(2.5rem, 5vw, 3rem), 1.1, -0.02em): Hero headlines and major page titles.
- **Headline** (700, clamp(1.5rem, 3vw, 2rem), 1.1, -0.01em): Section headers and primary card titles.
- **Title** (600, 1.125rem, 1.3): Sub-sections and minor headings.
- **Body** (400, 1rem, 1.6): Standard paragraph text and table content.
- **Mono** (600, 1rem, 1.6): Meter readings, calculations, and IDs.

**The Tabular Data Rule.** All numeric data in tables and calculations must be right-aligned and use JetBrains Mono to allow users to scan magnitudes instantly.

## 4. Elevation

Tonal layering. Depth is created by shifting background colors rather than using shadows.

### Shadow Vocabulary
- **Flat by Default** (`box-shadow: none`): Surfaces are flat at rest. Depth comes from color contrast (Canvas to Surface).
- **Hover/Focus Lift** (`box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05)`): Subtle structural shadows are used exclusively for interactive feedback or lifting dialogs above the rest of the page.

**The Tonal Lift Rule.** Do not stack cards visually. If a container needs to stand out, lift it by lightening/darkening its background color, not by adding a heavy shadow.

## 5. Components

Tactile, confident, and highly structured to serve the data.

### Buttons
- **Shape:** 8px radius (0.5rem).
- **Primary:** Deep Emerald background with white text, 10px vertical and 20px horizontal padding.
- **Hover / Focus:** Solid transition (200ms cubic-bezier).
- **Secondary:** Surface Raised background with standard text color, used for less prominent actions.

### Cards / Containers
- **Corner Style:** 8px radius.
- **Background:** Surface color.
- **Shadow Strategy:** Flat by default, separated from the Canvas by color contrast and a Hairline Border.
- **Internal Padding:** 24px (spacing-md).

### Chips
- **Style:** Surface Raised background, no border, 4px radius (0.25rem).
- **State:** Used exclusively for finite categorical states (e.g., "Paid", "Pending").

## 6. Do's and Don'ts

Concrete guardrails to maintain the "Honest Ledger" North Star.

### Do:
- **Do** format categorical data (like statuses) as Chips/Badges instead of plain text.
- **Do** right-align all numerical data in tables.
- **Do** use tooltips for any icon without a text label and for complex metric explanations.
- **Do** use the Inverted Pyramid layout: KPIs at the top, trends in the middle, granular tables at the bottom.

### Don't:
- **Don't** use generic "AI slop" aesthetics (glowing borders, blurry gradients, glassmorphism).
- **Don't** use standard SaaS clichés like gradient text or over-engineered dashboards.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored stripe on cards.
- **Don't** put cards inside of other cards.
- **Don't** animate elements decoratively; keep motion constrained to micro-interactions and state changes.
