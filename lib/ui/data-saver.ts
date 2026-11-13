import { cache } from "react";
import { cookies, headers } from "next/headers";

/** Cookie holding the student's choice: "1" on, "0" off (docs/ui-remodel.md §12.1). */
export const DATA_SAVER_COOKIE = "ks_ds";

/**
 * Whether pictures should stay hidden for this request.
 *
 * The cookie wins when set. Without it, a browser sending `Save-Data: on`
 * (Chrome's Lite mode, many Android data-saver settings) is treated as on, so
 * the very first page is already light.
 */
export const getDataSaver = cache(async (): Promise<boolean> => {
  const jar = await cookies();
  const value = jar.get(DATA_SAVER_COOKIE)?.value;
  if (value === "1") return true;
  if (value === "0") return false;
  const h = await headers();
  return h.get("save-data")?.toLowerCase() === "on";
});

/** True when the student has made a choice, so the client shouldn't guess. */
export const hasDataSaverChoice = cache(async (): Promise<boolean> => {
  const jar = await cookies();
  return jar.has(DATA_SAVER_COOKIE);
});
