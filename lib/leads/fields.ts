// Pure definitions shared by server and client. Values must match the Prisma enums.
export const LEAD_STATUSES = [
  "NEW", "ASSIGNED", "ATTEMPTED", "CONNECTED", "INTERESTED", "FOLLOW_UP",
  "QUALIFIED", "CONVERTED", "LOST", "INVALID", "DND",
] as const;
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export const STATUS_LABELS: Record<LeadStatusValue, string> = {
  NEW: "New", ASSIGNED: "Assigned", ATTEMPTED: "Attempted", CONNECTED: "Connected",
  INTERESTED: "Interested", FOLLOW_UP: "Follow-up", QUALIFIED: "Qualified", CONVERTED: "Converted",
  LOST: "Lost", INVALID: "Invalid", DND: "Do not disturb",
};

export const LEAD_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type LeadPriorityValue = (typeof LEAD_PRIORITIES)[number];
export const PRIORITY_LABELS: Record<LeadPriorityValue, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };

export const LEAD_SORTS = ["created_desc", "created_asc", "name_asc", "followup_asc", "updated_desc"] as const;
export type LeadSort = (typeof LEAD_SORTS)[number];
export const SORT_LABELS: Record<LeadSort, string> = {
  created_desc: "Newest first", created_asc: "Oldest first", name_asc: "Name A–Z",
  followup_asc: "Next follow-up", updated_desc: "Recently updated",
};

export const IMPORT_FIELDS = [
  { key: "name", label: "Name", required: true, aliases: ["name", "full name", "customer name", "lead name", "contact name"] },
  { key: "primaryMobile", label: "Primary mobile", required: true, aliases: ["mobile", "phone", "primary mobile", "mobile number", "phone number", "contact number", "contact no", "cell"] },
  { key: "alternateMobile", label: "Alternate mobile", required: false, aliases: ["alternate mobile", "alt mobile", "alternate phone", "secondary mobile", "alternate number", "whatsapp"] },
  { key: "email", label: "Email", required: false, aliases: ["email", "email id", "email address", "e mail"] },
  { key: "city", label: "City", required: false, aliases: ["city", "town"] },
  { key: "state", label: "State", required: false, aliases: ["state", "province"] },
  { key: "source", label: "Source (name)", required: false, aliases: ["source", "lead source"] },
  { key: "priority", label: "Priority", required: false, aliases: ["priority"] },
  { key: "notes", label: "Notes", required: false, aliases: ["notes", "remarks", "comment", "comments"] },
] as const;
export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export const IMPORT_FIELD_KEYS = IMPORT_FIELDS.map((f) => f.key) as ImportFieldKey[];
