import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-black text-white",
        accent: "border-black/10 bg-[#C4F041] text-black",
        secondary: "border-black/10 bg-[#EAEAE6] text-black",
        outline: "border-black/15 bg-white text-black/65",
        success: "border-black/10 bg-[#AAC2AA]/65 text-black",
        warning: "border-black/10 bg-[#F3BD77]/75 text-black",
        danger: "border-black/10 bg-[#FA8E66]/75 text-black",
        info: "border-black/10 bg-[#BCE6FA] text-black",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
