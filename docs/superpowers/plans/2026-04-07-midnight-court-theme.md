# Midnight Court Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the hero page and align the whole-site theme to the "Midnight Court" spec — dark `#05070A` base, Basketball Orange `#FF8A00` accent, Archivo Black headings, two-column hero with perspective court overlay and glassmorphism card stack.

**Architecture:** Theme tokens live in `globals.css` (CSS vars) and `tailwind.config.ts`. Fonts load in `layout.tsx`. The hero is a self-contained component in `hero-1.tsx` — it gets a full rewrite. The runs layout gets a single background-gradient update. No new files are created.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, `next/font/google` (Archivo Black + Inter), Lucide icons, static inline SVG for chart placeholder.

---

## File Map

| File | Change |
|------|--------|
| `src/app/globals.css` | CSS variable overrides + `.glass-card` utility |
| `tailwind.config.ts` | New color token, font families, keyframes, animations |
| `src/app/layout.tsx` | Load Archivo Black + Inter via `next/font/google` |
| `src/app/runs/layout.tsx` | Update gradient base to `#05070A` |
| `src/components/ui/hero-1.tsx` | Full rewrite — two-column Midnight Court layout |

---

## Task 1: CSS Variables + Glass Card Utility

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update CSS custom properties and add glass-card utility**

Replace the entire `globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 240 14% 4%;        /* #05070A */
    --foreground: 210 40% 98%;
    --card: 0 0% 0%;
    --card-foreground: 210 40% 98%;
    --popover: 240 14% 4%;
    --popover-foreground: 210 40% 98%;
    --primary: 33 100% 50%;           /* #FF8A00 */
    --primary-foreground: 240 14% 4%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 33 100% 50%;
    --accent-foreground: 240 14% 4%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 33 100% 50%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
  .glass-card {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.8);
    border-radius: 12px;
  }
}
```

- [ ] **Step 2: Verify no compile errors**

```bash
cd /home/andyr/NBAExpansion && npm run build 2>&1 | tail -20
```

Expected: build completes (or at worst shows unrelated errors, not CSS parse errors).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: update CSS vars to Midnight Court palette + glass-card utility"
```

---

## Task 2: Tailwind Config — Colors, Fonts, Keyframes

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Update tailwind.config.ts**

Replace the entire file with:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
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
        "court-orange": "#FF8A00",
      },
      fontFamily: {
        archivo: ["var(--font-archivo)", "sans-serif"],
        inter: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(40px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-from-left": {
          "0%": { opacity: "0", transform: "translateX(-40px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-from-right": {
          "0%": { opacity: "0", transform: "translateX(60px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.8s ease forwards 0.2s",
        "fade-up": "fade-up 0.8s ease forwards 0.5s",
        "slide-from-left": "slide-from-left 0.9s ease forwards 0.1s",
        "slide-from-right": "slide-from-right 0.9s ease forwards 0.3s",
        "float-slow": "float 4s ease-in-out infinite",
        "float-medium": "float 3.2s ease-in-out infinite 0.6s",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
```

- [ ] **Step 2: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: add court-orange token, archivo/inter fonts, slide and float keyframes"
```

---

## Task 3: Font Loading + Runs Layout Background

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/runs/layout.tsx`

- [ ] **Step 1: Update layout.tsx to load Archivo Black + Inter**

Replace the entire file with:

```tsx
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Archivo_Black, Inter } from "next/font/google";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "NBA Expansion Draft Simulator",
  description: "Simulate drafting an NBA expansion team under configurable rules",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${archivoBlack.variable} ${inter.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Update runs/layout.tsx background to use #05070A base**

Replace the entire file with:

```tsx
export default function RunsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-[#05070A]">
      {/* Subtle orange grid — fixed so it doesn't scroll */}
      <div
        className="pointer-events-none fixed inset-0 -z-10
        bg-[linear-gradient(to_right,#FF8A0010_1px,transparent_1px),linear-gradient(to_bottom,#FF8A0010_1px,transparent_1px)]
        bg-[size:6rem_5rem]"
      />
      {/* Faint orange top glow */}
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(255,138,0,0.10),transparent)]" />
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx src/app/runs/layout.tsx
git commit -m "feat: load Archivo Black + Inter fonts, update runs layout to Midnight Court base"
```

---

## Task 4: Hero Rewrite — Background Layers + Two-Column Skeleton

**Files:**
- Modify: `src/components/ui/hero-1.tsx`

This task sets up the structural skeleton and background. Left and right column content is added in Tasks 5 and 6.

- [ ] **Step 1: Replace hero-1.tsx with the two-column skeleton + background layers**

```tsx
"use client"

import { ArrowUpRight, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HeroProps {
  eyebrow?: string
  title: string
  subtitle: string
  ctaLabel?: string
  ctaHref?: string
}

export function Hero({
  eyebrow = "NBA Expansion Draft",
  title,
  subtitle,
  ctaLabel = "Start Draft",
  ctaHref = "#",
}: HeroProps) {
  return (
    <section
      id="hero"
      className="relative w-full min-h-screen overflow-hidden flex items-center"
      style={{ background: "radial-gradient(circle at 70% 50%, #1A2332 0%, #05070A 100%)" }}
    >
      {/* Perspective court SVG overlay */}
      <div
        className="absolute inset-0 pointer-events-none select-none overflow-hidden"
        aria-hidden="true"
      >
        <div
          style={{
            transform: "perspective(1000px) rotateX(60deg) scale(1.5)",
            transformOrigin: "center center",
            opacity: 0.1,
            position: "absolute",
            inset: 0,
          }}
        >
          <svg
            viewBox="0 0 800 400"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
          >
            {/* Sidelines */}
            <line x1="40" y1="20" x2="40" y2="380" stroke="#ffffff" strokeWidth="2" />
            <line x1="760" y1="20" x2="760" y2="380" stroke="#ffffff" strokeWidth="2" />
            {/* Baselines */}
            <line x1="40" y1="20" x2="760" y2="20" stroke="#ffffff" strokeWidth="2" />
            <line x1="40" y1="380" x2="760" y2="380" stroke="#ffffff" strokeWidth="2" />
            {/* Half-court line */}
            <line x1="400" y1="20" x2="400" y2="380" stroke="#ffffff" strokeWidth="2" />
            {/* Center circle */}
            <ellipse cx="400" cy="200" rx="70" ry="70" fill="none" stroke="#ffffff" strokeWidth="2" />
            {/* Left three-point arc */}
            <path d="M 40 110 Q 220 200 40 290" fill="none" stroke="#ffffff" strokeWidth="2" />
            {/* Right three-point arc */}
            <path d="M 760 110 Q 580 200 760 290" fill="none" stroke="#ffffff" strokeWidth="2" />
            {/* Left paint */}
            <rect x="40" y="145" width="130" height="110" fill="none" stroke="#ffffff" strokeWidth="1.5" />
            {/* Right paint */}
            <rect x="630" y="145" width="130" height="110" fill="none" stroke="#ffffff" strokeWidth="1.5" />
            {/* Left free throw circle */}
            <ellipse cx="170" cy="200" rx="45" ry="45" fill="none" stroke="#ffffff" strokeWidth="1.5" />
            {/* Right free throw circle */}
            <ellipse cx="630" cy="200" rx="45" ry="45" fill="none" stroke="#ffffff" strokeWidth="1.5" />
          </svg>
        </div>
      </div>

      {/* Orange radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 50% at 15% 50%, rgba(255,138,0,0.12), transparent)" }}
      />

      {/* Two-column content */}
      <div className="relative z-10 container mx-auto px-6 md:px-12 py-24 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {/* LEFT COLUMN — content (Task 5) */}
        <div className="flex flex-col gap-6 opacity-0 animate-slide-from-left">
          <span className="text-sm text-[#FF8A00] font-medium uppercase tracking-widest">
            {eyebrow}
          </span>
          <h1
            className="font-archivo uppercase font-black text-5xl sm:text-6xl lg:text-7xl leading-none tracking-tight"
            style={{
              background: "linear-gradient(135deg, #ffffff 40%, #cbd5e1 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {title}
          </h1>
          <p className="font-inter text-slate-300 text-lg leading-relaxed max-w-md">
            {subtitle}
          </p>
          <div className="flex flex-wrap gap-4 mt-2">
            {ctaLabel && (
              <Button
                asChild
                className="px-8 py-3 text-base font-semibold bg-[#F8F9FA] text-[#05070A] hover:bg-white
                  transition-all duration-200
                  hover:shadow-[0_0_28px_rgba(255,138,0,0.5)]"
              >
                <a href={ctaHref}>{ctaLabel}</a>
              </Button>
            )}
            <Button
              variant="ghost"
              className="px-8 py-3 text-base font-semibold text-[#E2E8F0] border border-white/20
                hover:bg-white/5 hover:border-white/40 transition-all duration-200 flex items-center gap-2"
            >
              Request a Brief
              <ArrowUpRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* RIGHT COLUMN — glass card stack (Task 6) */}
        <div className="relative h-[420px] opacity-0 animate-slide-from-right hidden md:block">
          {/* placeholder — replaced in Task 6 */}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Start dev server and visually confirm the two-column layout renders with dark background and perspective court**

```bash
cd /home/andyr/NBAExpansion && npm run dev
```

Open `http://localhost:3000`. Expected: dark `#05070A` background, faint court lines tilted in perspective, left column with headline and two CTAs, empty right column.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/hero-1.tsx
git commit -m "feat: hero skeleton — two-column layout, perspective court overlay, left column content"
```

---

## Task 5: Hero Right Column — Glass Card Stack

**Files:**
- Modify: `src/components/ui/hero-1.tsx`

Replace the `{/* RIGHT COLUMN */}` placeholder div (the one with `h-[420px]`) with the full three-card glass stack.

- [ ] **Step 1: Replace the right column placeholder with the glass card stack**

Find this block in `hero-1.tsx`:

```tsx
        {/* RIGHT COLUMN — glass card stack (Task 6) */}
        <div className="relative h-[420px] opacity-0 animate-slide-from-right hidden md:block">
          {/* placeholder — replaced in Task 6 */}
        </div>
```

Replace it with:

```tsx
        {/* RIGHT COLUMN — glass card stack */}
        <div className="relative h-[460px] opacity-0 animate-slide-from-right hidden md:block">

          {/* BOTTOM CARD — dark court segment */}
          <div
            className="glass-card absolute bottom-0 left-4 right-4 h-52"
            style={{ transform: "rotate(-1.5deg)", zIndex: 1 }}
          >
            <svg
              viewBox="0 0 360 200"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full opacity-40"
              aria-hidden="true"
            >
              <rect width="360" height="200" fill="#0D1117" rx="12" />
              {/* Hardwood planks */}
              {[30, 55, 80, 105, 130, 155, 180].map((y) => (
                <line key={y} x1="0" y1={y} x2="360" y2={y} stroke="#92400e" strokeWidth="0.6" strokeOpacity="0.35" />
              ))}
              {/* Paint box */}
              <rect x="120" y="20" width="120" height="120" fill="rgba(255,138,0,0.05)" stroke="rgba(255,138,0,0.4)" strokeWidth="1.5" rx="2" />
              {/* Free throw circle */}
              <ellipse cx="180" cy="140" rx="50" ry="22" fill="none" stroke="rgba(255,138,0,0.4)" strokeWidth="1.5" />
              {/* Baseline */}
              <line x1="20" y1="178" x2="340" y2="178" stroke="rgba(255,138,0,0.5)" strokeWidth="1.5" />
              {/* Restricted arc */}
              <path d="M 155 178 Q 155 155 180 155 Q 205 155 205 178" fill="none" stroke="rgba(255,138,0,0.4)" strokeWidth="1.5" />
            </svg>
          </div>

          {/* MIDDLE CARD — win-projection chart */}
          <div
            className="glass-card absolute bottom-24 left-0 right-8 h-52 p-4 animate-float-slow"
            style={{ zIndex: 2 }}
          >
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-inter">Win Projection</p>
            <svg viewBox="0 0 300 120" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
              {/* Y-axis grid lines */}
              {[20, 50, 80, 110].map((y) => (
                <line key={y} x1="30" y1={y} x2="295" y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              ))}
              {/* Bars — static placeholder data: 6 teams */}
              {[
                { x: 40,  h: 70, label: "LAL" },
                { x: 80,  h: 55, label: "GSW" },
                { x: 120, h: 90, label: "BOS" },
                { x: 160, h: 48, label: "MIA" },
                { x: 200, h: 62, label: "DEN" },
                { x: 240, h: 78, label: "PHX" },
              ].map(({ x, h, label }) => (
                <g key={label}>
                  <rect x={x} y={110 - h} width="24" height={h} fill="#FF8A00" opacity="0.85" rx="3" />
                  <text x={x + 12} y="118" textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="sans-serif">{label}</text>
                </g>
              ))}
              {/* Y-axis label */}
              <text x="8" y="115" fill="#64748b" fontSize="7" fontFamily="sans-serif">0</text>
              <text x="8" y="45" fill="#64748b" fontSize="7" fontFamily="sans-serif">50</text>
            </svg>
          </div>

          {/* TOP CARD — player/basketball placeholder */}
          <div
            className="glass-card absolute top-0 right-0 w-40 h-40 flex flex-col items-center justify-center gap-2 animate-float-medium"
            style={{ zIndex: 3 }}
          >
            {/* Basketball circle placeholder */}
            <div
              className="w-24 h-24 rounded-full border-2 border-[#FF8A00]/60 flex items-center justify-center"
              style={{ background: "radial-gradient(circle at 40% 35%, #b45309, #7c2d12)" }}
            >
              {/* Seam lines */}
              <svg viewBox="0 0 96 96" className="absolute w-24 h-24" aria-hidden="true">
                <path d="M 48 4 Q 20 48 48 92" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" />
                <path d="M 48 4 Q 76 48 48 92" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" />
                <path d="M 4 48 Q 48 20 92 48" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" />
              </svg>
            </div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-inter">Player Image</span>
          </div>

        </div>
```

- [ ] **Step 2: Visually verify the three cards render at `http://localhost:3000`**

Expected: bottom card shows faint court lines at slight angle; middle card shows orange bar chart; top card shows basketball circle overlapping middle card. Cards should float subtly.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/hero-1.tsx
git commit -m "feat: hero right column — three-layer glass card stack with court, chart, and basketball placeholder"
```

---

## Task 6: Final Polish — Eyebrow Badge + Animation Opacity Fix

**Files:**
- Modify: `src/components/ui/hero-1.tsx`

The left column and right column both start with `opacity-0` and rely on Tailwind animation classes to animate in. Tailwind's `animate-*` classes use `forwards` fill mode so the final state is `opacity: 1`. But because the initial class also sets `opacity-0`, we need to confirm the animation overrides correctly. This task also styles the eyebrow badge to match the design.

- [ ] **Step 1: Verify animations override opacity-0 correctly**

Open `http://localhost:3000` and do a hard refresh. Both columns should fade/slide in and remain visible. If either column stays invisible after animation completes, it means the animation `forwards` fill isn't overriding the `opacity-0` class.

If columns stay invisible, add `[animation-fill-mode:forwards]` inline styles to the column divs as a fallback — but first check the Tailwind `animation` definition in `tailwind.config.ts` includes `forwards`:

```ts
"slide-from-left": "slide-from-left 0.9s ease forwards 0.1s",
"slide-from-right": "slide-from-right 0.9s ease forwards 0.3s",
```

Both already include `forwards` — this should work. If not, the fix is to remove `opacity-0` from the column divs and rely solely on the animation starting at `opacity: 0`.

- [ ] **Step 2: Run build to confirm no TypeScript errors**

```bash
cd /home/andyr/NBAExpansion && npm run build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully` or equivalent. No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/hero-1.tsx
git commit -m "feat: midnight court hero — complete. Polish animations and verify build"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Background `#05070A` + radial gradient — Task 4
- [x] SVG court overlay with perspective transform — Task 4
- [x] Archivo Black headings + Inter body — Tasks 2 & 3
- [x] `#FF8A00` accent color throughout — Tasks 1 & 2
- [x] Left column: headline, subtitle, primary CTA (solid), secondary CTA (outline + ArrowUpRight) — Task 4
- [x] Right column: bottom court card, middle chart card, top basketball placeholder — Task 5
- [x] Glassmorphism `.glass-card` utility — Task 1
- [x] `float` animations on right column cards — Tasks 2 & 5
- [x] `slide-from-left` / `slide-from-right` entrance animations — Tasks 2 & 4
- [x] Runs layout updated to `#05070A` base — Task 3
- [x] Trust bar removed — not present in any task (correct)

**No placeholders:** All tasks contain real code.

**Type consistency:** `HeroProps` interface unchanged. All animation class names (`animate-slide-from-left`, `animate-slide-from-right`, `animate-float-slow`, `animate-float-medium`) defined in `tailwind.config.ts` Task 2 and used in Tasks 4 & 5. `.glass-card` defined in `globals.css` Task 1, used as a plain CSS class string in Task 5.
