// Provider-neutral contract. Vendor code (Exotel today) lives behind this interface and nowhere else.

export type ProviderCallStatus = "in-progress" | "completed" | "failed" | "busy" | "no-answer" | "canceled" | "unknown";

export type NormalizedCallEvent = {
  provider: string;
  providerCallId: string;
  /** Our own CallLog id, echoed back by the provider (CustomField on Exotel). */
  customField?: string;
  status: ProviderCallStatus;
  rawStatus: string;
  direction: "INBOUND" | "OUTBOUND";
  from?: string;
  to?: string;
  startedAt?: Date;
  endedAt?: Date;
  /** Talk time in seconds when the provider reports it, otherwise total call time. */
  durationSec?: number;
  recordingUrl?: string;
  occurredAt: Date;
  /** Identical replays produce identical keys, which is what makes duplicate webhooks harmless. */
  dedupeKey: string;
};

export type PlaceCallInput = {
  agentNumber: string; // E.164, e.g. +919876543210. The provider rings this first.
  customerNumber: string;
  callerId: string; // the business number (ExoPhone) shown/used for the call
  customField: string;
  record: boolean;
  statusCallbackUrl: string;
};
export type PlaceCallResult = { providerCallId: string; rawStatus: string };

export class ProviderError extends Error {
  constructor(message: string, readonly kind: "rejected" | "unreachable" | "unexpected" | "unconfigured") {
    super(message);
    this.name = "ProviderError";
  }
}

export interface TelephonyProvider {
  readonly key: string;
  readonly label: string;
  readonly isSandbox: boolean;
  placeCall(input: PlaceCallInput): Promise<PlaceCallResult>;
  /** Checks that the credentials are accepted. It does NOT prove calls can be placed. */
  testCredentials(): Promise<{ ok: boolean; message: string }>;
  /** Fetches the latest state of a call (used to recover from missed webhooks). */
  getCallDetails(providerCallId: string): Promise<NormalizedCallEvent | null>;
}
