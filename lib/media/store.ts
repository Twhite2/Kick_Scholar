import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Where institution media is written (docs/ui-remodel.md §11.3).
 *
 * `MEDIA_STORE=local` (the default) writes under public/media and returns
 * site-relative URLs, for development. A production bucket is still an open
 * question (ui-remodel §4.2, question 3); until it is answered the "s3" driver
 * refuses to run rather than guess at credentials or a bucket layout.
 */
export interface MediaStore {
  /** Writes `body` at `key` (e.g. "logos/abc-256.webp") and returns its public URL. */
  put(key: string, body: Buffer, contentType: string): Promise<string>;
}

function localStore(): MediaStore {
  const root = path.join(process.cwd(), "public", "media");
  return {
    async put(key, body) {
      const target = path.join(root, key);
      if (!target.startsWith(root)) throw new Error(`Refusing to write outside public/media: ${key}`);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, body);
      return `/media/${key.split(path.sep).join("/")}`;
    },
  };
}

export function getMediaStore(): MediaStore {
  const driver = (process.env.MEDIA_STORE ?? "local").toLowerCase();
  if (driver === "local") return localStore();
  throw new Error(
    `MEDIA_STORE=${driver} is not implemented yet. Production storage is an open question (docs/ui-remodel-recon.md). Use MEDIA_STORE=local for now.`,
  );
}
