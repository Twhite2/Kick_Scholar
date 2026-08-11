import { Mono } from "@/components/ui/mono";

export function FundingByCountry({
  countries,
}: {
  countries: Array<{ country: string; countryName: string; avgScore: number }>;
}) {
  if (countries.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-6">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Funding Potential</h3>
        <p className="mt-3 text-sm text-muted-foreground">
          Save some programs and complete your profile to see your strongest countries here.
        </p>
      </div>
    );
  }

  const max = Math.max(...countries.map((c) => c.avgScore), 1);

  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Funding Potential</h3>
      <div className="mt-4 space-y-3">
        {countries.map((c) => (
          <div key={c.country} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm font-medium">{c.countryName}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-alt">
              <div
                className="h-full rounded-full bg-kick-green transition-[width] duration-700 ease-out"
                style={{ width: `${(c.avgScore / max) * 100}%` }}
              />
            </div>
            <Mono className="w-10 shrink-0 text-right text-sm tabular-nums">{c.avgScore}%</Mono>
          </div>
        ))}
      </div>
    </div>
  );
}
