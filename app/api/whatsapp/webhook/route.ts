import { NextRequest, NextResponse } from "next/server";
import { route } from "@/lib/api";
import { ingestWhatsAppWebhook } from "@/services/whatsapp-service";
import { parseMetaWebhook } from "@/lib/whatsapp/meta-parse";

/**
 * Meta WhatsApp webhook handler.
 * GET: Webhook verification (Meta subscription setup)
 * POST: Incoming messages and status updates
 */

export async function GET(req: NextRequest) {
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || "";
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export const POST = route(async (req: Request) => {
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || "";
  
  // Optional: verify token in header or body
  // Meta doesn't use signature verification for Cloud API, just the verify token during subscription

  const raw = await req.json();
  const events = parseMetaWebhook(raw);

  for (const event of events) {
    await ingestWhatsAppWebhook(event, raw);
  }

  return new NextResponse("OK", { status: 200 });
});
