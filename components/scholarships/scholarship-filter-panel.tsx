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
import { TARGET_COUNTRIES } from "@/lib/constants/countries";

const COVERAGE_TYPES = ["FULL_FUNDING", "FULL_TUITION", "PARTIAL_TUITION", "STIPEND", "TRAVEL"];

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ScholarshipFilterPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") params.set(key, value);
      else params.delete(key);
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
          placeholder="Search scholarships or providers…"
          className="pl-9"
        />
      </div>

      <Select defaultValue={searchParams.get("country") ?? "all"} onValueChange={(v) => setParam("country", v)}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Country" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All countries</SelectItem>
          {Object.entries(TARGET_COUNTRIES).map(([code, name]) => (
            <SelectItem key={code} value={code}>{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select defaultValue={searchParams.get("coverage") ?? "all"} onValueChange={(v) => setParam("coverage", v)}>
        <SelectTrigger className="w-[170px]"><SelectValue placeholder="Coverage" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any coverage</SelectItem>
          {COVERAGE_TYPES.map((c) => <SelectItem key={c} value={c}>{label(c)}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select defaultValue={searchParams.get("verified") ?? "all"} onValueChange={(v) => setParam("verified", v)}>
        <SelectTrigger className="w-[170px]"><SelectValue placeholder="Verification" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Verified + external</SelectItem>
          <SelectItem value="true">Verified only</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
