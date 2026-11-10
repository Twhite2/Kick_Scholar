"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORT_OPTIONS = [
  { value: "scholarships", label: "Most scholarships" },
  { value: "programs", label: "Most programmes" },
  { value: "name", label: "Name (A-Z)" },
];

export interface CountryOption {
  code: string;
  label: string;
  count: number;
}

export function InstitutionFilterPanel({ countries }: { countries: CountryOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") params.set(key, value);
      else params.delete(key);
      // A changed filter changes the result count, so a page number carried
      // over from the previous query is meaningless and often out of range.
      params.delete("page");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => setParam("q", e.target.value)}
          placeholder="Search institutions or cities…"
          className="pl-9"
        />
      </div>

      {/* Countries come from the data rather than a fixed list: the catalogue
          spans whichever countries have been imported, and a hard-coded list
          silently hides the rest. */}
      <Select
        defaultValue={searchParams.get("country") ?? "all"}
        onValueChange={(v) => setParam("country", v)}
      >
        <SelectTrigger className="w-[190px]">
          <SelectValue placeholder="Country" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All countries</SelectItem>
          {countries.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.label} ({c.count})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get("has") ?? "all"}
        onValueChange={(v) => setParam("has", v)}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Show" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All institutions</SelectItem>
          <SelectItem value="scholarships">With scholarships</SelectItem>
          <SelectItem value="programs">With programmes</SelectItem>
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get("sort") ?? "scholarships"}
        onValueChange={(v) => setParam("sort", v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
