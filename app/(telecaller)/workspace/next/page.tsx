import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/session";
import { skipListSchema } from "@/validations/workspace";
import { getNextLeadId } from "@/services/workspace-service";

export const dynamic = "force-dynamic";

// Read-only: picks the next lead and redirects. `skip` lists leads the agent chose to pass over this session.
export default async function NextLeadPage({ searchParams }: { searchParams: { skip?: string } }) {
  const user = await requirePagePermission("lead", "VIEW");
  const skip = skipListSchema.parse(searchParams.skip);
  const id = await getNextLeadId(user, skip);
  if (!id) redirect("/workspace?empty=1");
  redirect(`/workspace/lead/${id}${skip.length ? `?skip=${encodeURIComponent(skip.join(","))}` : ""}`);
}
