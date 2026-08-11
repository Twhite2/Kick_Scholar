import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Mono } from "@/components/ui/mono";
import { MatchStrengthBadge } from "@/components/eligibility/match-strength-badge";
import { OfficialVsExternalBadge } from "./official-vs-external-badge";
import { FundingCoverageViz } from "./funding-coverage-viz";
import { SaveButton } from "@/components/programs/save-button";
import type { MatchStrength } from "@/lib/generated/prisma/enums";

export interface ScholarshipCardData {
  id: string;
  name: string;
  providerName: string;
  country: string | null;
  coverageType: string;
  amount: number | null;
  amountCurrency: string | null;
  deadlineText: string | null;
  verified: boolean;
  match: { score: number; matchStrength: MatchStrength } | null;
  saved: boolean;
}

export function ScholarshipCard({ scholarship }: { scholarship: ScholarshipCardData }) {
  return (
    <Card className="group relative flex h-full flex-col transition-shadow hover:shadow-md">
      <div className="absolute top-3 right-3 z-10">
        <SaveButton targetType="scholarship" targetId={scholarship.id} initialSaved={scholarship.saved} />
      </div>
      <Link href={`/scholarships/${scholarship.id}`} className="flex flex-1 flex-col">
        <CardContent className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-1.5 pr-8">
            {scholarship.match && <MatchStrengthBadge strength={scholarship.match.matchStrength} />}
            <OfficialVsExternalBadge verified={scholarship.verified} />
          </div>
          <div>
            <h3 className="font-semibold leading-snug">{scholarship.name}</h3>
            <p className="text-sm text-muted-foreground">{scholarship.providerName}</p>
          </div>

          <FundingCoverageViz coverageType={scholarship.coverageType} />

          <div className="mt-auto flex items-center justify-between pt-2">
            <Badge variant="outline">{scholarship.country ?? "Multiple countries"}</Badge>
            {scholarship.amount && (
              <Mono className="text-sm font-medium">
                {scholarship.amount.toLocaleString()} {scholarship.amountCurrency}
              </Mono>
            )}
          </div>

          {scholarship.match && (
            <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">Match score</span>
              <Mono className="text-sm font-semibold text-kick-blue">{scholarship.match.score}%</Mono>
            </div>
          )}
        </CardContent>
      </Link>
    </Card>
  );
}
