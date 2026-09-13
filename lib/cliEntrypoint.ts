import { pathToFileURL } from "node:url";

/**
 * True when the current module is the file Node was invoked with, i.e. it is
 * running as a CLI rather than being imported.
 *
 * The obvious spelling — `import.meta.url === \`file://${process.argv[1]}\`` —
 * is broken on Windows and fails *silently*: `import.meta.url` is
 * `file:///C:/path/to/x.ts` (three slashes, forward slashes) while
 * `process.argv[1]` is `C:\path\to\x.ts` (backslashes, no drive slash), so the
 * comparison is always false and the CLI body never runs. Every affected
 * script appeared to succeed while doing nothing at all.
 *
 * `pathToFileURL` performs the same normalization Node uses for
 * `import.meta.url`, so the two are directly comparable on every platform.
 */
export function isCliEntrypoint(moduleUrl: string): boolean {
  if (!process.argv[1]) return false;
  return moduleUrl === pathToFileURL(process.argv[1]).href;
}
