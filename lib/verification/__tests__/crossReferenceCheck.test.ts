import { describe, it, expect } from "vitest";
import { findIndependentCorroboration } from "../crossReferenceCheck";

const cite = (sourceId: string, authorityLevel: "PRIMARY" | "SECONDARY" | "DISCOVERY") => ({
  sourceId,
  source: { authorityLevel },
});

describe("findIndependentCorroboration", () => {
  it("does not let a record corroborate itself", () => {
    // A SECONDARY source reloaded twice used to verify its own records.
    const citations = [cite("src-studyinfo", "SECONDARY"), cite("src-studyinfo", "SECONDARY")];
    expect(findIndependentCorroboration(citations, "src-studyinfo")).toBeNull();
  });

  it("accepts a different PRIMARY source", () => {
    const citations = [cite("src-bright-scholarship", "DISCOVERY"), cite("src-daad", "PRIMARY")];
    expect(findIndependentCorroboration(citations, "src-bright-scholarship")?.sourceId).toBe("src-daad");
  });

  it("accepts a different SECONDARY source", () => {
    const citations = [cite("src-tu-berlin", "PRIMARY"), cite("src-ror", "SECONDARY")];
    expect(findIndependentCorroboration(citations, "src-tu-berlin")?.sourceId).toBe("src-ror");
  });

  it("never counts DISCOVERY sources, even several of them", () => {
    const citations = [
      cite("src-bright-scholarship", "DISCOVERY"),
      cite("src-iammagnus", "DISCOVERY"),
    ];
    expect(findIndependentCorroboration(citations, "src-bright-scholarship")).toBeNull();
  });
});
