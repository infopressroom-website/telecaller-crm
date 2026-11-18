import { z } from "zod";
import { mobileSchema } from "./common";

const blank = <T extends z.ZodTypeAny>(s: T) => z.union([z.literal("").transform(() => undefined), s]).optional();
export const ROLE_VALUES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "TEAM_LEADER", "QA_MANAGER", "HR_OPERATIONS", "TELECALLER", "VIEWER"] as const;

export const employeeSchema = z.object({
  name: z.string().trim().min(2, "Enter the full name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  phone: blank(mobileSchema),
  employeeId: blank(z.string().trim().max(30).regex(/^[A-Za-z0-9._-]+$/, "Use letters, digits, dots, dashes or underscores")),
  roleKey: z.enum(ROLE_VALUES),
  teamId: blank(z.string().min(1).max(40)),
  reportingToId: blank(z.string().min(1).max(40)),
  joinedAt: blank(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).default("ACTIVE"),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

export const teamSchema = z.object({ name: z.string().trim().min(2, "Name the team").max(60), leaderId: blank(z.string().min(1).max(40)) });

export const shiftSchema = z.object({
  name: z.string().trim().min(2).max(60),
  startTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Use HH:mm"),
  endTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Use HH:mm"),
  graceMinutes: z.coerce.number().int().min(0).max(120).default(10),
});

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
export const leaveSchema = z.object({ userId: z.string().min(1).max(40), status: z.enum(["ON_LEAVE", "ABSENT", "HOLIDAY", "HALF_DAY"]), from: day, to: day, notes: z.string().trim().max(300).optional().transform((v) => v || undefined) });

export const targetSchema = z.object({
  userId: blank(z.string().min(1).max(40)), teamId: blank(z.string().min(1).max(40)),
  metric: z.enum(["CALL_ATTEMPTS", "CONNECTED_CALLS", "INTERESTED_LEADS", "CONVERSIONS", "FOLLOWUPS_COMPLETED"]),
  period: z.enum(["DAILY", "WEEKLY", "MONTHLY"]), value: z.coerce.number().int().min(1).max(1_000_000),
  startsOn: day, endsOn: blank(day),
}).refine((v) => !!v.userId !== !!v.teamId, { message: "Choose either one person or one team", path: ["userId"] });

export const slabSchema = z.object({
  id: blank(z.string().min(1).max(40)), name: z.string().trim().min(2).max(60),
  metric: z.enum(["CALL_ATTEMPTS", "CONNECTED_CALLS", "INTERESTED_LEADS", "CONVERSIONS", "FOLLOWUPS_COMPLETED"]),
  minValue: z.coerce.number().int().min(0).max(1_000_000), maxValue: blank(z.coerce.number().int().min(0).max(1_000_000)),
  amountRupees: z.coerce.number().min(0).max(10_000_000), isActive: z.boolean().default(true),
}).refine((v) => v.maxValue === undefined || v.maxValue >= v.minValue, { message: "Maximum must be at least the minimum", path: ["maxValue"] });
