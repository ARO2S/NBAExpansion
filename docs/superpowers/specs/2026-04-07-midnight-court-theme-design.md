# Midnight Court Theme — Design Spec

**Date:** 2026-04-07  
**Scope:** Hero page redesign + whole-site theme alignment

---

## 1. Visual Identity

- **Background base:** `#05070A` (Rich Black) — replaces current `#0f172a`
- **Surface/Cards:** `rgba(255,255,255,0.05)` glassmorphism
- **Accent:** `#FF8A00` (Basketball Orange)
- **CTA off-white:** `#F8F9FA` / `#E2E8F0`
- **Headings font:** Archivo Black (Google Fonts, via `next/font/google`)
- **Body font:** Inter (Google Fonts, via `next/font/google`)

---

## 2. Files Changed

### `src/app/globals.css`
- Update `--background` CSS variable to `#05070A`
- Update `--primary` to `#FF8A00`
- Add `.glass-card` utility: `backdrop-filter: blur(12px)`, `border: 1px solid rgba(255,255,255,0.1)`, `box-shadow: 0 8px 32px rgba(0,0,0,0.8)`, `border-radius: 12px`

### `tailwind.config.ts`
- Add `courtOrange: '#FF8A00'` color token
- Add `fontFamily.archivo` and `fontFamily.inter`
- Add keyframes: `slide-in-right` (translateX 60px→0 + opacity), `float` (Y-axis oscillation ±8px)
- Add animations: `slide-in-right`, `float`

### `src/app/layout.tsx`
- Import `Archivo_Black` and `Inter` from `next/font/google`
- Apply as CSS variables `--font-archivo` and `--font-inter` on `<body>`
- Keep existing Geist fonts for mono usage in inner app pages

### `src/components/ui/hero-1.tsx`
Complete redesign of the hero component:

**Background layer:**
- Radial gradient: `radial-gradient(circle at 70% 50%, #1A2332 0%, #05070A 100%)`
- SVG court overlay: full-court lines, `transform: perspective(1000px) rotateX(60deg) scale(1.5)`, `opacity: 0.1`, white stroke

**Left column (content):**
- Eyebrow badge (existing pattern, orange tint)
- `<h1>` "BUILD THE NEXT DYNASTY" — Archivo Black, uppercase, gradient white→light-gray
- Subtitle paragraph — Inter, slate-300
- **Primary CTA:** solid `#F8F9FA` background, dark text, hover glow in orange
- **Secondary CTA:** transparent, 1px white/20 border, "Request a Brief" label + 45° arrow icon (`ArrowUpRight` from lucide)
- Entrance: `animate-fade-in` from left (`translateX(-40px)`)

**Right column (glass card stack):**
Three `z-index`-layered glass cards using `.glass-card` styles:
1. **Bottom card** — dark court segment (SVG hardwood + key box lines), slight rotation
2. **Middle card** — static SVG win-projection bar chart with fake team data and orange bars; `animate-float` with 3s delay
3. **Top card** — circular basketball placeholder (`[IMAGE PLACEHOLDER]` label), positioned to overlap middle card, `animate-float` with 1.5s delay
- Stack slides in from right on entrance: `animate-slide-in-right`

### `src/app/runs/layout.tsx`
- Update `bg-[linear-gradient(...)]` to use `#05070A` as the base color

---

## 3. Animations

| Name | Keyframes | Usage |
|------|-----------|-------|
| `fade-in` | opacity 0→1, translateY 20px→0 | Text entrance (existing, kept) |
| `slide-in-right` | opacity 0→1, translateX 60px→0 | Card stack entrance |
| `float` | translateY 0→-8px→0 (infinite) | Individual glass cards |

---

## 4. Out of Scope

- Inner app pages (protect, draft, results, rules) — their `bg-white/5` + `text-white` already harmonize
- Admin pages
- Trust bar — removed entirely
- Real chart library (Recharts) — static SVG placeholder used instead
- Player image — circular placeholder with label used instead
