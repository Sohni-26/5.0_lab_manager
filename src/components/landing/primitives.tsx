"use client";

import React from "react";
import Link from "next/link";

/** NxtWave brand wordmark logo */
export function LoopsiiWordmark({
  className = "h-[28px] w-auto",
  inverse = false,
}: {
  className?: string;
  inverse?: boolean;
}) {
  return (
    <span className="inline-flex items-center select-none" aria-label="NxtWave">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={
          inverse
            ? "/images/brand/nxtwave-logo-dark.webp"
            : "/images/brand/nxtwave-logo.webp"
        }
        alt="NxtWave"
        className={`object-contain ${className}`}
      />
    </span>
  );
}

/** NxtWave logo mark */
export function LoopsiiMark({
  className = "h-8 w-auto",
  inverse = false,
}: {
  className?: string;
  inverse?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={
        inverse
          ? "/images/brand/nxtwave-logo-dark.webp"
          : "/images/brand/nxtwave-logo.webp"
      }
      alt="NxtWave"
      className={`object-contain select-none ${className}`}
    />
  );
}

/** Signature Loopsii split-pill button with circular ↗ arrow & 4-color diagonal hover cascade */
export function LoopsiiButton({
  label,
  href = "/login",
  inverse = false,
  size = "md",
  fullWidth = false,
  iconOnly = false,
  hideArrow = false,
  className = "",
  onClick,
}: {
  label: string;
  href?: string;
  inverse?: boolean;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  iconOnly?: boolean;
  hideArrow?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const heightCls =
    size === "sm" ? "h-[36px]" : size === "lg" ? "h-[60px]" : "h-[48px]";
  const arrowDim =
    size === "sm" ? "w-[36px] h-[36px]" : size === "lg" ? "w-[60px] h-[60px]" : "w-[48px] h-[48px]";
  const padCls =
    size === "sm"
      ? "px-4 text-[13px]"
      : size === "lg"
      ? "px-8 text-[17px]"
      : "px-6 text-[15px]";

  const content = (
    <>
      {!fullWidth && !hideArrow && (
        <span className={`lp-btn_arrow-parent ${arrowDim} ${iconOnly ? "!mr-0" : ""}`}>
          <span className="lp-btn_layer lp-btn_layer--sage" />
          <span className="lp-btn_layer lp-btn_layer--sky" />
          <span className="lp-btn_layer lp-btn_layer--apricot" />
          <span className="lp-btn_layer lp-btn_layer--main" />
          <svg
            className="lp-btn_content lp-btn_arrow-icon h-[11px] w-[11px]"
            viewBox="0 0 11 11"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6.82353 2.1L-0.00146866 8.946L1.57353 10.521L8.41953 3.654V9.24H10.5195V0H1.27953V2.1H6.82353Z"
              fill="currentColor"
            />
          </svg>
        </span>
      )}
      {!iconOnly && (
        <span
          className={`lp-btn_text-wrapper ${heightCls} ${padCls} ${
            fullWidth ? "w-full justify-between !rounded-[16px]" : ""
          } font-medium tracking-[-0.01em]`}
        >
          <span className="lp-btn_layer lp-btn_layer--sage" />
          <span className="lp-btn_layer lp-btn_layer--sky" />
          <span className="lp-btn_layer lp-btn_layer--apricot" />
          <span className="lp-btn_layer lp-btn_layer--main" />
          <span className="lp-btn_content whitespace-nowrap">{label}</span>
          {fullWidth && (
            <svg
              className="lp-btn_content lp-btn_arrow-icon h-[13px] w-[13px]"
              viewBox="0 0 11 11"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6.82353 2.1L-0.00146866 8.946L1.57353 10.521L8.41953 3.654V9.24H10.5195V0H1.27953V2.1H6.82353Z"
                fill="currentColor"
              />
            </svg>
          )}
        </span>
      )}
    </>
  );

  const cls = `lp-btn ${inverse ? "lp-btn--inverse" : ""} ${fullWidth ? "w-full" : ""} ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        className={cls}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={href}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={cls}
    >
      {content}
    </Link>
  );
}

/** WeightHover link: characters smoothly cascade font-weight on hover */
export function WeightHoverLink({
  href,
  children,
  className = "",
  onClick,
}: {
  href: string;
  children: string;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <a href={href} onClick={onClick} className={`lp-weight-link inline-flex items-center ${className}`}>
      {children.split("").map((char, idx) => (
        <span
          key={idx}
          className="lp-weight-char"
          style={{ transitionDelay: `${idx * 14}ms` }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </a>
  );
}
