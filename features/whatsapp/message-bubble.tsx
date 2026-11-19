"use client";

import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  message: {
    id: string;
    direction: "INBOUND" | "OUTBOUND";
    messageType: string;
    content: string | null;
    status: string;
    templateName: string | null;
    createdAt: string;
    agent: { name: string } | null;
  };
};

export function MessageBubble({ message }: Props) {
  const isOutbound = message.direction === "OUTBOUND";
  const time = new Date(message.createdAt).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[70%] rounded-lg px-4 py-2",
          isOutbound
            ? "bg-blue-500 text-white"
            : "bg-slate-100 text-slate-900"
        )}
      >
        {message.templateName && (
          <div className="mb-1 text-xs opacity-75">
            Template: {message.templateName}
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">
          {message.content || "(media)"}
        </div>
        <div className="mt-1 flex items-center justify-end gap-1 text-xs opacity-75">
          <span>{time}</span>
          {isOutbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "READ") {
    return <CheckCheck className="h-4 w-4 text-blue-200" />;
  }
  if (status === "DELIVERED") {
    return <CheckCheck className="h-4 w-4" />;
  }
  if (status === "SENT") {
    return <Check className="h-4 w-4" />;
  }
  return null;
}
