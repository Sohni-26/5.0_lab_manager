import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#222321] text-white",
        accent: "border-[#F26943]/20 bg-[#FFF0E9] text-[#DA5835]",
        secondary: "border-[#E6E5E0] bg-[#EAE9E4] text-[#222321]",
        outline: "border-[#E6E5E0] bg-white text-[#72736E]",
        success: "border-[#288568]/20 bg-[#EAF6F1] text-[#288568]",
        warning: "border-[#D69A35]/25 bg-[#FDF6E7] text-[#A8741C]",
        danger: "border-[#D9534F]/25 bg-[#FDEDEC] text-[#C23E3A]",
        info: "border-[#4D83B5]/25 bg-[#EDF4FA] text-[#3B6D9A]",
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
