import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { coverRejection, processCover, processLogo } from "../process";

const image = (width: number, height: number, background = { r: 30, g: 90, b: 160, alpha: 1 }) =>
  sharp({ create: { width, height, channels: 4, background } }).png().toBuffer();

describe("cover rules", () => {
  const ok = { mime: "image/jpeg", width: 2400, height: 1600, title: "File:Main building.jpg" };
  it("accepts a wide campus photo", () => {
    expect(coverRejection(ok)).toBeNull();
  });
  it("rejects portraits, small images, odd types and logo-like files", () => {
    expect(coverRejection({ ...ok, width: 1200, height: 1600 })).toMatch(/portrait/);
    expect(coverRejection({ ...ok, width: 640, height: 400 })).toMatch(/too small/);
    expect(coverRejection({ ...ok, mime: "image/svg+xml" })).toMatch(/unsupported/);
    expect(coverRejection({ ...ok, title: "File:University seal.png" })).toMatch(/logo/);
    expect(coverRejection({ ...ok, description: "Locator map of the campus" })).toMatch(/logo/);
  });
});

describe("processing", () => {
  it("makes square logos at 256 and 128", async () => {
    const { w256, w128 } = await processLogo(await image(400, 120));
    expect((await sharp(w256).metadata()).width).toBe(256);
    expect((await sharp(w256).metadata()).height).toBe(256);
    expect((await sharp(w128).metadata()).width).toBe(128);
  });

  it("crops covers to 16:9 without upscaling and finds the average colour", async () => {
    const { variants, color } = await processCover(await image(1000, 700));
    expect(variants.map((v) => v.width)).toEqual([640, 1000]);
    for (const v of variants) expect(Math.abs(v.width / v.height - 16 / 9)).toBeLessThan(0.01);
    expect(color).toBe("#1E5AA0");
  });
});
