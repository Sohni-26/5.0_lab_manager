"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26943]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F2F1ED] disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-[#F26943] text-white shadow-xs hover:bg-[#DA5835] active:scale-[0.99]",
        primary:
          "bg-[#222321] text-white shadow-xs hover:bg-[#343632] active:scale-[0.99]",
        secondary:
          "bg-[#EAE9E4] text-[#222321] hover:bg-[#DFDDD6] border border-[#E6E5E0]",
        outline:
          "bg-white text-[#222321] border border-[#E6E5E0] hover:bg-[#F7F6F2] hover:border-[#D6D4CC]",
        ghost: "text-[#222321] hover:bg-[#EAE9E4]/80",
        danger:
          "bg-[#D9534F] text-white hover:bg-[#C3423E] shadow-xs",
        success:
          "bg-[#288568] text-white hover:bg-[#217057] shadow-xs",
        soft: "bg-[#FFF0E9] text-[#DA5835] hover:bg-[#FFE3D5] border border-[#F26943]/20",
        link: "text-[#F26943] underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8.5 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-6 text-sm font-semibold",
        xl: "h-12 rounded-2xl px-7 text-base font-semibold",
        icon: "h-9 w-9 rounded-lg",
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
