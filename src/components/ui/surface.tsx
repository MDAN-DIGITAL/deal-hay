"use client"

import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

export const surfaceVariants = cva(
  "min-w-0 rounded-xl text-sm text-card-foreground",
  {
    variants: {
      variant: {
        default: "border border-border bg-card shadow-xs",
        muted: "border border-transparent bg-muted/60",
        inset: "border border-border/70 bg-background",
        dashed: "border border-dashed border-border bg-card",
        danger:
          "border border-destructive/20 bg-destructive/5 text-destructive",
      },
      padding: {
        none: "p-0",
        sm: "p-3",
        default: "p-4 sm:p-5",
        lg: "p-5 sm:p-6",
      },
    },
    defaultVariants: { variant: "default", padding: "default" },
  }
)

/** Shared panel treatment. Callers own content and layout, this owns the surface. */
export function Surface({
  className,
  variant,
  padding,
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof surfaceVariants>) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps(
      { className: cn(surfaceVariants({ variant, padding }), className) },
      props
    ),
    state: { slot: "surface", variant: variant ?? "default" },
  })
}
