"use client"

import { ChevronRight } from "lucide-react"
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
      className="relative mx-auto w-full pt-40 px-6 text-center md:px-8
      min-h-screen overflow-hidden
      bg-[linear-gradient(to_bottom,#0f172a,#1e293b_50%,#1c0f05_88%)]"
    >
      {/* Orange grid background */}
      <div
        className="absolute -z-10 inset-0 h-[600px] w-full
        bg-[linear-gradient(to_right,#f9731620_1px,transparent_1px),linear-gradient(to_bottom,#f9731620_1px,transparent_1px)]
        bg-[size:6rem_5rem]
        [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]"
      />

      {/* Orange radial glow from top */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_40%_at_50%_-5%,rgba(249,115,22,0.25),transparent)]" />

      {/* Eyebrow badge */}
      {eyebrow && (
        <a href="#" className="group inline-block">
          <span
            className="text-sm text-orange-400 font-medium mx-auto px-5 py-2
            bg-orange-500/10 border border-orange-500/30
            rounded-3xl w-fit tracking-tight uppercase flex items-center justify-center gap-1"
          >
            {eyebrow}
            <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </a>
      )}

      {/* Title */}
      <h1
        className="animate-fade-in -translate-y-4 text-balance
        bg-gradient-to-br from-white from-30% to-orange-400/70
        bg-clip-text py-6 text-5xl font-semibold leading-none tracking-tighter
        text-transparent opacity-0 sm:text-6xl md:text-7xl lg:text-8xl"
      >
        {title}
      </h1>

      {/* Subtitle */}
      <p
        className="animate-fade-in mb-12 -translate-y-4 text-balance
        text-lg tracking-tight text-slate-300
        opacity-0 md:text-xl [animation-delay:0.35s]"
      >
        {subtitle}
      </p>

      {/* CTA */}
      {ctaLabel && (
        <div className="flex justify-center">
          <Button
            asChild
            className="mt-[-20px] w-fit md:w-52 z-20 tracking-tighter text-center text-lg
            bg-orange-500 hover:bg-orange-400 text-white font-semibold shadow-[0_0_24px_rgba(249,115,22,0.4)]
            transition-all duration-200 hover:shadow-[0_0_32px_rgba(249,115,22,0.6)]"
          >
            <a href={ctaHref}>{ctaLabel}</a>
          </Button>
        </div>
      )}

      {/* Basketball court bottom decoration */}
      <div className="animate-fade-up absolute inset-x-0 bottom-0 h-[30vh] opacity-0 pointer-events-none select-none">
        <svg
          viewBox="0 110 800 150"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="courtFloorGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#92400e" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#0f0803" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="courtLineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Hardwood floor fill */}
          <rect x="0" y="40" width="800" height="220" fill="url(#courtFloorGrad)" />

          {/* Hardwood planks (subtle horizontal lines) */}
          {[60, 80, 100, 120, 140, 160, 180, 200, 220, 240].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="800"
              y2={y}
              stroke="#b45309"
              strokeWidth="0.5"
              strokeOpacity="0.2"
            />
          ))}

          {/* Sidelines */}
          <line x1="40" y1="40" x2="40" y2="260" stroke="url(#courtLineGrad)" strokeWidth="2" />
          <line x1="760" y1="40" x2="760" y2="260" stroke="url(#courtLineGrad)" strokeWidth="2" />

          {/* Baseline */}
          <line x1="40" y1="255" x2="760" y2="255" stroke="url(#courtLineGrad)" strokeWidth="2" />

          {/* Half-court line */}
          <line x1="400" y1="40" x2="400" y2="260" stroke="url(#courtLineGrad)" strokeWidth="2" />

          {/* Center circle */}
          <ellipse cx="400" cy="55" rx="75" ry="28" fill="none" stroke="url(#courtLineGrad)" strokeWidth="2" />

          {/* Three-point arc — full arc from baseline to baseline */}
          <path
            d="M 160 255 Q 160 40 400 40 Q 640 40 640 255"
            fill="none"
            stroke="url(#courtLineGrad)"
            strokeWidth="2"
          />

          {/* Corner three lines */}
          <line x1="160" y1="200" x2="40" y2="200" stroke="url(#courtLineGrad)" strokeWidth="2" />
          <line x1="640" y1="200" x2="760" y2="200" stroke="url(#courtLineGrad)" strokeWidth="2" />

          {/* Paint / key box */}
          <rect x="290" y="40" width="220" height="105" fill="rgba(249,115,22,0.06)" stroke="url(#courtLineGrad)" strokeWidth="1.5" />

          {/* Free throw circle */}
          <ellipse cx="400" cy="145" rx="60" ry="22" fill="none" stroke="url(#courtLineGrad)" strokeWidth="1.5" />

          {/* Restricted arc */}
          <path d="M 370 255 Q 370 220 400 220 Q 430 220 430 255" fill="none" stroke="url(#courtLineGrad)" strokeWidth="1.5" />

          {/* Basket backboard + rim */}
          <rect x="385" y="40" width="30" height="4" fill="none" stroke="#f97316" strokeWidth="2" strokeOpacity="0.7" />
          <circle cx="400" cy="52" r="8" fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.7" />
        </svg>

        {/* Fade out at top edge into hero background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1c0f05] via-transparent to-transparent" />
      </div>
    </section>
  )
}
