"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Bookmark } from "lucide-react";
import { toggleSavedProgram, toggleSavedScholarship } from "@/lib/actions/saved";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SaveButton({
  targetType,
  targetId,
  initialSaved,
}: {
  targetType: "program" | "scholarship";
  targetId: string;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setSaved((prev) => !prev); // optimistic
    startTransition(async () => {
      const action = targetType === "program" ? toggleSavedProgram : toggleSavedScholarship;
      const result = await action(targetId);
      if ("error" in result) setSaved((prev) => !prev); // revert on failure
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save"}
    >
      <motion.span
        initial={false}
        animate={{ scale: saved ? [1, 1.3, 1] : 1 }}
        transition={{ duration: 0.3 }}
      >
        <Bookmark className={cn("size-4", saved && "fill-primary text-primary")} />
      </motion.span>
    </Button>
  );
}
