"use client";

import { useState, useEffect, useRef } from "react";
import { MessageComposer } from "./message-composer";
import { MessageBubble } from "./message-bubble";
import { TemplateSelector } from "./template-selector";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Message = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  messageType: string;
  content: string | null;
  status: string;
  templateName: string | null;
  mediaUrl: string | null;
  createdAt: string;
  agent: { name: string } | null;
};

type Props = {
  leadId: string;
  leadName: string;
};

export function WhatsAppChat({ leadId, leadName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
  }, [leadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function loadMessages() {
    setLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/messages/${leadId}`);
      const json = await res.json();
      if (json.data) {
        setMessages(json.data.messages);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(text: string) {
    setSending(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, text }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to send");
      }

      await loadMessages();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleSendTemplate(
    templateName: string,
    templateLanguage: string,
    params: string[]
  ) {
    setSending(true);
    try {
      const res = await fetch("/api/whatsapp/templates/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, templateName, templateLanguage, params }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to send");
      }

      setShowTemplates(false);
      await loadMessages();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to send template");
    } finally {
      setSending(false);
    }
  }

  function scrollToBottom() {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }

  return (
    <Card className="flex h-[600px] flex-col">
      <div className="border-b p-4">
        <h3 className="font-semibold">WhatsApp Chat with {leadName}</h3>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            No messages yet. Start the conversation with a template.
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
      </div>

      <div className="border-t p-4">
        {showTemplates ? (
          <TemplateSelector
            onSelect={handleSendTemplate}
            onCancel={() => setShowTemplates(false)}
            disabled={sending}
          />
        ) : (
          <div className="space-y-2">
            <MessageComposer onSend={handleSend} disabled={sending} />
            <Button
              variant="ghost"
              onClick={() => setShowTemplates(true)}
              disabled={sending}
            >
              Send Template
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
