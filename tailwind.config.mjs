/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}',
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Core Luminous Utility Colors mapped to CSS Variables
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--on-primary)',
        },
        "on-primary": 'var(--on-primary)',
        "primary-container": 'var(--primary-container)',
        "on-primary-container": 'var(--on-primary-container)',
        
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--on-secondary)',
        },
        "on-secondary": 'var(--on-secondary)',
        "secondary-container": 'var(--secondary-container)',
        "on-secondary-container": 'var(--on-secondary-container)',
        
        tertiary: 'var(--tertiary)',
        "on-tertiary": 'var(--on-tertiary)',
        "tertiary-container": 'var(--tertiary-container)',
        "on-tertiary-container": 'var(--on-tertiary-container)',
        
        error: 'var(--error)',
        "on-error": 'var(--on-error)',
        "error-container": 'var(--error-container)',
        "on-error-container": 'var(--on-error-container)',
        
        background: 'var(--background)',
        "on-background": 'var(--on-background)',
        
        surface: 'var(--surface)',
        "on-surface": 'var(--on-surface)',
        "surface-variant": 'var(--surface-variant)',
        "on-surface-variant": 'var(--on-surface-variant)',
        
        outline: 'var(--outline)',
        "outline-variant": 'var(--outline-variant)',
        
        "surface-container-lowest": 'var(--surface-container-lowest)',
        "surface-container-low": 'var(--surface-container-low)',
        "surface-container": 'var(--surface-container)',
        "surface-container-high": 'var(--surface-container-high)',
        "surface-container-highest": 'var(--surface-container-highest)',
        "surface-dim": 'var(--surface-dim)',
        "surface-bright": 'var(--surface-bright)',
        
        "inverse-surface": 'var(--inverse-surface)',
        "inverse-on-surface": 'var(--inverse-on-surface)',
        "inverse-primary": 'var(--inverse-primary)',
        
        "primary-fixed": 'var(--primary-fixed)',
        "on-primary-fixed": 'var(--on-primary-fixed)',
        "primary-fixed-dim": 'var(--primary-fixed-dim)',
        "on-primary-fixed-variant": 'var(--on-primary-fixed-variant)',
        
        "secondary-fixed": 'var(--secondary-fixed)',
        "on-secondary-fixed": 'var(--on-secondary-fixed)',
        "secondary-fixed-dim": 'var(--secondary-fixed-dim)',
        "on-secondary-fixed-variant": 'var(--on-secondary-fixed-variant)',
        
        "tertiary-fixed": 'var(--tertiary-fixed)',
        "on-tertiary-fixed": 'var(--on-tertiary-fixed)',
        "tertiary-fixed-dim": 'var(--tertiary-fixed-dim)',
        "on-tertiary-fixed-variant": 'var(--on-tertiary-fixed-variant)',

        // Shadcn UI standard colors mapped to Luminous variables
        foreground: 'var(--on-background)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: '0.75rem',
        full: '9999px'
      },
      spacing: {
        "margin-mobile": "20px",
        "stack-sm": "12px",
        "container-max": "1280px",
        "gutter": "24px",
        "margin-desktop": "64px",
        "base": "8px",
        "stack-md": "32px",
        "stack-lg": "80px"
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
        "label-caps": ["JetBrains Mono"],
        "headline-lg": ["Manrope"],
        "headline-xl": ["Manrope"],
        "headline-lg-mobile": ["Manrope"],
        "body-sm": ["Work Sans"],
        "body-md": ["Work Sans"],
        "data-point": ["Manrope"]
      },
      fontSize: {
        "label-caps": ["12px", { "lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "600" }],
        "headline-lg": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.01em", "fontWeight": "700" }],
        "headline-xl": ["48px", { "lineHeight": "56px", "letterSpacing": "-0.02em", "fontWeight": "800" }],
        "headline-lg-mobile": ["28px", { "lineHeight": "36px", "fontWeight": "700" }],
        "body-sm": ["14px", { "lineHeight": "20px", "fontWeight": "400" }],
        "body-md": ["16px", { "lineHeight": "24px", "fontWeight": "400" }],
        "data-point": ["24px", { "lineHeight": "32px", "fontWeight": "600" }]
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
