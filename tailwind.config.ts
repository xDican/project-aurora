import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        status: {
          available: "hsl(var(--status-available))",
          "available-foreground": "hsl(var(--status-available-foreground))",
          occupied: "hsl(var(--status-occupied))",
          "occupied-foreground": "hsl(var(--status-occupied-foreground))",
          cleaning: "hsl(var(--status-cleaning))",
          "cleaning-foreground": "hsl(var(--status-cleaning-foreground))",
          maintenance: "hsl(var(--status-maintenance))",
          "maintenance-foreground": "hsl(var(--status-maintenance-foreground))",
        },
        // Additional Material-3-style tokens from the Stitch mockup, used
        // directly (no CSS var indirection) since nothing legacy depends on
        // these names. Add more here as later flows get redesigned.
        "inverse-surface": "#2e3039",
        outline: "#737686",
        "outline-variant": "#c3c6d7",
        "surface-container": "#ededf9",
        "surface-container-low": "#f3f3fe",
        "surface-container-lowest": "#ffffff",
        "surface-container-high": "#e7e7f3",
        "surface-variant": "#e1e2ed",
        "on-surface-variant": "#434655",
        "primary-container": "#2563eb",
        "on-primary-container": "#eeefff",
        "on-primary-fixed-variant": "#003ea8",
        "on-secondary-fixed-variant": "#38485d",
        "on-primary-fixed": "#00174b",
        "secondary-container": "#d0e1fb",
        "on-secondary-container": "#54647a",
        tertiary: "#943700",
        "tertiary-container": "#bc4800",
      },
      fontFamily: {
        sans: ["Hanken Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        "headline-lg": ["24px", { lineHeight: "32px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-md": ["20px", { lineHeight: "28px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "18px", fontWeight: "400" }],
        "table-data": ["14px", { lineHeight: "20px", fontWeight: "500" }],
        "label-md": ["12px", { lineHeight: "16px", fontWeight: "500" }],
        "label-bold": ["12px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "700" }],
      },
      spacing: {
        sidebar_width: "240px",
        container_padding: "1.5rem",
        gutter: "1rem",
        stack_gap_md: "1rem",
        stack_gap_sm: "0.5rem",
        table_cell_padding_x: "1rem",
        table_cell_padding_y: "0.75rem",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // "full" stays Tailwind's true 9999px (circular avatars/icon buttons
        // need a real circle). The mockup's badges/pills only need this much
        // radius to look fully rounded at their height - use rounded-pill
        // for those instead of redefining what "full" means app-wide.
        pill: "0.75rem",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
