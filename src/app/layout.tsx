import type { Metadata } from "next";
import { Caveat, DM_Sans, Geist_Mono, Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-saans",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CampusLab — The all-in-one lab manager for campuses",
  description:
    "The all-in-one lab management system for multi-campus institutions. Keeps your inventory, allocations, borrowing, 4-angle photo proofs and audits connected.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} ${dmSans.variable} ${caveat.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen bg-[#F2F1ED] text-[#222321] antialiased selection:bg-[#FFF0E9] selection:text-[#DA5835]">
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster
              position="bottom-right"
              richColors
              toastOptions={{
                style: {
                  borderRadius: "14px",
                  border: "1px solid #E6E5E0",
                  fontFamily: "var(--font-inter), sans-serif",
                },
              }}
            />
          </TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
