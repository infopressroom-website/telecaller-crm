import { logoutAction } from "@/app/actions/auth";
import { AppShellWrapper } from "@/components/layout/app-shell-wrapper";
import { requireUser } from "@/lib/auth/session";
import { unreadCount } from "@/services/notification-service";

export const dynamic = "force-dynamic";

// Shared by pages every role may reach (e.g. /leads). Telecallers get their simpler menu automatically.
export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShellWrapper
      variant={user.roleKey === "TELECALLER" ? "telecaller" : "admin"}
      user={{ id: user.id, name: user.name, roleName: user.roleName }}
      permissions={[...user.permissions]}
      logoutAction={logoutAction}
      initialUnread={await unreadCount(user.id)}
    >
      {children}
    </AppShellWrapper>
  );
}
