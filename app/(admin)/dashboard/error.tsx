"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="The dashboard couldn't load"
      description="Something went wrong while calculating the figures. Your data is unchanged."
      action={<Button variant="secondary" onClick={reset}>Try again</Button>}
    />
  );
}
