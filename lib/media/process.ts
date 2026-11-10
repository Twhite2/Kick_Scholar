import sharp from "sharp";

/**
 * Image processing for institution media (docs/ui-remodel.md §11.3).
 * Logos are only scaled and padded — never recoloured or cropped (§11.5).
 */

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** Square WebP logos at 256 and 128, with 12% padding on transparency. */
export async function processLogo(input: Buffer): Promise<{ w256: Buffer; w128: Buffer }> {
  // Trim uniform borders (white or transparent) so logos sit at a consistent size.
  const trimmed = await sharp(input).trim({ threshold: 12 }).png().toBuffer();
  const inner = 225; // 256 minus 12% padding
  const w256 = await sharp(trimmed)
    .resize({ width: inner, height: inner, fit: "contain", background: TRANSPARENT })
    .extend({ top: 15, bottom: 16, left: 15, right: 16, background: TRANSPARENT })
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer();
  const w128 = await sharp(w256).resize(128, 128).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
  return { w256, w128 };
}

export const COVER_WIDTHS = [640, 1280, 1920] as const;

/** Why a candidate cover photo is not used, or null if it is acceptable. */
export function coverRejection(candidate: {
  mime: string;
  width: number;
  height: number;
  title: string;
  description?: string | null;
}): string | null {
  if (!/^image\/(jpeg|png|webp)$/i.test(candidate.mime)) return `unsupported type ${candidate.mime}`;
  if (candidate.width < 800) return `too small (${candidate.width}px wide)`;
  if (candidate.width / candidate.height < 1.2) return "portrait or square";
  const text = `${candidate.title} ${candidate.description ?? ""}`;
  if (/(logo|seal|coat of arms|crest|map|locator|signature|flag|emblem|diagram)/i.test(text)) return "looks like a logo, map or emblem";
  return null;
}

/** 16:9 crops at three widths, cropped where the interesting part is, plus the average colour. */
export async function processCover(input: Buffer): Promise<{
  variants: Array<{ width: number; height: number; body: Buffer }>;
  color: string;
}> {
  const meta = await sharp(input).rotate().metadata();
  const sourceWidth = meta.width ?? 0;
  const variants: Array<{ width: number; height: number; body: Buffer }> = [];
  for (const target of COVER_WIDTHS) {
    // Never upscale: a 1,000px source yields 640 and 1,000, not a blurry 1,920.
    const width = Math.min(target, sourceWidth);
    if (variants.some((v) => v.width === width)) continue;
    const height = Math.round((width * 9) / 16);
    const body = await sharp(input)
      .rotate()
      .resize({ width, height, fit: "cover", position: sharp.strategy.attention })
      .webp({ quality: 70 })
      .toBuffer();
    variants.push({ width, height, body });
  }
  const { data } = await sharp(input).resize(1, 1).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const color = `#${[data[0], data[1], data[2]].map((n) => n.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  return { variants, color };
}
