"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

type Props = {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
};

export function MessageComposer({ onSend, disabled }: Props) {
  const [text, setText] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || disabled) return;

    const message = text.trim();
    setText("");
    await onSend(message);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        disabled={disabled}
        rows={2}
        className="flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      <Button type="submit" disabled={!text.trim() || disabled} className="self-end">
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
