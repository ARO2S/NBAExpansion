"use client"

import { ArrowUpRight } from "lucide-react"
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
        {/* LEFT COLUMN */}
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

        {/* RIGHT COLUMN — glass card stack (added in Task 5) */}
        <div className="relative h-[420px] opacity-0 animate-slide-from-right hidden md:block">
          {/* placeholder */}
        </div>
      </div>
    </section>
  )
}
