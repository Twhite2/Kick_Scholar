import Link from "next/link";
import { MapPin, GraduationCap, Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mono } from "@/components/ui/mono";

export interface InstitutionCardData {
  id: string;
  name: string;
  country: string;
  city: string;
  type: string | null;
  programCount: number;
  /** Scholarships linked to this institution, however they were linked. */
  fundingCount: number;
  verified: boolean;
}

export function InstitutionCard({ institution }: { institution: InstitutionCardData }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/institutions/${institution.id}`}
            className="text-sm font-semibold leading-snug hover:text-kick-blue hover:underline"
          >
            {institution.name}
          </Link>
          {institution.verified && (
            <Badge variant="secondary" className="shrink-0">
              Verified
            </Badge>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          {institution.city}, {institution.country}
          {institution.type ? ` · ${institution.type.toLowerCase()}` : ""}
        </p>

        <div className="mt-auto flex items-center gap-4 pt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <GraduationCap className="size-3.5" />
            <Mono>{institution.programCount}</Mono>
            {institution.programCount === 1 ? "programme" : "programmes"}
          </span>
          <span className="flex items-center gap-1.5">
            <Award className="size-3.5" />
            <Mono>{institution.fundingCount}</Mono>
            {institution.fundingCount === 1 ? "scholarship" : "scholarships"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
