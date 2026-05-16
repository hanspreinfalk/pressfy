import { AuthGuard } from "@/modules/auth/ui/components/auth-guard";
import { DashboardShell } from "@/modules/dashboard/ui/components/dashboard-shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DashboardShell>{children}</DashboardShell>
    </AuthGuard>
  );
}
