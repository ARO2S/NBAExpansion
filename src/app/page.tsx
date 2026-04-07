import { Hero } from "@/components/ui/hero-1";

export default function HomePage() {
  return (
    <Hero
      eyebrow="NBA Expansion Draft Simulator"
      title="Build Your Expansion Team"
      subtitle="Configure rules, protect your players, and draft your franchise roster. Export results as text, with contracts, or as a shareable image."
      ctaLabel="Start New Draft Run"
      ctaHref="/runs/new"
    />
  );
}
