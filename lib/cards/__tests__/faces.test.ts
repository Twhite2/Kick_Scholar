import { afterEach, describe, expect, it, vi } from "vitest";
import { mediaSrc, toInstitutionFace } from "../faces";

const row = {
  id: "u1",
  name: "Universiteit van Amsterdam",
  acronym: "UvA",
  country: "NL",
  city: "Amsterdam",
  logoUrl: "/media/logos/u1-256.webp",
  coverUrl: "/media/covers/u1-1280.webp",
  coverWidth: 1280,
  coverHeight: 720,
  coverColor: "#123456",
  coverCredit: "Photo: someone",
  coverLicense: "CC BY-SA 4.0",
  coverLicenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  coverSourceUrl: "https://commons.wikimedia.org/wiki/File:x.jpg",
};

afterEach(() => vi.unstubAllEnvs());

describe("mediaSrc", () => {
  it("keeps site-relative paths when no media site is set (development)", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "");
    expect(mediaSrc("/media/logos/u1-256.webp")).toBe("/media/logos/u1-256.webp");
  });

  it("serves /media paths from the media site when one is set", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "https://media.varsityfind.com/");
    expect(mediaSrc("/media/logos/u1-256.webp")).toBe("https://media.varsityfind.com/media/logos/u1-256.webp");
    // Anything that isn't one of our media paths is left alone.
    expect(mediaSrc("/scenes/nordic.svg")).toBe("/scenes/nordic.svg");
  });

  it("gives institution faces their logo and cover on the media site", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "https://media.varsityfind.com");
    const face = toInstitutionFace(row);
    expect(face.logoUrl).toBe("https://media.varsityfind.com/media/logos/u1-256.webp");
    expect(face.cover?.url).toBe("https://media.varsityfind.com/media/covers/u1-1280.webp");
  });
});
