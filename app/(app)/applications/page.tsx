import { redirect } from "next/navigation";

/** Applications now live in My plan (docs/ui-remodel.md §7.3). Old links keep working. */
export default function ApplicationsRedirect() {
  redirect("/plan?tab=applications");
}
