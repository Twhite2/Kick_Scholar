"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPlus } from "lucide-react";
import { startApplication } from "@/lib/actions/applications";
import { Button } from "@/components/ui/button";

export function StartApplicationButton({
  targetType,
  targetId,
}: {
  targetType: "PROGRAM" | "SCHOLARSHIP";
  targetId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await startApplication(targetType, targetId);
          router.push("/applications");
        })
      }
    >
      <ClipboardPlus className="size-4" /> Track application
    </Button>
  );
}
