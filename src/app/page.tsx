"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trophy } from "lucide-react";

interface DraftRun {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

export default function HomePage() {
  const [runs, setRuns] = useState<DraftRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((data) => setRuns(data.runs ?? []))
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-orange-900/20">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-8 w-8 text-amber-400" />
            <h1 className="text-xl font-bold text-white">
              NBA Expansion Draft Simulator
            </h1>
          </div>
          <Link href="/admin">
            <Button variant="outline" size="sm" className="border-white/20 bg-transparent text-white hover:bg-white/10">
              Admin
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <section className="mb-12 text-center">
          <h2 className="mb-4 text-4xl font-bold text-white">
            Simulate Your NBA Expansion Team
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-300">
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

        <section>
          <h3 className="mb-4 text-xl font-semibold text-white">
            Recent Draft Runs
          </h3>
          {loading ? (
            <p className="text-slate-400">Loading...</p>
          ) : runs.length === 0 ? (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="pt-6">
                <p className="text-slate-400">
                  No draft runs yet. Start a new one to get began!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {runs.map((run) => (
                <Link key={run.id} href={`/runs/${run.id}/protect`}>
                  <Card className="cursor-pointer border-white/10 bg-white/5 transition hover:bg-white/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg text-white">
                        {run.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-400">
                        Status: {run.status} •{" "}
                        {new Date(run.createdAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
