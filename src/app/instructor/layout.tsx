import { AppShell } from "@/components/layout/app-shell";

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell allowedRole="INSTRUCTOR">{children}</AppShell>;
}
