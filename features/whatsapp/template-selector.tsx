"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

type Template = {
  id: string;
  name: string;
  category: string;
  language: string;
  content: any;
  variables: string[];
};

type Props = {
  onSelect: (templateName: string, language: string, params: string[]) => Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
};

export function TemplateSelector({ onSelect, onCancel, disabled }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Template | null>(null);
  const [params, setParams] = useState<string[]>([]);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (selected) {
      setParams(Array(selected.variables.length).fill(""));
    }
  }, [selected]);

  async function loadTemplates() {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/templates");
      const json = await res.json();
      if (json.data) {
        setTemplates(json.data.templates);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!selected || disabled) return;

    await onSelect(selected.name, selected.language, params);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Template</label>
        <select
          value={selected?.id || ""}
          onChange={(e) => setSelected(templates.find((t) => t.id === e.target.value) || null)}
          className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">Select a template</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.category})
            </option>
          ))}
        </select>
      </div>

      {selected && selected.variables.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Variables</label>
          {selected.variables.map((variable, index) => (
            <input
              key={index}
              placeholder={`Variable ${index + 1}`}
              value={params[index] || ""}
              onChange={(e) => {
                const newParams = [...params];
                newParams[index] = e.target.value;
                setParams(newParams);
              }}
              disabled={disabled}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
            />
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSend} disabled={!selected || disabled}>
          Send Template
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={disabled}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
