"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ConfigForm({ enabled }: { enabled: boolean }) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [saving, setSaving] = useState(false);

  async function handleToggle(checked: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/whatsapp/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });

      if (!res.ok) throw new Error("Failed to save");

      setIsEnabled(checked);
      alert("Settings saved successfully");
    } catch (error) {
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(e) => handleToggle(e.target.checked)}
          disabled={saving}
          className="h-4 w-4"
        />
        <span className="text-sm">Enable WhatsApp messaging</span>
      </label>
    </div>
  );
}

export function TestCredentialsButton() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleTest() {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch("/api/whatsapp/test", {
        method: "POST",
      });

      const json = await res.json();
      
      if (json.data) {
        setResult(json.data);
      } else {
        setResult({ ok: false, message: "Test failed" });
      }
    } catch (error) {
      setResult({ ok: false, message: "Could not connect to server" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      <Button onClick={handleTest} disabled={testing}>
        {testing ? "Testing..." : "Test Credentials"}
      </Button>
      {result && (
        <p className={`mt-2 text-sm ${result.ok ? "text-green-700" : "text-red-700"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}

export function SyncTemplatesButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/whatsapp/templates/sync", {
        method: "POST",
      });

      const json = await res.json();
      
      if (json.data) {
        setResult(`Synced ${json.data.synced} templates successfully`);
      } else {
        setResult("Sync failed");
      }
    } catch (error) {
      setResult("Could not sync templates");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <Button onClick={handleSync} disabled={syncing}>
        {syncing ? "Syncing..." : "Sync Templates"}
      </Button>
      {result && (
        <p className="mt-2 text-sm text-slate-700">
          {result}
        </p>
      )}
    </div>
  );
}
