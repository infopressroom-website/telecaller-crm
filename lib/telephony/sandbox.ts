import "server-only";
import { randomUUID } from "node:crypto";
import type { NormalizedCallEvent, PlaceCallInput, PlaceCallResult, TelephonyProvider } from "./provider";

/** Development-only stand-in. It contacts nobody and places no call; everything it produces is labelled SANDBOX. */
export class SandboxProvider implements TelephonyProvider {
  readonly key = "sandbox";
  readonly label = "Sandbox (no real calls)";
  readonly isSandbox = true;
  async placeCall(_i: PlaceCallInput): Promise<PlaceCallResult> {
    return { providerCallId: `sandbox-${randomUUID()}`, rawStatus: "sandbox-queued" };
  }
  async testCredentials() {
    return { ok: true, message: "Sandbox mode: no provider was contacted." };
  }
  async getCallDetails(_id: string): Promise<NormalizedCallEvent | null> {
    return null;
  }
}
