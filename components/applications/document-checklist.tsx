"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toggleApplicationDocument, addApplicationDocument } from "@/lib/actions/applications";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface DocumentItem {
  id: string;
  name: string;
  completed: boolean;
  required: boolean;
}

export function DocumentChecklist({ applicationId, documents }: { applicationId: string; documents: DocumentItem[] }) {
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-1.5">
      {documents.map((doc) => (
        <label key={doc.id} className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={doc.completed}
            onCheckedChange={(checked) =>
              startTransition(async () => { await toggleApplicationDocument(doc.id, checked === true); })
            }
          />
          <span className={doc.completed ? "text-muted-foreground line-through" : ""}>{doc.name}</span>
        </label>
      ))}
      <div className="flex items-center gap-1 pt-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add document…"
          className="h-7 text-xs"
        />
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={isPending || !draft.trim()}
          onClick={() => {
            const name = draft.trim();
            if (!name) return;
            setDraft("");
            startTransition(async () => { await addApplicationDocument(applicationId, name); });
          }}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
