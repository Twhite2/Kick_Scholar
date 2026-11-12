import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deadlineWhereFor, intakeLabel } from "@/lib/deadlines/applicant-group";
import { getApplicantGroup } from "@/lib/deadlines/viewer-group";
import { LISTED_SCHOLARSHIP } from "@/lib/scholarships/listed";

/**
 * The deadlines of everything a student has saved or is tracking, as an
 * iCalendar feed they can import (docs/ui-remodel.md §9.1.6). Only dated
 * deadlines are included; text-only ones ("rolling") can't be put on a
 * calendar honestly.
 */

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** iCalendar lines are folded at 75 octets. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

const day = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Sign in to download your deadlines.", { status: 401 });
  const userId = session.user.id;

  const [saved, tracked, applicantGroup] = await Promise.all([
    prisma.savedOpportunity.findMany({ where: { userId }, select: { programId: true, scholarshipId: true } }),
    prisma.application.findMany({ where: { userId }, select: { programId: true, scholarshipId: true } }),
    // EU-only or non-EU-only dates that are not this student's stay off their calendar.
    getApplicantGroup(userId),
  ]);
  const programIds = [...new Set([...saved, ...tracked].flatMap((r) => (r.programId ? [r.programId] : [])))];
  const scholarshipIds = [...new Set([...saved, ...tracked].flatMap((r) => (r.scholarshipId ? [r.scholarshipId] : [])))];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const deadlines =
    programIds.length + scholarshipIds.length === 0
      ? []
      : await prisma.applicationDeadline.findMany({
          where: {
            date: { gte: today },
            AND: [deadlineWhereFor(applicantGroup)],
            OR: [
              ...(programIds.length ? [{ programId: { in: programIds } }] : []),
              ...(scholarshipIds.length ? [{ scholarshipId: { in: scholarshipIds }, scholarship: LISTED_SCHOLARSHIP }] : []),
            ],
          },
          select: {
            id: true,
            date: true,
            intake: true,
            program: { select: { id: true, name: true, university: { select: { name: true } } } },
            scholarship: { select: { id: true, name: true, providerName: true } },
          },
          orderBy: { date: "asc" },
        });

  const origin = new URL(request.url).origin;
  const stamp = `${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//KickScholar//Deadlines//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:KickScholar deadlines"];
  for (const d of deadlines) {
    if (!d.date) continue;
    const intake = intakeLabel(d.intake);
    const title = `${d.program ? `${d.program.name} (${d.program.university.name})` : `${d.scholarship?.name} (${d.scholarship?.providerName})`}${intake ? `, ${intake}` : ""}`;
    const url = d.program ? `${origin}/programs/${d.program.id}` : `${origin}/scholarships/${d.scholarship?.id}`;
    const end = new Date(d.date.getTime() + 86_400_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${d.id}@kickscholar`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day(d.date)}`,
      `DTEND;VALUE=DATE:${day(end)}`,
      fold(`SUMMARY:${escape(`Deadline: ${title}`)}`),
      fold(`URL:${url}`),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");

  return new Response(`${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kickscholar-deadlines.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
