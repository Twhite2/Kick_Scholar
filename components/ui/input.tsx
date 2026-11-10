import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-xl border border-line-strong bg-white px-3.5 text-base text-ink transition-colors file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-kick-blue disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-grey-tint disabled:opacity-60 aria-invalid:border-kick-red",
        className
      )}
      {...props}
    />
  )
}

export { Input }
