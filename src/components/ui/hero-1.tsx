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
        <div className="flex flex-col gap-6 animate-slide-from-left">
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

        {/* RIGHT COLUMN — glass card stack */}
        <div className="relative h-[460px] animate-slide-from-right hidden md:block">

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
              {[30, 55, 80, 105, 130, 155, 180].map((y) => (
                <line key={y} x1="0" y1={y} x2="360" y2={y} stroke="#92400e" strokeWidth="0.6" strokeOpacity="0.35" />
              ))}
              <rect x="120" y="20" width="120" height="120" fill="rgba(255,138,0,0.05)" stroke="rgba(255,138,0,0.4)" strokeWidth="1.5" rx="2" />
              <ellipse cx="180" cy="140" rx="50" ry="22" fill="none" stroke="rgba(255,138,0,0.4)" strokeWidth="1.5" />
              <line x1="20" y1="178" x2="340" y2="178" stroke="rgba(255,138,0,0.5)" strokeWidth="1.5" />
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
              {[20, 50, 80, 110].map((y) => (
                <line key={y} x1="30" y1={y} x2="295" y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              ))}
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
              <text x="8" y="115" fill="#64748b" fontSize="7" fontFamily="sans-serif">0</text>
              <text x="8" y="45" fill="#64748b" fontSize="7" fontFamily="sans-serif">50</text>
            </svg>
          </div>

          {/* TOP CARD — basketball placeholder */}
          <div
            className="glass-card absolute top-0 right-0 w-40 h-40 flex flex-col items-center justify-center gap-2 animate-float-medium"
            style={{ zIndex: 3 }}
          >
            <div
              className="relative w-24 h-24 rounded-full border-2 border-[#FF8A00]/60 flex items-center justify-center"
              style={{ background: "radial-gradient(circle at 40% 35%, #b45309, #7c2d12)" }}
            >
              <svg viewBox="0 0 96 96" className="absolute w-24 h-24" aria-hidden="true">
                <path d="M 48 4 Q 20 48 48 92" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" />
                <path d="M 48 4 Q 76 48 48 92" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" />
                <path d="M 4 48 Q 48 20 92 48" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" />
              </svg>
            </div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-inter">Player Image</span>
          </div>

        </div>
      </div>
    </section>
  )
}
