"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, CircleAlert, Plus, Trash2, X } from "lucide-react";
import { updateProfile } from "@/lib/actions/profile";
import {
  BUDGET_CURRENCIES,
  profileInputSchema,
  type ProfileFormValues,
  type ProfileInput,
} from "@/lib/actions/profile-schema";
import { TARGET_COUNTRIES } from "@/lib/constants/countries";
import { countryName } from "@/lib/ui/country";
import { cn } from "@/lib/utils";
import { TagInput } from "./tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountryFlag } from "@/components/kick/country-flag";
import { DataSaverSwitch } from "@/components/kick/data-saver";

const DEGREE_LEVELS = ["HIGH_SCHOOL", "BACHELOR", "MASTER", "PHD", "DIPLOMA", "CERTIFICATE", "OTHER"] as const;
const DEGREE_LABEL: Record<(typeof DEGREE_LEVELS)[number], string> = {
  HIGH_SCHOOL: "Secondary school",
  BACHELOR: "Bachelor's",
  MASTER: "Master's",
  PHD: "PhD",
  DIPLOMA: "Diploma",
  CERTIFICATE: "Certificate",
  OTHER: "Other",
};
const DEGREE_ITEMS = Object.fromEntries(DEGREE_LEVELS.map((d) => [d, DEGREE_LABEL[d]]));

/** One profile section, with the id the Home unlock card links to (§9.8). */
function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-28 rounded-panel bg-white p-5 shadow-hairline md:p-6">
      <h2 id={`${id}-title`} className="font-display text-[22px] font-bold text-ink">
        {title}
      </h2>
      <p className="mt-1 max-w-[70ch] type-body-sm text-ink-3">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-red-text">
      <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-kick-red" />
      {message}
    </p>
  );
}

function FieldLabel({ htmlFor, children, hint }: { htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[15px] font-bold text-ink">
      {children}
      {hint && <span className="ml-1.5 font-normal text-ink-3">{hint}</span>}
    </label>
  );
}

/** Searchable list of countries; stores the English name the matcher compares. */
function NationalityPicker({
  value,
  onChange,
  options,
  invalid,
  describedBy,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: string[];
  invalid: boolean;
  describedBy?: string;
}) {
  const id = useId();
  // Keep an older free-text value selectable so saving never drops it.
  const items = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <Combobox.Root items={items} value={value} onValueChange={(v) => onChange((v as string | null) ?? null)}>
      <FieldLabel htmlFor={id}>Nationality</FieldLabel>
      <Combobox.InputGroup
        className={cn(
          "relative flex h-12 items-center rounded-xl border bg-white transition-colors focus-within:border-kick-blue hover:border-ink-3",
          invalid ? "border-kick-red" : "border-line-strong",
        )}
      >
        <Combobox.Input
          id={id}
          placeholder="Start typing, e.g. Nigeria"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="h-full w-full rounded-xl bg-transparent pr-20 pl-3.5 text-base text-ink outline-none placeholder:text-ink-3"
        />
        <div className="absolute right-1 flex items-center">
          {value && (
            <Combobox.Clear aria-label="Clear nationality" className="inline-flex size-10 items-center justify-center rounded-full text-ink-3 hover:text-ink">
              <X aria-hidden="true" className="size-4" />
            </Combobox.Clear>
          )}
          <Combobox.Trigger aria-label="Show countries" className="inline-flex size-10 items-center justify-center rounded-full text-ink-3 hover:text-ink">
            <ChevronDown aria-hidden="true" className="size-4" />
          </Combobox.Trigger>
        </div>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={6} className="z-50">
          <Combobox.Popup className="w-[var(--anchor-width)] max-w-[var(--available-width)] rounded-2xl bg-white p-1.5 shadow-raised outline-none">
            <Combobox.Empty>
              <p className="px-3 py-3 text-[15px] text-ink-3">No country matches that.</p>
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(22rem,var(--available-height))] overflow-y-auto overscroll-contain outline-0">
              {(item: string) => (
                <Combobox.Item
                  key={item}
                  value={item}
                  className="flex min-h-11 cursor-default items-center justify-between gap-3 rounded-xl px-3 text-[15px] text-ink outline-none select-none data-highlighted:bg-blue-tint data-highlighted:text-kick-blue data-selected:font-bold"
                >
                  {item}
                  <Combobox.ItemIndicator>
                    <Check aria-hidden="true" className="size-4" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function errorAt(errors: unknown, path: string): string | undefined {
  let node: unknown = errors;
  for (const part of path.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  const message = (node as { message?: unknown } | undefined)?.message;
  return typeof message === "string" ? message : undefined;
}

export function ProfileForm({
  defaultValues,
  nationalityOptions,
}: {
  defaultValues: ProfileInput;
  nationalityOptions: string[];
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedSummary, setSavedSummary] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues, unknown, ProfileInput>({
    resolver: zodResolver(profileInputSchema),
    defaultValues,
    shouldFocusError: true,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "languageProficiencies" });

  const err = (path: string) => errorAt(errors, path);
  const a11y = (path: string) => {
    const message = err(path);
    const errId = `${path.replace(/\./g, "-")}-error`;
    return {
      "aria-invalid": message ? true : undefined,
      "aria-describedby": message ? errId : undefined,
      errId,
      message,
    };
  };

  async function onSubmit(data: ProfileInput) {
    setServerError(null);
    setSavedSummary(null);
    const result = await updateProfile(data);
    if (result.error) {
      setServerError(result.error);
      const paths = Object.keys(result.fieldErrors ?? {});
      for (const path of paths) {
        setError(path as FieldPath<ProfileFormValues>, { type: "server", message: result.fieldErrors![path] });
      }
      if (paths[0]) setFocus(paths[0] as FieldPath<ProfileFormValues>);
      return;
    }
    setSavedSummary(
      `Saved — ${(result.programMatches ?? 0).toLocaleString("en-GB")} programme matches and ${(result.scholarshipMatches ?? 0).toLocaleString("en-GB")} scholarship matches updated.`,
    );
    router.refresh();
  }

  const gpa = a11y("currentGpa");
  const scale = a11y("gpaScale");
  const budget = a11y("budgetMaxPerYear");
  const work = a11y("workExperienceMonths");
  const dob = a11y("dateOfBirth");
  const nat = a11y("nationality");

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <Section id="personal" title="Personal" description="Used to check nationality rules on scholarships.">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Controller
              control={control}
              name="nationality"
              render={({ field }) => (
                <NationalityPicker
                  value={field.value ?? null}
                  onChange={field.onChange}
                  options={nationalityOptions}
                  invalid={Boolean(nat.message)}
                  describedBy={nat["aria-describedby"]}
                />
              )}
            />
            <FieldError id={nat.errId} message={nat.message} />
          </div>
          <div>
            <FieldLabel htmlFor="dateOfBirth">Date of birth</FieldLabel>
            <Input id="dateOfBirth" type="date" {...register("dateOfBirth", { setValueAs: (v) => (v ? v : null) })} aria-invalid={dob["aria-invalid"]} aria-describedby={dob["aria-describedby"]} />
            <FieldError id={dob.errId} message={dob.message} />
          </div>
        </div>
      </Section>

      <Section id="academic" title="Academic" description="Your current education, used to check degree prerequisites and grade requirements.">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel>Current education level</FieldLabel>
            <Controller
              control={control}
              name="currentEducationLevel"
              render={({ field }) => (
                <Select value={field.value ?? null} onValueChange={field.onChange} items={DEGREE_ITEMS}>
                  <SelectTrigger className="w-full" aria-label="Current education level">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEGREE_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {DEGREE_LABEL[level]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <FieldLabel htmlFor="fieldOfStudy">Current field of study</FieldLabel>
            <Input id="fieldOfStudy" {...register("fieldOfStudy")} placeholder="e.g. Computer Science" />
          </div>
          <div>
            <FieldLabel htmlFor="currentGpa">CGPA</FieldLabel>
            <Input id="currentGpa" type="number" inputMode="decimal" step="0.01" {...register("currentGpa", { valueAsNumber: true })} aria-invalid={gpa["aria-invalid"]} aria-describedby={gpa["aria-describedby"]} />
            <FieldError id={gpa.errId} message={gpa.message} />
          </div>
          <div>
            <FieldLabel htmlFor="gpaScale" hint="e.g. 5 or 4">
              Grading scale
            </FieldLabel>
            <Input id="gpaScale" type="number" inputMode="decimal" step="0.1" {...register("gpaScale", { valueAsNumber: true })} aria-invalid={scale["aria-invalid"]} aria-describedby={scale["aria-describedby"]} />
            <FieldError id={scale.errId} message={scale.message} />
          </div>
        </div>
      </Section>

      <Section id="preferences" title="Study preferences" description="What you're looking for and what you can afford.">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel>Degree you want</FieldLabel>
            <Controller
              control={control}
              name="desiredDegreeLevel"
              render={({ field }) => (
                <Select value={field.value ?? null} onValueChange={field.onChange} items={DEGREE_ITEMS}>
                  <SelectTrigger className="w-full" aria-label="Degree you want">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEGREE_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {DEGREE_LABEL[level]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="desiredFields-input">Fields you want to study</FieldLabel>
            <Controller
              control={control}
              name="desiredFields"
              render={({ field }) => (
                <TagInput id="desiredFields-input" value={field.value} onChange={field.onChange} placeholder="Type a field and press Enter" />
              )}
            />
          </div>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-[15px] font-bold text-ink">Preferred countries</legend>
            <Controller
              control={control}
              name="preferredCountries"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {Object.keys(TARGET_COUNTRIES).map((code) => {
                    const selected = field.value.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => field.onChange(selected ? field.value.filter((c) => c !== code) : [...field.value, code])}
                        className={cn(
                          "inline-flex h-11 items-center gap-2 rounded-full border px-4 text-[15px] font-bold transition-colors",
                          selected ? "border-kick-blue bg-blue-tint text-kick-blue" : "border-line-strong bg-white text-ink hover:border-kick-blue",
                        )}
                      >
                        <CountryFlag code={code} />
                        {countryName(code)}
                        {selected && <Check aria-hidden="true" className="size-4" />}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </fieldset>
          <div>
            <FieldLabel htmlFor="budgetMaxPerYear">Budget per year</FieldLabel>
            <Input id="budgetMaxPerYear" type="number" inputMode="numeric" {...register("budgetMaxPerYear", { valueAsNumber: true })} aria-invalid={budget["aria-invalid"]} aria-describedby={budget["aria-describedby"]} />
            <FieldError id={budget.errId} message={budget.message} />
          </div>
          <div>
            <FieldLabel>Budget currency</FieldLabel>
            <Controller
              control={control}
              name="budgetCurrency"
              render={({ field }) => (
                <Select
                  value={field.value ?? null}
                  onValueChange={field.onChange}
                  items={Object.fromEntries(BUDGET_CURRENCIES.map((c) => [c, c]))}
                >
                  <SelectTrigger className="w-full" aria-label="Budget currency">
                    <SelectValue placeholder="EUR" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* An older value outside the list stays selectable. */}
                    {field.value && !(BUDGET_CURRENCIES as readonly string[]).includes(field.value) && (
                      <SelectItem value={field.value}>{field.value}</SelectItem>
                    )}
                    {BUDGET_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </Section>

      <Section id="language" title="Language" description="Add any language test results you have, such as IELTS or TOEFL.">
        <div className="space-y-4">
          {fields.length === 0 && <p className="text-[15px] text-ink-3">No language tests added yet.</p>}
          {fields.map((field, index) => {
            const name = a11y(`languageProficiencies.${index}.testName`);
            const score = a11y(`languageProficiencies.${index}.score`);
            return (
              <div key={field.id} className="grid items-start gap-3 rounded-tile bg-paper p-3.5 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <div>
                  <FieldLabel htmlFor={`lp-${index}-name`}>Test</FieldLabel>
                  <Input id={`lp-${index}-name`} {...register(`languageProficiencies.${index}.testName`)} placeholder="IELTS" aria-invalid={name["aria-invalid"]} aria-describedby={name["aria-describedby"]} />
                  <FieldError id={name.errId} message={name.message} />
                </div>
                <div>
                  <FieldLabel htmlFor={`lp-${index}-score`}>Score</FieldLabel>
                  <Input id={`lp-${index}-score`} type="number" inputMode="decimal" step="0.5" {...register(`languageProficiencies.${index}.score`, { valueAsNumber: true })} aria-invalid={score["aria-invalid"]} aria-describedby={score["aria-describedby"]} />
                  <FieldError id={score.errId} message={score.message} />
                </div>
                <div>
                  <FieldLabel htmlFor={`lp-${index}-cefr`} hint="optional">
                    CEFR level
                  </FieldLabel>
                  <Input id={`lp-${index}-cefr`} {...register(`languageProficiencies.${index}.cefrLevel`, { setValueAs: (v) => (v ? v : null) })} placeholder="C1" />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label={`Remove test ${index + 1}`} className="sm:mt-8">
                  <Trash2 className="size-[18px]" />
                </Button>
              </div>
            );
          })}
          <Button type="button" variant="outline" onClick={() => append({ testName: "", score: null, cefrLevel: null })}>
            <Plus /> Add language test
          </Button>
        </div>
      </Section>

      <Section id="experience" title="Experience" description="Work experience and financial need, used for scholarship eligibility.">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="workExperienceMonths">Work experience</FieldLabel>
            <div className="relative">
              <Input id="workExperienceMonths" type="number" inputMode="numeric" className="pr-20" {...register("workExperienceMonths", { valueAsNumber: true })} aria-invalid={work["aria-invalid"]} aria-describedby={work["aria-describedby"]} />
              <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[15px] text-ink-3">
                months
              </span>
            </div>
            <FieldError id={work.errId} message={work.message} />
          </div>
          <div className="flex items-center gap-3 sm:pt-8">
            <Controller
              control={control}
              name="financialNeedSelfReported"
              render={({ field }) => (
                <Checkbox id="financialNeedSelfReported" checked={field.value ?? false} onCheckedChange={field.onChange} />
              )}
            />
            <label htmlFor="financialNeedSelfReported" className="text-[15px] font-bold text-ink">
              I have significant financial need
            </label>
          </div>
        </div>
      </Section>

      <section aria-labelledby="settings-title" className="rounded-panel bg-white p-5 shadow-hairline md:p-6">
        <h2 id="settings-title" className="font-display text-[22px] font-bold text-ink">
          On this device
        </h2>
        <div className="mt-3 max-w-md">
          <DataSaverSwitch />
        </div>
      </section>

      <div className="sticky bottom-[calc(80px+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center gap-4 rounded-panel bg-white/95 p-4 shadow-raised backdrop-blur md:bottom-6">
        <Button type="submit" disabled={isSubmitting} size="lg">
          {isSubmitting ? "Saving…" : "Save profile"}
        </Button>
        <div role="status" aria-live="polite" className="min-w-0 flex-1 text-[15px]">
          {serverError && (
            <p className="flex items-center gap-2 font-bold text-red-text">
              <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-kick-red" />
              {serverError}
            </p>
          )}
          {!serverError && Object.keys(errors).length > 0 && (
            <p className="flex items-center gap-2 font-bold text-red-text">
              <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-kick-red" />
              Some details need fixing before we can save.
            </p>
          )}
          {savedSummary && <p className="font-bold text-green-text">{savedSummary}</p>}
        </div>
      </div>
    </form>
  );
}
