import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Trophy } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-orange-900/20">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Trophy className="h-6 w-6 shrink-0 text-amber-400 sm:h-8 sm:w-8" />
            <h1 className="truncate text-base font-bold text-white sm:text-xl">
              NBA Expansion Draft Simulator
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 sm:py-12">
        <section className="text-center">
          <h2 className="mb-4 text-2xl font-bold text-white sm:text-4xl">
            Simulate Your NBA Expansion Team
          </h2>
          <p className="mx-auto max-w-2xl text-base text-slate-300 sm:text-lg">
            Configure rules, manage protection lists, and draft your expansion
            roster. Export results as text, with contracts, or as a shareable
            image.
          </p>
          <Link href="/runs/new" className="mt-8 inline-block">
            <Button size="lg" className="gap-2 bg-amber-500 hover:bg-amber-600">
              <Plus className="h-5 w-5" />
              Start New Draft Run
            </Button>
          </Link>
        </section>
      </main>
    </div>
  );
}
