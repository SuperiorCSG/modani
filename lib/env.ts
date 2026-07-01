import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));

const envSchema = z.object({
  TARGET_SITE_URL: z.string().url().default("https://caringcompanionsmacon.clearcareonline.com/"),
  TARGET_SITE_USERNAME: z.string().optional(),
  TARGET_SITE_PASSWORD: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  SESSION_SECRET: z.string().min(32).optional(),
  SIGNATURE_TEMPLATE: z.string().default("// {{careManagerName}} //"),
  AUTOMATION_CAPTURE_SNAPSHOTS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  ENABLE_MOCK_PREVIEW: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  NEXT_PUBLIC_APP_URL: optionalUrl
});

export const env = envSchema.parse(process.env);

export function requireEnv(name: keyof typeof env): string {
  const value = env[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
