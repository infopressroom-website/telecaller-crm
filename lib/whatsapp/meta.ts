import "server-only";
import type { WhatsAppProvider, WhatsAppMessageInput, WhatsAppSendResult } from "./provider";
import { WhatsAppProviderError } from "./provider";

export type MetaCredentials = {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
};

export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly key = "meta";
  readonly label = "Meta WhatsApp Business";
  private readonly baseUrl = "https://graph.facebook.com/v21.0";

  constructor(private readonly creds: MetaCredentials) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.creds.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  async sendMessage(input: WhatsAppMessageInput): Promise<WhatsAppSendResult> {
    const url = `${this.baseUrl}/${this.creds.phoneNumberId}/messages`;
    
    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to.replace(/\D/g, ""), // Meta expects digits only
    };

    if (input.type === "text") {
      body.type = "text";
      body.text = { body: input.text, preview_url: true };
    } else if (input.type === "template") {
      body.type = "template";
      body.template = {
        name: input.templateName,
        language: { code: input.templateLanguage || "en_US" },
        components: input.templateParams
          ? [
              {
                type: "body",
                parameters: input.templateParams.map((value) => ({
                  type: "text",
                  text: value,
                })),
              },
            ]
          : [],
      };
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data.error?.message || "Unknown error";
        if (res.status === 401 || res.status === 403) {
          throw new WhatsAppProviderError(
            `Meta rejected credentials: ${errorMessage}`,
            "rejected"
          );
        }
        if (res.status === 429) {
          throw new WhatsAppProviderError(
            "Rate limit exceeded. Try again later.",
            "rate_limited"
          );
        }
        if (res.status === 400) {
          throw new WhatsAppProviderError(
            `Invalid request: ${errorMessage}`,
            "invalid_template"
          );
        }
        throw new WhatsAppProviderError(
          `Meta API error (${res.status}): ${errorMessage}`,
          "unreachable"
        );
      }

      return {
        externalId: data.messages?.[0]?.id || "",
        status: "sent",
      };
    } catch (error) {
      if (error instanceof WhatsAppProviderError) throw error;
      throw new WhatsAppProviderError(
        "Could not reach Meta WhatsApp API",
        "unreachable"
      );
    }
  }

  async testCredentials(): Promise<{ ok: boolean; message: string }> {
    const url = `${this.baseUrl}/${this.creds.phoneNumberId}?fields=display_phone_number,verified_name`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          message: "Meta rejected the access token. Check credentials.",
        };
      }

      if (res.ok) {
        const data = await res.json();
        return {
          ok: true,
          message: `Connected to ${data.verified_name} (${data.display_phone_number})`,
        };
      }

      return {
        ok: false,
        message: `Meta API returned HTTP ${res.status}`,
      };
    } catch {
      return {
        ok: false,
        message: "Could not reach Meta API. Check network and credentials.",
      };
    }
  }

  async listTemplates() {
    const url = `${this.baseUrl}/${this.creds.businessAccountId}/message_templates?fields=id,name,category,language,status,components&limit=250`;
    
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new WhatsAppProviderError(
          `Could not fetch templates (HTTP ${res.status})`,
          "unreachable"
        );
      }

      const data = await res.json();
      return (data.data || []).map((t: any) => ({
        externalId: t.id,
        name: t.name,
        category: t.category,
        language: t.language,
        status: t.status,
        content: t.components || [],
      }));
    } catch (error) {
      if (error instanceof WhatsAppProviderError) throw error;
      throw new WhatsAppProviderError(
        "Could not fetch templates from Meta",
        "unreachable"
      );
    }
  }

  async getMediaUrl(mediaId: string): Promise<string | null> {
    const url = `${this.baseUrl}/${mediaId}`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) return null;

      const data = await res.json();
      return data.url || null;
    } catch {
      return null;
    }
  }
}
