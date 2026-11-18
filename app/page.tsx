import { redirect } from "next/navigation";
import { homePathFor } from "@/lib/auth/rbac";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? homePathFor(user) : "/login");
}
