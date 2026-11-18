import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, type AuthUser } from "@/lib/auth/rbac";
import { AnthropicProvider } from "@/lib/ai/anthropic";
import { AIError, type AnalysisProvider } from "@/lib/ai/provider";
import { AppError } from "@/lib/errors";
import { audit } from "./audit-service";
import { getCall } from "./call-service";

const KEY = "ai";
const MAX_TRANSCRIPT = 30_000;

async function enabled() {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  return !!(row?.value as { enabled?: boolean } | null)?.enabled;
}

export async function getAiStatus(user: AuthUser) {
  assertCan(user, "settings", "MANAGE");
  return { enabled: await enabled(), keyConfigured: !!process.env.ANTHROPIC_API_KEY, modelConfigured: !!process.env.AI_MODEL, model: process.env.AI_MODEL ?? null };
}

export async function setAiEnabled(user: AuthUser, on: boolean, acknowledged: boolean) {
  assertCan(user, "settings", "MANAGE");
  if (on && !acknowledged) throw new AppError("VALIDATION_ERROR", "Tick the box to confirm you understand that transcripts are sent to the AI provider.");
  if (on && (!process.env.ANTHROPIC_API_KEY || !process.env.AI_MODEL)) throw new AppError("VALIDATION_ERROR", "Set ANTHROPIC_API_KEY and AI_MODEL on the server first.");
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: { enabled: on } }, update: { value: { enabled: on } } });
  await audit({ actorId: user.id, action: "ai.toggle", entityType: "Setting", entityId: KEY, after: { enabled: on } });
}

async function provider(): Promise<AnalysisProvider> {
  if (!(await enabled())) throw new AppError("CONFLICT", "AI analysis is switched off. An administrator can enable it in Settings → AI.");
  const key = process.env.ANTHROPIC_API_KEY, model = process.env.AI_MODEL;
  if (!key || !model) throw new AppError("CONFLICT", "AI analysis isn't configured on the server.");
  return new AnthropicProvider(key, model);
}

/** Transcripts are typed or pasted by QA staff. Automatic speech-to-text is not implemented. */
export async function saveTranscript(user: AuthUser, callId: string, text: string) {
  assertCan(user, "qa", "CREATE");
  await getCall(user, callId);
  const clean = text.trim();
  if (clean.length < 20) throw new AppError("VALIDATION_ERROR", "The transcript is too short to be useful.");
  if (clean.length > 50_000) throw new AppError("VALIDATION_ERROR", "The transcript is too long (50,000 characters at most).");
  await db.callTranscript.upsert({ where: { callId }, create: { callId, text: clean, source: "manual", createdById: user.id }, update: { text: clean, source: "manual", createdById: user.id } });
  await audit({ actorId: user.id, action: "qa.transcript", entityType: "CallLog", entityId: callId });
}

export async function analyseCall(user: AuthUser, callId: string) {
  assertCan(user, "qa", "CREATE");
  await getCall(user, callId);
  const t = await db.callTranscript.findUnique({ where: { callId } });
  if (!t) throw new AppError("VALIDATION_ERROR", "Add a transcript first.");
  const p = await provider();
  try {
    const r = await p.analyse(t.text.slice(0, MAX_TRANSCRIPT));
    const a = await db.callAnalysis.create({ data: { callId, kind: "SUMMARY", result: r as Prisma.InputJsonValue, confidence: r.confidence, model: `${p.name}:${p.model}`, requestedById: user.id } });
    await audit({ actorId: user.id, action: "ai.analyse", entityType: "CallLog", entityId: callId, after: { analysisId: a.id } });
    return a.id;
  } catch (e) {
    if (e instanceof AIError) throw new AppError("CONFLICT", e.message);
    throw e;
  }
}

/** A human accepts or rejects the suggestion. Nothing is acted on automatically. */
export async function reviewAnalysis(user: AuthUser, id: string, accept: boolean) {
  assertCan(user, "qa", "CREATE");
  const a = await db.callAnalysis.findUnique({ where: { id } });
  if (!a) throw new AppError("NOT_FOUND", "Analysis not found");
  await getCall(user, a.callId);
  const won = await db.callAnalysis.updateMany({ where: { id, status: "PENDING_REVIEW" }, data: { status: accept ? "ACCEPTED" : "REJECTED", reviewedById: user.id, reviewedAt: new Date() } });
  if (won.count !== 1) throw new AppError("CONFLICT", "Already reviewed.");
}
