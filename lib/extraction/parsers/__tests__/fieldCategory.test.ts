import { describe, it, expect } from "vitest";
import { inferFieldCategory } from "../fieldCategory";

describe("inferFieldCategory", () => {
  it("classifies obvious subjects", () => {
    expect(inferFieldCategory("MBA in Global Management")).toBe("BUSINESS");
    expect(inferFieldCategory("Cognitive Science (MSc)")).toBe("STEM");
    expect(inferFieldCategory("Embedded Computing Systems (ESY)")).toBe("STEM");
    expect(inferFieldCategory("International Health Law")).toBeTruthy();
  });

  it("ignores the degree designation when classifying the field", () => {
    // Regression: this returned ARTS because of "Bachelor of Arts", not the
    // subject. A confidently wrong category is worse than none, because the
    // matching engine trusts it.
    expect(inferFieldCategory("Bachelor of Arts in European Studies")).not.toBe("ARTS");
    expect(inferFieldCategory("Master of Science in Robotics")).toBe("STEM");
  });

  it("still classifies genuine arts programmes", () => {
    expect(inferFieldCategory("Fine Art and Media")).toBe("ARTS");
    expect(inferFieldCategory("Architecture")).toBe("ARTS");
  });

  it("returns null rather than guessing when nothing matches", () => {
    expect(inferFieldCategory("Programme 2026/2027")).toBeNull();
  });
});
