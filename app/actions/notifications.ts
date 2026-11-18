"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { markRead } from "@/services/notification-service";

export async function markAllReadAction() {
  const user = await requireUser();
  await markRead(user);
  revalidatePath("/notifications");
}
export async function markOneReadAction(fd: FormData) {
  const user = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (id) await markRead(user, [id]);
  revalidatePath("/notifications");
}
