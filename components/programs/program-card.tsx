import Link from "next/link";
import { MapPin, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mono } from "@/components/ui/mono";
import { MatchStrengthBadge } from "@/components/eligibility/match-strength-badge";
import { SaveButton } from "./save-button";
import type { MatchStrength } from "@/lib/generated/prisma/enums";

export interface ProgramCardData {
  id: string;
  name: string;
  degreeLevel: string;
  fieldOfStudy: string;
  durationMonths: number | null;
  tuitionType: string;
  tuitionAmount: number | null;
  tuitionCurrency: string | null;
  university: { name: string; country: string; city: string };
  match: { score: number; matchStrength: MatchStrength } | null;
  saved: boolean;
}

function tuitionLabel(program: ProgramCardData) {
  if (program.tuitionType === "FREE") return "Free";
  if (program.tuitionType === "PAID" && program.tuitionAmount) {
    return `${program.tuitionAmount.toLocaleString()} ${program.tuitionCurrency ?? ""}/yr`;
  }
  if (program.tuitionType === "VARIES") return "Varies";
  return "Unknown";
}

export function ProgramCard({ program }: { program: ProgramCardData }) {
  return (
    <Card className="group relative flex h-full flex-col transition-shadow hover:shadow-md">
      <div className="absolute top-3 right-3 z-10">
        <SaveButton targetType="program" targetId={program.id} initialSaved={program.saved} />
      </div>
      <Link href={`/programs/${program.id}`} className="flex flex-1 flex-col">
        <CardContent className="flex flex-1 flex-col gap-3 p-5">
          <div className="pr-8">
            {program.match && (
              <MatchStrengthBadge strength={program.match.matchStrength} className="mb-2" />
            )}
            <h3 className="font-semibold leading-snug">{program.name}</h3>
            <p className="text-sm text-muted-foreground">{program.university.name}</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {program.university.city}, {program.university.country}
            </span>
            {program.durationMonths && (
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" />
                {program.durationMonths} months
              </span>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between pt-2">
            <Badge variant="outline">{program.degreeLevel.replace("_", " ")}</Badge>
            <Mono
              className={`text-sm font-medium ${program.tuitionType === "FREE" ? "text-success" : "text-foreground"}`}
            >
              {tuitionLabel(program)}
            </Mono>
          </div>

          {program.match && (
            <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">Match score</span>
              <Mono className="text-sm font-semibold text-kick-blue">{program.match.score}%</Mono>
            </div>
          )}
        </CardContent>
      </Link>
    </Card>
  );
}
