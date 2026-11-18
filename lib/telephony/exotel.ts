import "server-only";
import { API_HOSTS, type TelephonySettings } from "./config";
import { parseExotelCallDetails } from "./exotel-parse";
import {
  ProviderError, type NormalizedCallEvent, type PlaceCallInput, type PlaceCallResult, type TelephonyProvider,
} from "./provider";

export type ExotelCredentials = { sid: string; apiKey: string; apiToken: string };

/**
 * Exotel adapter, written from Exotel's public API documentation (Connect Two Numbers, StatusCallback, Call Details).
 * IT HAS NOT BEEN TESTED AGAINST A REAL ACCOUNT. Use Settings → Telephony to verify before relying on it.
 * Secrets are only ever used here, server-side, in an Authorization header; they are never logged or returned.
 */
export class ExotelProvider implements TelephonyProvider {
  readonly key = "exotel";
  readonly label = "Exotel";
  readonly isSandbox = false;
  constructor(private readonly creds: ExotelCredentials, private readonly settings: TelephonySettings) {}

  private base() {
    return `https://${API_HOSTS[this.settings.region]}/v1/Accounts/${encodeURIComponent(this.creds.sid)}`;
  }
  private headers(extra: Record<string, string> = {}) {
    const basic = Buffer.from(`${this.creds.apiKey}:${this.creds.apiToken}`).toString("base64");
    return { Authorization: `Basic ${basic}`, Accept: "application/json", ...extra };
  }

  private async request(url: string, init: RequestInit): Promise<{ status: number; body: string }> {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000), redirect: "error" });
      return { status: res.status, body: (await res.text()).slice(0, 5000) };
    } catch {
      // No details on purpose: the URL and headers must never end up in an error message.
      throw new ProviderError("The telephony provider could not be reached.", "unreachable");
    }
  }

  async placeCall(i: PlaceCallInput): Promise<PlaceCallResult> {
    const form = new URLSearchParams({
      From: i.agentNumber, To: i.customerNumber, CallerId: i.callerId, Record: String(i.record),
      StatusCallback: i.statusCallbackUrl, "StatusCallbackEvents[0]": "terminal", StatusCallbackContentType: "application/json",
      CustomField: i.customField.slice(0, 128),
    });
    const { status, body } = await this.request(`${this.base()}/Calls/connect`, {
      method: "POST", headers: this.headers({ "Content-Type": "application/x-www-form-urlencoded" }), body: form,
    });
    if (status === 401 || status === 403) throw new ProviderError("The provider rejected our credentials.", "rejected");
    if (status === 400 || status === 422) throw new ProviderError(`The provider rejected the request (${safeSnippet(body)}).`, "rejected");
    if (status >= 500) throw new ProviderError("The telephony provider had an internal error.", "unreachable");
    if (status < 200 || status >= 300) throw new ProviderError(`Unexpected response from the provider (HTTP ${status}).`, "unexpected");

    const parsed = parseExotelCallDetails(body, this.settings.utcOffsetMinutes);
    if (!parsed) throw new ProviderError("The provider accepted the request but returned no call ID, so the call can't be tracked.", "unexpected");
    return { providerCallId: parsed.providerCallId, rawStatus: parsed.rawStatus || "queued" };
  }

  async testCredentials() {
    const { status } = await this.request(`${this.base()}/Calls?PageSize=1`, { method: "GET", headers: this.headers() });
    if (status === 401 || status === 403) return { ok: false, message: "Exotel rejected the credentials (check the account SID, API key, API token and region)." };
    if (status >= 200 && status < 300) return { ok: true, message: "Exotel accepted the credentials. This does not yet prove calls can be placed: run the test call next." };
    return { ok: false, message: `Exotel answered with HTTP ${status}. Check the region and account SID.` };
  }

  async getCallDetails(providerCallId: string): Promise<NormalizedCallEvent | null> {
    const { status, body } = await this.request(`${this.base()}/Calls/${encodeURIComponent(providerCallId)}`, { method: "GET", headers: this.headers() });
    if (status === 404) return null;
    if (status < 200 || status >= 300) throw new ProviderError(`Call lookup failed (HTTP ${status}).`, "unexpected");
    return parseExotelCallDetails(body, this.settings.utcOffsetMinutes);
  }
}

const safeSnippet = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
