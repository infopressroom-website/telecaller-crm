/**
 * Environment variable validation and type-safe access
 * Validates required environment variables on application startup
 */

import { z } from "zod";

// Define the schema for environment variables
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid database connection URL"),

  // Application
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url("APP_URL must be a valid URL").default("http://localhost:3000"),

  // Authentication
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters for security")
    .optional()
    .transform((val) => val || undefined),

  // Development seed password (only required in development)
  SEED_DEV_PASSWORD: z
    .string()
    .min(8, "SEED_DEV_PASSWORD must be at least 8 characters")
    .optional()
    .transform((val) => val || undefined),

  // Optional: Redis (for caching and session storage)
  REDIS_URL: z.string().url().optional().or(z.literal("")),

  // Optional: Telephony
  TELEPHONY_PROVIDER: z.enum(["exotel", ""]).optional().or(z.literal("")),
  EXOTEL_ACCOUNT_SID: z.string().optional().or(z.literal("")),
  EXOTEL_API_KEY: z.string().optional().or(z.literal("")),
  EXOTEL_API_TOKEN: z.string().optional().or(z.literal("")),
  EXOTEL_WEBHOOK_SECRET: z.string().min(24).optional().or(z.literal("")),

  // Optional: Storage
  STORAGE_BUCKET: z.string().optional().or(z.literal("")),

  // Optional: Cron/Automation
  CRON_SECRET: z.string().min(24).optional().or(z.literal("")),

  // Optional: AI/LLM
  ANTHROPIC_API_KEY: z.string().optional().or(z.literal("")),
  AI_MODEL: z.string().optional().or(z.literal("")),

  // Optional: Pusher (Real-time)
  PUSHER_APP_ID: z.string().optional().or(z.literal("")),
  PUSHER_KEY: z.string().optional().or(z.literal("")),
  PUSHER_SECRET: z.string().optional().or(z.literal("")),
  PUSHER_CLUSTER: z.string().optional().or(z.literal("")),
  NEXT_PUBLIC_PUSHER_KEY: z.string().optional().or(z.literal("")),
  NEXT_PUBLIC_PUSHER_CLUSTER: z.string().optional().or(z.literal("")),
  
  // Optional: Email (Resend)
  RESEND_API_KEY: z.string().optional().or(z.literal("")),
  EMAIL_FROM: z.string().optional().or(z.literal("")),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

// Environment-specific validation rules
const developmentExtras = z.object({
  SEED_DEV_PASSWORD: z.string().min(8),
});

const productionExtras = z.object({
  AUTH_SECRET: z.string().min(32),
  // Add other production-required vars here
});

/**
 * Parse and validate environment variables
 * Throws error with detailed message if validation fails
 */
function parseEnv() {
  try {
    const baseEnv = envSchema.parse(process.env);

    // Additional validation based on NODE_ENV
    if (baseEnv.NODE_ENV === "production") {
      const prodValidation = productionExtras.safeParse(process.env);
      if (!prodValidation.success) {
        throw new Error(
          `Production environment validation failed:\n${prodValidation.error.issues
            .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
            .join("\n")}`
        );
      }
    }

    if (baseEnv.NODE_ENV === "development") {
      const devValidation = developmentExtras.safeParse(process.env);
      if (!devValidation.success) {
        console.warn(
          "⚠️  Development environment warning:",
          devValidation.error.issues.map((i) => i.message).join(", ")
        );
      }
    }

    return baseEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment variable validation failed:");
      error.issues.forEach((issue) => {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      });
      console.error("\nPlease check your .env file and ensure all required variables are set.");
    }
    throw error;
  }
}

/**
 * Validated and type-safe environment variables
 * Use this instead of process.env for type safety
 */
export const env = parseEnv();

/**
 * Helper to check if we're in a specific environment
 */
export const isDevelopment = env.NODE_ENV === "development";
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

/**
 * Helper to get optional environment variables safely
 */
export function getOptionalEnv(key: string): string | undefined {
  const value = process.env[key];
  return value && value !== "" ? value : undefined;
}

/**
 * Helper to check if a feature is enabled
 */
export const features = {
  redis: Boolean(env.REDIS_URL),
  telephony: Boolean(env.TELEPHONY_PROVIDER),
  ai: Boolean(env.ANTHROPIC_API_KEY),
  storage: Boolean(env.STORAGE_BUCKET),
  automation: Boolean(env.CRON_SECRET),
  pusher: Boolean(env.PUSHER_APP_ID && env.PUSHER_KEY && env.PUSHER_SECRET && env.PUSHER_CLUSTER),
} as const;

/**
 * Log environment status on startup (development only)
 */
if (isDevelopment) {
  console.log("🔧 Environment Configuration:");
  console.log(`   NODE_ENV: ${env.NODE_ENV}`);
  console.log(`   APP_URL: ${env.APP_URL}`);
  console.log(`   Database: ${env.DATABASE_URL.split("@")[1] || "configured"}`);
  console.log(`   Features:`);
  console.log(`     - Redis: ${features.redis ? "✓" : "✗"}`);
  console.log(`     - Telephony: ${features.telephony ? "✓" : "✗"}`);
  console.log(`     - AI: ${features.ai ? "✓" : "✗"}`);
  console.log(`     - Storage: ${features.storage ? "✓" : "✗"}`);
  console.log(`     - Automation: ${features.automation ? "✓" : "✗"}`);
  console.log(`     - Pusher: ${features.pusher ? "✓" : "✗"}`);
}
