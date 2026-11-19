"use client";

import { useState, useEffect } from "react";
import { AppShell } from "./app-shell";
import { useUserEvents } from "@/hooks/use-realtime";
import { useToast } from "@/components/ui/toast";

type AppShellWrapperProps = {
  variant: "admin" | "telecaller";
  user: { id: string; name: string; roleName: string };
  permissions: string[];
  logoutAction: () => Promise<void>;
  initialUnread: number;
  children: React.ReactNode;
};

export function AppShellWrapper({ 
  variant, 
  user, 
  permissions, 
  logoutAction, 
  initialUnread,
  children 
}: AppShellWrapperProps) {
  const [unread, setUnread] = useState(initialUnread);
  const { success } = useToast();

  // Listen for real-time notification events to update badge count
  useUserEvents(user.id, {
    "notification.created": (data) => {
      setUnread(prev => prev + 1);
      success(data.title);
    },
  });

  return (
    <AppShell
      variant={variant}
      user={{ name: user.name, roleName: user.roleName }}
      permissions={permissions}
      logoutAction={logoutAction}
      unread={unread}
    >
      {children}
    </AppShell>
  );
}
