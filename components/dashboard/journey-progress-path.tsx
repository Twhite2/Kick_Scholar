import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface JourneyStep {
  label: string;
  detail: string;
  done: boolean;
}

export function JourneyProgressPath({ steps }: { steps: JourneyStep[] }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Study Abroad Journey
      </h3>
      <ol className="mt-5 flex flex-col gap-0 md:flex-row md:items-start md:gap-0">
        {steps.map((step, i) => (
          <li key={step.label} className="flex flex-1 md:flex-col">
            <div className="flex flex-col items-center md:w-full">
              <div className="flex w-full items-center md:contents">
                <div
                  className={cn(
                    "z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium",
                    step.done
                      ? "border-success bg-success text-success-foreground"
                      : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {step.done ? <Check className="size-4" /> : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 h-0.5 flex-1 md:mx-0 md:mt-4 md:h-0.5 md:w-full",
                      step.done ? "bg-success" : "bg-border",
                    )}
                  />
                )}
              </div>
              <div className="mt-2 pb-4 text-center md:pb-0">
                <p className="text-sm font-medium">{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.detail}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
