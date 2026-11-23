import { AppShell } from "@/components/layout/app-shell";

export default function LabManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell allowedRole="LAB_MANAGER">{children}</AppShell>;
}
