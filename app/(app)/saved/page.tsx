import { redirect } from "next/navigation";

/** Saved now lives in My plan (docs/ui-remodel.md §7.3). Old links keep working. */
export default function SavedRedirect() {
  redirect("/plan?tab=saved");
}
