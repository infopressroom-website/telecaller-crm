import { ok, route } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// Reference pattern for protected API routes. Data routes should use requireApiPermission(resource, action).
export const GET = route(async () => {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
  return ok({ id: user.id, name: user.name, email: user.email, role: user.roleKey, permissions: [...user.permissions] });
});
