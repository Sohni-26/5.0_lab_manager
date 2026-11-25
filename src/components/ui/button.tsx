"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F0F0F0] disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default: "bg-black text-white hover:bg-[#C4F041] hover:text-black",
        primary: "bg-[#C4F041] text-black border border-black/15 hover:bg-[#B8E635]",
        secondary:
          "bg-[#E7E7E4] text-black hover:bg-[#DCDBD6] border border-black/10",
        outline:
          "bg-white text-black border border-black/15 hover:border-black/40 hover:bg-[#F7F7F5]",
        ghost: "text-black/75 hover:bg-black/[0.06] hover:text-black",
        danger: "bg-[#FA8E66] text-black border border-black/10 hover:bg-[#F57B4E]",
        success: "bg-[#AAC2AA] text-black border border-black/10 hover:bg-[#99B599]",
        soft: "bg-[#F3FBD4] text-black hover:bg-[#E7F7B0] border border-black/12",
        link: "text-black underline underline-offset-4 hover:opacity-70 p-0 h-auto rounded-none",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8.5 px-3.5 text-xs",
        lg: "h-11 px-6 text-sm font-semibold",
        xl: "h-12 px-7 text-base font-semibold",
        icon: "h-9 w-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
