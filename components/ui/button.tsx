import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Pills with a 44px minimum target (docs/ui-remodel.md §5.4, §13). Focus is
// the shared 3px --focus outline, on light and night surfaces alike.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding font-bold whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default: "bg-kick-blue text-white hover:bg-kick-blue-hover",
        outline:
          "border-line-strong bg-white text-ink hover:border-kick-blue hover:text-kick-blue aria-expanded:border-kick-blue",
        secondary: "bg-blue-tint text-kick-blue hover:bg-[#d6e6f5]",
        ghost: "text-ink hover:bg-grey-tint aria-expanded:bg-grey-tint",
        destructive: "bg-kick-red text-white hover:bg-red-deep",
        link: "h-auto! rounded-none px-0! text-kick-blue underline-offset-4 hover:underline",
        white: "bg-white text-ink hover:bg-[#E3EBF4]",
        outlineNight: "border-white/45 bg-transparent text-white hover:bg-white/10",
      },
      size: {
        default: "h-11 gap-2 px-5 text-[15px]",
        xs: "h-8 gap-1 px-3 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 px-4 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 gap-2 px-6 text-base",
        xl: "h-[52px] gap-2 px-7 text-base",
        icon: "size-11",
        "icon-xs": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  nativeButton,
  render,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      // `render` usually swaps in a non-<button> element (e.g. next/link's
      // <a>) — default nativeButton to false in that case so Base UI
      // doesn't warn about losing native button semantics.
      nativeButton={nativeButton ?? !render}
      render={render}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
