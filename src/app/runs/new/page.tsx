"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { RULES_PRESETS } from "@/lib/rules-schema";

export default function NewRunPage() {
  const router = useRouter();
  const [name, setName] = useState("My Expansion Draft");
  const [mode, setMode] = useState<"1" | "2" | "custom">("1");
  const expansionCount = mode === "2" ? 2 : 1;
  const effectiveRuleset =
    mode === "custom" ? "custom" : "1995-style";
  const [teamNames, setTeamNames] = useState({
    team1: "Seattle SuperSonics",
    team2: "Las Vegas Aces",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ruleset: effectiveRuleset,
          expansionTeamsCount: expansionCount,
          expansionTeamNames:
            expansionCount === 1
              ? [teamNames.team1]
              : [teamNames.team1, teamNames.team2],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create run");
      router.push(`/runs/${data.runId}/protect`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-white/10 bg-black/20">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link href="/" className="flex items-center gap-2 text-white">
            <ArrowLeft className="h-5 w-5" />
            Back
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-6 sm:py-12">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-2xl text-white">
              Start New Draft Run
            </CardTitle>
            <p className="text-slate-400">
              Choose how many expansion teams, then set protections and draft.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="name" className="text-white">
                  Run Name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 bg-white/5 border-white/10 text-white"
                  required
                />
              </div>

              <div>
                <Label className="text-white">Draft</Label>
                <Select
                  value={mode}
                  onValueChange={(v) => setMode(v as "1" | "2" | "custom")}
                >
                  <SelectTrigger className="mt-1 bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Draft 1 expansion team</SelectItem>
                    <SelectItem value="2">Draft 2 expansion teams</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {mode === "1" && (
                  <p className="mt-1 text-xs text-slate-400">
                    Rules: {RULES_PRESETS["1995-style"].protectLimitPerTeam} protect per team,
                    max {RULES_PRESETS["1995-style"].expansionDraftMaxPicks} picks
                  </p>
                )}
                {mode === "2" && (
                  <p className="mt-1 text-xs text-slate-400">
                    Rules: {RULES_PRESETS["1995-style"].protectLimitPerTeam} protect per team,
                    ~{Math.ceil(RULES_PRESETS["1995-style"].expansionDraftMaxPicks / 2)} picks each
                  </p>
                )}
                {mode === "custom" && (
                  <p className="mt-1 text-xs text-slate-400">
                    Custom rules (editing coming soon)
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="team1" className="text-white">
                  Expansion Team 1 Name
                </Label>
                <Input
                  id="team1"
                  value={teamNames.team1}
                  onChange={(e) =>
                    setTeamNames((t) => ({ ...t, team1: e.target.value }))
                  }
                  className="mt-1 bg-white/5 border-white/10 text-white"
                />
              </div>
              {expansionCount === 2 && (
                <div>
                  <Label htmlFor="team2" className="text-white">
                    Expansion Team 2 Name
                  </Label>
                  <Input
                    id="team2"
                    value={teamNames.team2}
                    onChange={(e) =>
                      setTeamNames((t) => ({ ...t, team2: e.target.value }))
                    }
                    className="mt-1 bg-white/5 border-white/10 text-white"
                  />
                </div>
              )}

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-600"
              >
                {loading ? "Creating..." : "Create Draft Run"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
