import { describe, expect, it } from "vitest";
import { auProgrammes, frProgrammes, nlProgrammes } from "../adapters";
import { parseDelimited } from "../csv";
import { joinModes } from "../loadRegister";
import { resolveLocally, hostOf } from "../resolveInstitution";

// Each register's real column layout, cut down to a few rows (downloaded 12 Nov 2026).
const NL_HEADER =
  '"BEVOEGD_GEZAG_NAAM","INSTELLINGSCODE","INSTELLINGSNAAM","PLAATSNAAM","INSTROOM_EINDDATUM","OPLEIDINGSEENHEIDCODE","OPLEIDINGSEENHEID_NAAM","OPLEIDINGSEENHEID_INTERNATIONALE_NAAM","OPLEIDINGSEENHEID_SOORT","STUDIELAST","STUDIELASTEENHEID","NIVEAU","VORM","STATUS"';
const nlRow = (o: Partial<Record<string, string>>) =>
  [
    o.gezag ?? "Stichting Universiteit van Amsterdam",
    o.code ?? "21PK",
    o.inst ?? "Universiteit van Amsterdam",
    "AMSTERDAM",
    o.instroomEind ?? "",
    o.prog ?? "1001",
    o.dutch ?? "Informatica",
    o.english ?? "Computer Science",
    "OPLEIDING",
    o.ects ?? "120",
    "ECTS_PUNT",
    o.level ?? "WO-MA",
    o.form ?? "VOLTIJD",
    o.status ?? "ACTUEEL",
  ]
    .map((v) => `"${v}"`)
    .join(",");

describe("Netherlands (DUO)", () => {
  it("reads current master's with their English name, credits and form", () => {
    const csv = [NL_HEADER, nlRow({}), nlRow({ form: "DEELTIJD" }), nlRow({ level: "WO-BA", prog: "2" }), nlRow({ status: "HISTORISCH", prog: "3" }), nlRow({ instroomEind: "2011-09-01", prog: "4" })].join("\n");
    const programmes = nlProgrammes(csv, new Date("2026-11-12"));
    expect(programmes).toHaveLength(2);
    expect(programmes[0]).toMatchObject({
      name: "Computer Science",
      originalName: "Informatica",
      degreeLevel: "MASTER",
      durationMonths: 24,
      studyMode: "Full-time",
      institution: { name: "Universiteit van Amsterdam", country: "NL", city: "Amsterdam", code: "21PK" },
    });
    expect(programmes[1]).toMatchObject({ studyMode: "Part-time", durationMonths: null });
  });
});

describe("Australia (CRICOS)", () => {
  const courses = [
    "﻿CRICOS Provider Code,Institution Name,CRICOS Course Code,Course Name,Field of Education 1 Broad Field,Field of Education 1 Narrow Field,Course Level,Course Language,Duration (Weeks),Tuition Fee,Expired",
    '00002J,Macquarie University (Macquarie),012345A,Master of Data Science,02 - Information Technology,0201 - Computer Science,Masters Degree (Coursework),English,104,"$90,000.00",No',
    "00002J,Macquarie University (Macquarie),012346B,Bachelor of Arts,09 - Society and Culture,0901 - Political Science,Bachelor Degree,English,156,$1.00,No",
    "00002J,Macquarie University (Macquarie),012347C,Doctor of Philosophy,02 - Information Technology,0201 - Computer Science,Doctoral Degree,English,156,$0.00,No",
    "00002J,Macquarie University (Macquarie),012348D,Master of Old Things,02 - Information Technology,0201 - Computer Science,Masters Degree (Coursework),English,52,$1.00,Yes",
  ].join("\n");
  const institutions = "CRICOS Provider Code,Trading Name,Institution Name,Website,Postal Address City\n00002J,Macquarie University,Macquarie University (Macquarie),www.mq.edu.au,MACQUARIE UNIVERSITY";

  it("reads master's and doctorates with the stated fee, length and language", () => {
    const programmes = auProgrammes(courses, institutions);
    expect(programmes.map((p) => [p.name, p.degreeLevel])).toEqual([
      ["Master of Data Science", "MASTER"],
      ["Doctor of Philosophy", "PHD"],
    ]);
    expect(programmes[0]).toMatchObject({
      durationMonths: 24,
      instructionLanguages: ["English"],
      tuition: { amount: 90000, currency: "AUD", period: "PER_PROGRAM" },
      fieldOfStudy: "Computer Science",
      institution: { name: "Macquarie University", website: "www.mq.edu.au", country: "AU" },
    });
    expect(programmes[1].tuition).toBeNull();
  });
});

describe("France (Mon Master)", () => {
  const csv = [
    "session,eta_uai,eta_nom,inmp,ifc,mention,parcours,lieux,disci_lib",
    "2024,0751723R,Université Paris Cité,P1,F1,BIO-INFORMATIQUE,Ancien parcours,Université Paris Cité - PARIS (75),Sciences de la vie",
    "2025,0751723R,Université Paris Cité,P2,F2,SCIENCES DE L'EDUCATION ET DE LA FORMATION,Ingénierie pédagogique,Université Paris Cité - PARIS (75),Sciences humaines",
  ].join("\n");

  it("reads the latest session only, in sentence case, and says the language is not stated", () => {
    const programmes = frProgrammes(csv);
    expect(programmes).toHaveLength(1);
    expect(programmes[0]).toMatchObject({
      name: "Master Sciences de l'education et de la formation: Ingénierie pédagogique",
      institution: { name: "Université Paris Cité", city: "Paris", code: "0751723R" },
      degreeLevel: "MASTER",
    });
    expect(programmes[0].instructionLanguages).toBeUndefined();
    expect(programmes[0].facts).toMatch(/does not state the teaching language/);
  });
});

describe("shared pieces", () => {
  it("parses semicolon files and a byte-order mark", () => {
    expect(parseDelimited("﻿a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("joins forms of study", () => {
    expect(joinModes(new Set(["Part-time", "Full-time"]))).toBe("Full-time or part-time");
    expect(joinModes(new Set(["Full-time"]))).toBe("Full-time");
    expect(joinModes(new Set(["Full-time", "Work and study (dual)"]))).toBe("Full-time or work and study (dual)");
    expect(joinModes(new Set())).toBeNull();
  });

  it("matches an institution by website or exact name in its country", () => {
    const index = { byHost: new Map([["mq.edu.au", "u-mq"]]), byName: new Map([["universiteit van amsterdam|NL", "u-uva"]]) };
    expect(resolveLocally({ name: "Macquarie", country: "AU", website: "https://www.mq.edu.au/" }, index)).toBe("u-mq");
    expect(resolveLocally({ name: "Universiteit van Amsterdam", country: "NL" }, index)).toBe("u-uva");
    expect(resolveLocally({ name: "Universiteit van Amsterdam", country: "BE" }, index)).toBeNull();
    expect(hostOf("www2.example.edu")).toBe("example.edu");
  });
});
