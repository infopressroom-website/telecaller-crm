import { logoutAction } from "@/app/actions/auth";
import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";
import { unreadCount } from "@/services/notification-service";

export const dynamic = "force-dynamic";

// Shared by pages every role may reach (e.g. /leads). Telecallers get their simpler menu automatically.
export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell
      variant={user.roleKey === "TELECALLER" ? "telecaller" : "admin"}
      user={{ name: user.name, roleName: user.roleName }}
      permissions={[...user.permissions]}
      logoutAction={logoutAction}
      unread={await unreadCount(user.id)}
    >
      {children}
    </AppShell>
  );
}
