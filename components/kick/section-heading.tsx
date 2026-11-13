import { cn } from "@/lib/utils";

/** H2 + optional pill + right-side actions (§8). */
export function SectionHeading({
  id,
  title,
  pill,
  description,
  actions,
  as: Tag = "h2",
  className,
}: {
  id?: string;
  title: React.ReactNode;
  pill?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Tag id={id} className="type-section-h2 text-ink">
            {title}
          </Tag>
          {pill}
        </div>
        {description && <p className="mt-1.5 type-body-sm text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}

/** Blue "4 new since Friday" pill next to a rail heading. */
export function NewPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center rounded-full bg-blue-tint px-2.5 type-caption text-kick-blue tabular-nums">
      {children}
    </span>
  );
}
