import { describe, it, expect } from "vitest";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { sourceDocumentIdToFilename, extractionFilePath, EXTRACTED_DIR } from "../paths";

describe("sourceDocumentIdToFilename", () => {
  it("substitutes the colon that Windows forbids in filenames", () => {
    expect(sourceDocumentIdToFilename("src-x:abc123")).toBe("src-x_abc123.json");
  });

  it("leaves an already-safe id alone apart from the extension", () => {
    expect(sourceDocumentIdToFilename("src-x_abc123")).toBe("src-x_abc123.json");
  });

  it("resolves under the source's own directory", () => {
    const p = extractionFilePath("src-x", "src-x:abc123");
    expect(p).toBe(path.join(EXTRACTED_DIR, "src-x", "src-x_abc123.json"));
  });
});

describe("extraction files actually on disk", () => {
  // The regression this guards: ManualExtractor built `${sourceDocumentId}.json`
  // (with a colon) while every real file uses `_`, so it silently returned null
  // for all of them. Derive the expected name from each file's own declared
  // sourceDocumentId and assert it matches the name it is stored under.
  it("are each reachable from their own sourceDocumentId", async () => {
    const sourceDirs = (await readdir(EXTRACTED_DIR, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    let checked = 0;
    for (const sourceId of sourceDirs) {
      const dir = path.join(EXTRACTED_DIR, sourceId);
      for (const file of await readdir(dir)) {
        if (!file.endsWith(".json")) continue;
        const raw = await import(`node:fs/promises`).then((fs) =>
          fs.readFile(path.join(dir, file), "utf-8"),
        );
        const { sourceDocumentId } = JSON.parse(raw) as { sourceDocumentId: string };
        expect(extractionFilePath(sourceId, sourceDocumentId)).toBe(path.join(dir, file));
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0); // fixtures must exist for this to mean anything
  });
});
