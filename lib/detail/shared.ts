import { cache } from "react";
import { prisma } from "@/lib/db";
import type { ProfileForComparison } from "@/lib/ui/requirements";

/** The student's profile in the shape detail pages compare against. */
export const getComparisonProfile = cache(async (userId: string): Promise<ProfileForComparison | null> => {
  const p = await prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      nationality: true,
      currentEducationLevel: true,
      fieldOfStudy: true,
      currentGpa: true,
      gpaScale: true,
      workExperienceMonths: true,
      financialNeedSelfReported: true,
      languageProficiencies: { select: { testName: true, score: true, cefrLevel: true } },
    },
  });
  return p;
});

const MONTH = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;

/**
 * Deadline text worth showing. Extraction stores headings and fragments in
 * dateText ("The following is valid for applicants from: all countries"),
 * which say nothing about dates; only text that names a date, a month or an
 * explicit "no deadline / rolling" is kept. Markdown emphasis is stripped.
 */
export function usefulDeadlineText(text: string | null | undefined): string | null {
  if (!text) return null;
  const clean = text.replace(/\*+/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  if (/\d/.test(clean) && MONTH.test(clean)) return clean;
  if (/no (application )?deadline|rolling|all year|any time|anytime/i.test(clean)) return clean;
  return null;
}

/** "German English" (a scraping quirk) and "English, German" both become a list. */
export function splitLanguages(values: string[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    for (const part of v.split(/[\s,/;]+|\band\b/i)) {
      const t = part.trim();
      if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t.charAt(0).toUpperCase() + t.slice(1));
    }
  }
  return out;
}

export function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function capitalise(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export const DEADLINE_LABEL: Record<string, string> = {
  APPLICATION: "Application deadline",
  DOCUMENT_SUBMISSION: "Documents due",
  SCHOLARSHIP_APPLICATION: "Scholarship deadline",
  DECISION_NOTIFICATION: "Decisions announced",
  ENROLLMENT: "Enrolment",
};
