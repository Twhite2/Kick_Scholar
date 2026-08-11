"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { moveApplication, markRejected } from "@/lib/actions/applications";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DocumentChecklist, type DocumentItem } from "./document-checklist";

export interface ApplicationCardData {
  id: string;
  name: string;
  href: string;
  status: string;
  documents: DocumentItem[];
}

export function ApplicationCard({
  application,
  canMoveBack,
  canMoveForward,
}: {
  application: ApplicationCardData;
  canMoveBack: boolean;
  canMoveForward: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const isTerminal = application.status === "ACCEPTED" || application.status === "REJECTED";

  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <Link href={application.href} className="text-sm font-medium hover:text-kick-blue">
          {application.name}
        </Link>
        <DocumentChecklist applicationId={application.id} documents={application.documents} />
        {!isTerminal && (
          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={isPending || !canMoveBack}
              onClick={() => startTransition(async () => { await moveApplication(application.id, "back"); })}
              aria-label="Move back"
            >
              <ArrowLeft className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => startTransition(async () => { await markRejected(application.id); })}
              aria-label="Mark rejected"
              className="text-destructive"
            >
              <X className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={isPending || !canMoveForward}
              onClick={() => startTransition(async () => { await moveApplication(application.id, "forward"); })}
              aria-label="Move forward"
            >
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
