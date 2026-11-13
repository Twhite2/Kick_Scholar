import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-xl border border-line-strong bg-white px-3.5 py-3 text-base text-ink transition-colors placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-kick-blue disabled:cursor-not-allowed disabled:bg-grey-tint disabled:opacity-60 aria-invalid:border-kick-red",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
