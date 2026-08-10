import { cn } from "@/lib/utils";

/** Wraps numeric/technical values (GPA, tuition, scores, dates) in JetBrains Mono. */
export function Mono({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span className={cn("font-mono tabular-nums", className)} {...props} />
  );
}
