import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";

type Handler<Ctx> = (req: Request, ctx: Ctx) => Promise<Response>;

/**
 * Wraps a route handler with centralized error handling so every API returns
 * the same shape: { error: { code, message, details? } }.
 * Internal errors are logged server-side and never leak stack traces to clients.
 */
export function route<Ctx = unknown>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: err.flatten() } },
          { status: 400 },
        );
      }
      if (err instanceof AppError) {
        return NextResponse.json(
          { error: { code: err.code, message: err.message, details: err.details } },
          { status: err.status },
        );
      }
      console.error("Unhandled API error:", err);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
        { status: 500 },
      );
    }
  };
}

export const ok = <T>(data: T, init?: ResponseInit) => NextResponse.json({ data }, init);
