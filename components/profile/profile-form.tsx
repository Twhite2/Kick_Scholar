"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { updateProfile } from "@/lib/actions/profile";
import { profileInputSchema, type ProfileInput } from "@/lib/actions/profile-schema";
import { TARGET_COUNTRIES } from "@/lib/constants/countries";
import { TagInput } from "./tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEGREE_LEVELS = ["HIGH_SCHOOL", "BACHELOR", "MASTER", "PHD", "DIPLOMA", "CERTIFICATE", "OTHER"] as const;

function degreeLabel(level: string) {
  return level.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ProfileForm({ defaultValues }: { defaultValues: ProfileInput }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedSummary, setSavedSummary] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileInputSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "languageProficiencies" });

  async function onSubmit(data: ProfileInput) {
    setServerError(null);
    setSavedSummary(null);
    const result = await updateProfile(data);
    if (result.error) {
      setServerError(result.error);
      return;
    }
    setSavedSummary(
      `Saved — ${result.programMatches ?? 0} program matches and ${result.scholarshipMatches ?? 0} scholarship matches updated.`,
    );
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Personal</CardTitle>
          <CardDescription>Used to match nationality-based eligibility rules.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nationality">Nationality</Label>
            <Input id="nationality" {...register("nationality")} placeholder="e.g. Nigeria" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of birth</Label>
            <Input id="dateOfBirth" type="date" {...register("dateOfBirth")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Academic</CardTitle>
          <CardDescription>Your current education, used to check degree prerequisites and GPA requirements.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Current education level</Label>
            <Controller
              control={control}
              name="currentEducationLevel"
              render={({ field }) => (
                <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEGREE_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {degreeLabel(level)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fieldOfStudy">Current field of study</Label>
            <Input id="fieldOfStudy" {...register("fieldOfStudy")} placeholder="e.g. Computer Science" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currentGpa">GPA</Label>
            <Input
              id="currentGpa"
              type="number"
              step="0.01"
              {...register("currentGpa", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gpaScale">GPA scale (e.g. 4.0)</Label>
            <Input id="gpaScale" type="number" step="0.1" {...register("gpaScale", { valueAsNumber: true })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Study preferences</CardTitle>
          <CardDescription>What you're looking for and what you can afford.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Desired degree level</Label>
            <Controller
              control={control}
              name="desiredDegreeLevel"
              render={({ field }) => (
                <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEGREE_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {degreeLabel(level)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Desired fields of study</Label>
            <Controller
              control={control}
              name="desiredFields"
              render={({ field }) => (
                <TagInput value={field.value} onChange={field.onChange} placeholder="Type a field, press Enter" />
              )}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Preferred countries</Label>
            <Controller
              control={control}
              name="preferredCountries"
              render={({ field }) => (
                <TagInput value={field.value} onChange={field.onChange} placeholder="e.g. DE, FI — press Enter" />
              )}
            />
            <p className="text-xs text-muted-foreground">
              {Object.entries(TARGET_COUNTRIES).map(([code, name]) => `${code} (${name})`).join(", ")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="budgetMaxPerYear">Max budget per year</Label>
            <Input
              id="budgetMaxPerYear"
              type="number"
              {...register("budgetMaxPerYear", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budgetCurrency">Budget currency</Label>
            <Input id="budgetCurrency" {...register("budgetCurrency")} placeholder="EUR" maxLength={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Language</CardTitle>
          <CardDescription>Add any language test scores you have (IELTS, TOEFL, etc.).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label>Test name</Label>
                <Input {...register(`languageProficiencies.${index}.testName`)} placeholder="IELTS" />
              </div>
              <div className="flex-1 space-y-2">
                <Label>Score</Label>
                <Input
                  type="number"
                  step="0.5"
                  {...register(`languageProficiencies.${index}.score`, { valueAsNumber: true })}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label>CEFR level (optional)</Label>
                <Input {...register(`languageProficiencies.${index}.cefrLevel`)} placeholder="C1" />
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="Remove">
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ testName: "", score: null, cefrLevel: null })}
          >
            <Plus className="size-4" /> Add language test
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Experience</CardTitle>
          <CardDescription>Work experience and financial need — used for scholarship eligibility.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="workExperienceMonths">Work experience (months)</Label>
            <Input
              id="workExperienceMonths"
              type="number"
              {...register("workExperienceMonths", { valueAsNumber: true })}
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Controller
              control={control}
              name="financialNeedSelfReported"
              render={({ field }) => (
                <Checkbox
                  id="financialNeedSelfReported"
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="financialNeedSelfReported">I have significant financial need</Label>
          </div>
        </CardContent>
      </Card>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      {savedSummary && <p className="text-sm text-success">{savedSummary}</p>}
      {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

      <Button type="submit" disabled={isSubmitting} size="lg">
        {isSubmitting ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
