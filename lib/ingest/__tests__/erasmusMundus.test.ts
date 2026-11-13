import { describe, expect, it } from "vitest";
import { countryCode, hostOf, organisationsOf, parseDelimited, projectColumns, projectNumberOf, resolveOrganisation } from "../../../scripts/import-erasmus-mundus";

// The Commission's "Projects Overview" layout: a project number, the
// coordinating organisation, then numbered partners.
const HEADERS = [
  "Project Identifier",
  "Project Title",
  "Coordinating organisation name",
  "Coordinator's country",
  "Coordinator's website",
  "Partner 1 name",
  "Partner 1 country",
  "Partner 1 website",
  "Partner 2 name",
  "Partner 2 country",
  "Partner 2 website",
];

describe("reading the project lists", () => {
  it("parses comma and semicolon files, quotes included", () => {
    expect(parseDelimited('a,b\n"x, y",z\n')).toEqual([["a", "b"], ["x, y", "z"]]);
    expect(parseDelimited('a;b\r\n"say ""hi""";2')).toEqual([["a", "b"], ['say "hi"', "2"]]);
  });

  it("finds the columns by their wording and reads the consortium", () => {
    const cols = projectColumns(HEADERS)!;
    expect(cols.partners.map((p) => p.n)).toEqual([1, 2]);
    const row = ["101082651", "HySET", "Politecnico di Torino", "Italy", "https://www.polito.it", "KTH Royal Institute of Technology", "SE", "www.kth.se", "", "", ""];
    expect(organisationsOf(row, cols)).toEqual([
      { role: "coordinator", name: "Politecnico di Torino", country: "IT", website: "https://www.polito.it" },
      { role: "partner", name: "KTH Royal Institute of Technology", country: "SE", website: "www.kth.se" },
    ]);
  });

  it("refuses a file without a project number or coordinator", () => {
    expect(projectColumns(["Title", "Summary"])).toBeNull();
  });

  it("takes the project number from the catalogue's link", () => {
    expect(projectNumberOf("https://erasmus-plus.ec.europa.eu/projects/search/details/101082651")).toBe("101082651");
    expect(projectNumberOf("https://example.org/")).toBeNull();
  });
});

describe("resolving organisations", () => {
  it("normalises countries and hosts", () => {
    expect(countryCode("Italy")).toBe("IT");
    expect(countryCode("EL")).toBe("GR");
    expect(countryCode("Czech Republic")).toBe("CZ");
    expect(hostOf("https://www.unibo.it/en/homepage")).toBe("unibo.it");
    expect(hostOf("www.kth.se")).toBe("kth.se");
  });

  it("matches by website, including subdomains, else by exact name in the country", () => {
    const index = { byHost: new Map([["unibo.it", "u-bologna"]]), byName: new Map([["kth royal institute of technology|SE", "u-kth"]]) };
    expect(resolveOrganisation({ role: "partner", name: "Alma Mater Studiorum", country: "IT", website: "https://www.en.unibo.it" }, index)).toBe("u-bologna");
    expect(resolveOrganisation({ role: "partner", name: "KTH Royal Institute of Technology", country: "SE", website: null }, index)).toBe("u-kth");
    expect(resolveOrganisation({ role: "partner", name: "KTH Royal Institute of Technology", country: "NO", website: null }, index)).toBeNull();
  });
});
