import { describe, expect, it } from "vitest";
import { searchTarget } from "../shared";
import { matchRank, rankByName } from "../suggest";

describe("matchRank", () => {
  it("prefers exact, then starts-with, then word-start, then contains", () => {
    expect(matchRank("Computer Science", "computer science")).toBe(0);
    expect(matchRank("Computer Science", "comp")).toBe(1);
    expect(matchRank("Applied Computer Science", "comp")).toBe(2);
    expect(matchRank("Biocomputing", "comp")).toBe(3);
    // Found through the university's name, not the programme's.
    expect(matchRank("Marine Engineering", "helsinki")).toBe(4);
  });

  it("ignores accents and treats punctuation as a word break", () => {
    expect(matchRank("Université Paris Cité", "universite")).toBe(1);
    expect(matchRank("Master Sciences de l'éducation", "education")).toBe(2);
  });

  it("treats the query as text, not a pattern", () => {
    expect(matchRank("C++ Programming", "c++")).toBe(1);
    expect(matchRank("Data (Science)", "(science")).toBe(2);
  });
});

describe("rankByName", () => {
  it("orders by match, then shorter names, and drops duplicates", () => {
    const rows = [
      { id: "1", name: "Applied Physics" },
      { id: "2", name: "Physics and Astronomy" },
      { id: "3", name: "Physics" },
      { id: "2", name: "Physics and Astronomy" },
      { id: "4", name: "Biophysics" },
    ];
    expect(rankByName(rows, "physics", 4).map((r) => r.id)).toEqual(["3", "2", "1", "4"]);
    expect(rankByName(rows, "physics", 2)).toHaveLength(2);
  });
});

describe("searchTarget", () => {
  it("searches the catalogue of the section the student is in", () => {
    expect(searchTarget("/scholarships/abc", "DAAD")).toBe("/scholarships?q=DAAD");
    expect(searchTarget("/institutions", "Helsinki")).toBe("/institutions?q=Helsinki");
    expect(searchTarget("/dashboard", "data science")).toBe("/programs?q=data%20science");
    expect(searchTarget("/plan", "  ")).toBe("/programs");
  });
});
