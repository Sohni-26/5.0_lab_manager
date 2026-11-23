import { AppShell } from "@/components/layout/app-shell";

export default function CentralLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell allowedRole="CENTRAL_LAB_MANAGER">{children}</AppShell>;
}
