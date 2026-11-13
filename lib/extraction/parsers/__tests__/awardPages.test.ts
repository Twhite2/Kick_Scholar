import { describe, expect, it } from "vitest";
import { isAwardPage } from "../index";
import { isGenericScholarshipName } from "@/lib/deduplication/matchCandidates";

// Real URLs from the crawls of 31 Oct 2026.
describe("isAwardPage", () => {
  it("keeps each source's award pages", () => {
    expect(isAwardPage("src-chevening", "https://www.chevening.org/scholarships/")).toBe(true);
    expect(isAwardPage("src-chevening", "https://www.chevening.org/fellowship/lse/")).toBe(true);
    expect(isAwardPage("src-commonwealth", "https://cscuk.fcdo.gov.uk/scholarships/commonwealth-masters-scholarships/")).toBe(true);
    expect(isAwardPage("src-commonwealth", "https://cscuk.fcdo.gov.uk/scholarships/commonwealth-shared-scholarships-applications/")).toBe(true);
    expect(isAwardPage("src-commonwealth", "https://cscuk.fcdo.gov.uk/apply/commonwealth-professional-fellowships/")).toBe(true);
    expect(isAwardPage("src-mext", "https://www.studyinjapan.go.jp/en/planning/scholarships/mext-scholarships/")).toBe(true);
    expect(isAwardPage("src-turkiye-burslari", "https://www.turkiyeburslari.gov.tr/fulltimeprograms")).toBe(true);
    expect(
      isAwardPage(
        "src-turkiye-burslari",
        "https://www.turkiyeburslari.gov.tr/announcements/ytb-islamic-development-bank-isdb-joint-scholarship-program-2026-applicaiton-period-122",
      ),
    ).toBe(true);
  });

  it("drops the pages around them", () => {
    expect(isAwardPage("src-chevening", "https://www.chevening.org/scholarships/find-a-course/")).toBe(false);
    expect(isAwardPage("src-chevening", "https://www.chevening.org/scholarship/nigeria/")).toBe(false);
    expect(isAwardPage("src-chevening", "https://www.chevening.org/fellowships/who-can-apply/")).toBe(false);
    expect(isAwardPage("src-commonwealth", "https://cscuk.fcdo.gov.uk/about-us/")).toBe(false);
    expect(
      isAwardPage("src-commonwealth", "https://cscuk.fcdo.gov.uk/scholarships/commonwealth-professional-fellowships-information-for-uk-host-organisations/"),
    ).toBe(false);
    expect(isAwardPage("src-mext", "https://www.studyinjapan.go.jp/en/life/accomodation/")).toBe(false);
    expect(isAwardPage("src-turkiye-burslari", "https://www.turkiyeburslari.gov.tr/Calender")).toBe(false);
    expect(isAwardPage("src-turkiye-burslari", "https://www.turkiyeburslari.gov.tr/announcements/turkiye-scholarships-2026-applications-121")).toBe(false);
  });

  it("allows every page of a source without a list", () => {
    expect(isAwardPage("src-daad", "https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/?detail=10000092")).toBe(true);
  });
});

describe("isGenericScholarshipName", () => {
  it("flags names that say nothing about the award", () => {
    expect(isGenericScholarshipName("Scholarships")).toBe(true);
    expect(isGenericScholarshipName(" Fellowships ")).toBe(true);
    expect(isGenericScholarshipName("Chevening Scholarships")).toBe(false);
    expect(isGenericScholarshipName("Japanese Government (MEXT) Scholarship: Research Students")).toBe(false);
  });
});
