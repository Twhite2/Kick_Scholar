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

const DEGREE_LEVELS = ["BACHELOR", "MASTER", "PHD"];
const FIELD_CATEGORIES = ["STEM", "BUSINESS", "HUMANITIES", "SOCIAL_SCIENCES", "ARTS", "HEALTH", "LAW", "EDUCATION"];
const TUITION_TYPES = ["FREE", "PAID"];
const SORT_OPTIONS = [
  { value: "match", label: "Best match" },
  { value: "name", label: "Name (A-Z)" },
  { value: "tuition", label: "Tuition (low to high)" },
];

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ProgramFilterPanel() {
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
          placeholder="Search programs or universities…"
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

      <Select defaultValue={searchParams.get("degree") ?? "all"} onValueChange={(v) => setParam("degree", v)}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Degree" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All degrees</SelectItem>
          {DEGREE_LEVELS.map((d) => <SelectItem key={d} value={d}>{label(d)}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select defaultValue={searchParams.get("field") ?? "all"} onValueChange={(v) => setParam("field", v)}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Field" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All fields</SelectItem>
          {FIELD_CATEGORIES.map((f) => <SelectItem key={f} value={f}>{label(f)}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select defaultValue={searchParams.get("tuition") ?? "all"} onValueChange={(v) => setParam("tuition", v)}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tuition" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any tuition</SelectItem>
          {TUITION_TYPES.map((t) => <SelectItem key={t} value={t}>{label(t)}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select defaultValue={searchParams.get("sort") ?? "match"} onValueChange={(v) => setParam("sort", v)}>
        <SelectTrigger className="w-[170px]"><SelectValue placeholder="Sort" /></SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
