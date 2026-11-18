import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";
import { unreadCount } from "@/services/notification-service";

export const dynamic = "force-dynamic";

export default async function TelecallerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.roleKey !== "TELECALLER") redirect("/dashboard");
  return (
    <AppShell
      variant="telecaller"
      user={{ name: user.name, roleName: user.roleName }}
      permissions={[...user.permissions]}
      logoutAction={logoutAction}
      unread={await unreadCount(user.id)}
    >
      {children}
    </AppShell>
  );
}
