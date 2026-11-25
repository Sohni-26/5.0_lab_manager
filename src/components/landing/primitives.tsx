"use client";

import React from "react";
import Link from "next/link";

/** CampusLab geometric editorial wordmark paired with the interlocking loop emblem */
export function LoopsiiWordmark({ className = "h-[24px] w-auto" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-bold uppercase tracking-[-0.04em] text-current ${className}`}
      aria-label="CampusLab"
    >
      <LoopsiiMark className="h-[22px] w-auto" />
      <span className="text-[17px] leading-none sm:text-[19px]">CAMPUSLAB</span>
    </span>
  );
}

/** Iconic interlocking Loopsii double-loop mark (the "OO" emblem) */
export function LoopsiiMark({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="17.5 -0.5 36.5 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M46.6084 20.07L48.8175 19.7045C47.0229 22.4036 44.7164 24.5118 42.2631 25.7549C39.4967 27.1564 36.2716 27.5649 33.5282 25.981C33.0423 25.7004 32.6039 25.3746 32.209 25.0126C33.3751 24.2612 34.4915 23.3172 35.5148 22.209C35.5614 22.2394 35.6075 22.2701 35.6551 22.2976C36.7466 22.9278 38.3704 22.9585 40.3402 21.9607C41.9675 21.1361 43.6471 19.6778 45.0427 17.6874L46.6084 20.07ZM39.2065 1.24501C41.9727 -0.156519 45.1972 -0.564776 47.9405 1.01883C50.6839 2.60275 51.9429 5.59927 52.1123 8.69582C52.2478 11.1742 51.7114 13.9008 50.5475 16.5436L47.9664 16.9701L46.6167 14.9188C47.57 12.7895 47.9612 10.6889 47.8648 8.92753C47.7442 6.7226 46.905 5.33239 45.8136 4.70224C44.7221 4.07245 43.099 4.04131 41.1295 5.03919C40.8184 5.19683 40.5061 5.37884 40.1934 5.58201C39.7309 4.20914 38.9884 2.96309 37.9224 1.9863C38.345 1.71395 38.7728 1.46481 39.2065 1.24501Z"
        fill="currentColor"
      />
      <path
        d="M53.6007 17.4818L47.3 18.5221L43.7922 13.1867L46.1617 11.6282L48.6572 15.4228L53.1382 14.6832L53.6007 17.4818Z"
        fill="currentColor"
      />
      <path
        d="M27.8698 1.24501C30.636 -0.156519 33.8604 -0.564776 36.6038 1.01883C39.3472 2.60275 40.6062 5.59927 40.7755 8.69582C40.911 11.1742 40.3747 13.9008 39.2108 16.5436L36.6296 16.9701L35.28 14.9188C36.2333 12.7895 36.6244 10.6889 36.5281 8.92753C36.4074 6.7226 35.5683 5.33239 34.4768 4.70224C33.3853 4.07245 31.7622 4.04131 29.7927 5.03919C27.8434 6.02692 25.8162 7.92239 24.2962 10.5551C22.7764 13.1876 22.1487 15.8904 22.268 18.0723C22.3887 20.277 23.2271 21.6673 24.3184 22.2976C25.4098 22.9278 27.0336 22.9585 29.0034 21.9607C30.6307 21.1361 32.3103 19.6778 33.7059 17.6874L35.2716 20.07L37.4807 19.7045C35.6861 22.4036 33.3796 24.5118 30.9263 25.7549C28.1599 27.1564 24.9348 27.5649 22.1914 25.981C19.448 24.3971 18.189 21.4006 18.0196 18.304C17.8503 15.2075 18.8076 11.7978 20.6604 8.58869C22.5132 5.37959 25.1036 2.64654 27.8698 1.24501Z"
        fill="currentColor"
      />
      <path
        d="M42.2639 17.4818L35.9632 18.5221L32.4554 13.1867L34.8249 11.6282L37.3204 15.4228L41.8014 14.6832L42.2639 17.4818Z"
        fill="currentColor"
      />
    </svg>
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
  className = "",
  onClick,
}: {
  label: string;
  href?: string;
  inverse?: boolean;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  iconOnly?: boolean;
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
      {!fullWidth && (
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
