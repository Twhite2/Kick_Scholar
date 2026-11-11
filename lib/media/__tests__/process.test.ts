import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { coverRejection, logoAspect, MAX_LOGO_ASPECT, processCover, processLogo } from "../process";

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

  it("measures what a logo draws, not its padding", async () => {
    // A 400 x 100 wordmark centred on a white 600 x 600 canvas is 4:1.
    const wordmark = await sharp({ create: { width: 600, height: 600, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .composite([{ input: await image(400, 100), top: 250, left: 100 }])
      .png()
      .toBuffer();
    expect(await logoAspect(wordmark)).toBeCloseTo(4, 1);
    expect(await logoAspect(await image(200, 200))).toBeCloseTo(1, 1);
    // The stored square tile still measures as the wordmark it holds.
    expect(await logoAspect((await processLogo(wordmark)).w256)).toBeGreaterThan(MAX_LOGO_ASPECT);
  });

  it("crops covers to 16:9 without upscaling and finds the average colour", async () => {
    const { variants, color } = await processCover(await image(1000, 700));
    expect(variants.map((v) => v.width)).toEqual([640, 1000]);
    for (const v of variants) expect(Math.abs(v.width / v.height - 16 / 9)).toBeLessThan(0.01);
    expect(color).toBe("#1E5AA0");
  });
});
