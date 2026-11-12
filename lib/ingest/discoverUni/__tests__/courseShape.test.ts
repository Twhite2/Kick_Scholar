import { describe, it, expect } from "vitest";
import { courseShape, degreeLevelFromAward, mergeModes } from "../importDiscoverUni";

describe("degreeLevelFromAward", () => {
  it("files integrated master's and Scottish MAs as first degrees", () => {
    for (const award of ["MEng", "MSci", "MPhys", "MA", "MA(SocSci)", "MPharm"]) expect(degreeLevelFromAward(award)).toBe("BACHELOR");
    expect(degreeLevelFromAward("BSc")).toBe("BACHELOR");
    expect(degreeLevelFromAward("MBChB")).toBe("BACHELOR");
    expect(degreeLevelFromAward("HND")).toBe("DIPLOMA");
    expect(degreeLevelFromAward("PhD")).toBe("PHD");
  });
});

describe("courseShape", () => {
  it("reads the zero-padded KISMODE codes the release ships", () => {
    expect(courseShape({ KISMODE: "01", NUMSTAGE: "3" })).toEqual({ studyMode: "Full-time", durationMonths: 36 });
    expect(courseShape({ KISMODE: "02", NUMSTAGE: "6" })).toEqual({ studyMode: "Part-time", durationMonths: null });
    expect(courseShape({ KISMODE: "03", NUMSTAGE: "4" })).toEqual({ studyMode: "Full-time or part-time", durationMonths: 48 });
  });

  it("accepts unpadded codes too", () => {
    expect(courseShape({ KISMODE: "1", NUMSTAGE: "1" })).toEqual({ studyMode: "Full-time", durationMonths: 12 });
  });

  it("claims nothing for a missing or odd value", () => {
    expect(courseShape({ KISMODE: "", NUMSTAGE: "3" })).toEqual({ studyMode: null, durationMonths: null });
    expect(courseShape({ KISMODE: "01", NUMSTAGE: "0" })).toEqual({ studyMode: "Full-time", durationMonths: null });
    expect(courseShape({ KISMODE: "01", NUMSTAGE: "x" })).toEqual({ studyMode: "Full-time", durationMonths: null });
  });
});

describe("mergeModes", () => {
  it("joins a full-time and a part-time row into one course", () => {
    expect(mergeModes("Full-time", "Part-time")).toBe("Full-time or part-time");
    expect(mergeModes("Full-time", "Full-time")).toBe("Full-time");
    expect(mergeModes(null, "Part-time")).toBe("Part-time");
  });
});
