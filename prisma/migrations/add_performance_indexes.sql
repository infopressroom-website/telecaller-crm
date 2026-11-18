-- Migration: Add Performance Indexes
-- Date: 2026-11-18
-- Purpose: Optimize query performance for frequently accessed tables

-- Lead indexes
CREATE INDEX IF NOT EXISTS "Lead_status_ownerId_createdAt_idx" ON "Lead"("status", "ownerId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Lead_teamId_status_idx" ON "Lead"("teamId", "status");
CREATE INDEX IF NOT EXISTS "Lead_campaignId_sourceId_idx" ON "Lead"("campaignId", "sourceId");
CREATE INDEX IF NOT EXISTS "Lead_primaryMobile_idx" ON "Lead"("primaryMobile");
CREATE INDEX IF NOT EXISTS "Lead_email_idx" ON "Lead"("email");
CREATE INDEX IF NOT EXISTS "Lead_nextFollowUpAt_idx" ON "Lead"("nextFollowUpAt");
CREATE INDEX IF NOT EXISTS "Lead_createdAt_idx" ON "Lead"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Lead_priority_status_idx" ON "Lead"("priority", "status");

-- CallLog indexes
CREATE INDEX IF NOT EXISTS "CallLog_leadId_createdAt_idx" ON "CallLog"("leadId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "CallLog_agentId_startedAt_idx" ON "CallLog"("agentId", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS "CallLog_status_dispositionId_idx" ON "CallLog"("status", "dispositionId");
CREATE INDEX IF NOT EXISTS "CallLog_startedAt_idx" ON "CallLog"("startedAt" DESC);
CREATE INDEX IF NOT EXISTS "CallLog_direction_status_idx" ON "CallLog"("direction", "status");

-- FollowUp indexes
CREATE INDEX IF NOT EXISTS "FollowUp_ownerId_status_dueAt_idx" ON "FollowUp"("ownerId", "status", "dueAt");
CREATE INDEX IF NOT EXISTS "FollowUp_leadId_status_idx" ON "FollowUp"("leadId", "status");
CREATE INDEX IF NOT EXISTS "FollowUp_dueAt_status_idx" ON "FollowUp"("dueAt", "status");
CREATE INDEX IF NOT EXISTS "FollowUp_status_priority_idx" ON "FollowUp"("status", "priority");

-- User indexes
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_status_idx" ON "User"("status");
CREATE INDEX IF NOT EXISTS "User_teamId_idx" ON "User"("teamId");
CREATE INDEX IF NOT EXISTS "User_roleId_idx" ON "User"("roleId");
CREATE INDEX IF NOT EXISTS "User_reportingToId_idx" ON "User"("reportingToId");

-- Session indexes
CREATE INDEX IF NOT EXISTS "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX IF NOT EXISTS "Session_tokenHash_idx" ON "Session"("tokenHash");

-- Notification indexes
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- AuditLog indexes
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt" DESC);

-- LeadAssignment indexes
CREATE INDEX IF NOT EXISTS "LeadAssignment_leadId_createdAt_idx" ON "LeadAssignment"("leadId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "LeadAssignment_toUserId_createdAt_idx" ON "LeadAssignment"("toUserId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "LeadAssignment_method_createdAt_idx" ON "LeadAssignment"("method", "createdAt" DESC);

-- Task indexes
CREATE INDEX IF NOT EXISTS "Task_ownerId_status_idx" ON "Task"("ownerId", "status");
CREATE INDEX IF NOT EXISTS "Task_status_dueAt_idx" ON "Task"("status", "dueAt");
CREATE INDEX IF NOT EXISTS "Task_createdAt_idx" ON "Task"("createdAt" DESC);

-- Team indexes
CREATE INDEX IF NOT EXISTS "Team_leaderId_idx" ON "Team"("leaderId");
CREATE INDEX IF NOT EXISTS "Team_name_idx" ON "Team"("name");

-- Target indexes
CREATE INDEX IF NOT EXISTS "Target_userId_metric_period_idx" ON "Target"("userId", "metric", "period");
CREATE INDEX IF NOT EXISTS "Target_startsOn_endsOn_idx" ON "Target"("startsOn", "endsOn");

-- Incentive indexes
CREATE INDEX IF NOT EXISTS "Incentive_userId_createdAt_idx" ON "Incentive"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Incentive_forDate_idx" ON "Incentive"("forDate");

-- AttendanceLog indexes
CREATE INDEX IF NOT EXISTS "AttendanceLog_userId_date_idx" ON "AttendanceLog"("userId", "date");
CREATE INDEX IF NOT EXISTS "AttendanceLog_date_idx" ON "AttendanceLog"("date" DESC);
CREATE INDEX IF NOT EXISTS "AttendanceLog_shiftId_date_idx" ON "AttendanceLog"("shiftId", "date");

-- QAReview indexes
CREATE INDEX IF NOT EXISTS "QAReview_callId_idx" ON "QAReview"("callId");
CREATE INDEX IF NOT EXISTS "QAReview_reviewerId_createdAt_idx" ON "QAReview"("reviewerId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "QAReview_createdAt_idx" ON "QAReview"("createdAt" DESC);

-- AutomationRule indexes
CREATE INDEX IF NOT EXISTS "AutomationRule_trigger_isEnabled_idx" ON "AutomationRule"("trigger", "isEnabled");
CREATE INDEX IF NOT EXISTS "AutomationRule_isEnabled_idx" ON "AutomationRule"("isEnabled");

-- AutomationLog indexes
CREATE INDEX IF NOT EXISTS "AutomationLog_ruleId_createdAt_idx" ON "AutomationLog"("ruleId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AutomationLog_status_createdAt_idx" ON "AutomationLog"("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AutomationLog_entityType_entityId_idx" ON "AutomationLog"("entityType", "entityId");

-- ImportJob indexes
CREATE INDEX IF NOT EXISTS "ImportJob_creatorId_createdAt_idx" ON "ImportJob"("creatorId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ImportJob_status_idx" ON "ImportJob"("status");

-- Campaign indexes
CREATE INDEX IF NOT EXISTS "Campaign_name_idx" ON "Campaign"("name");

-- LeadSource indexes
CREATE INDEX IF NOT EXISTS "LeadSource_name_idx" ON "LeadSource"("name");

-- Analysis
ANALYZE "Lead";
ANALYZE "CallLog";
ANALYZE "FollowUp";
ANALYZE "User";
ANALYZE "Session";
ANALYZE "Notification";
ANALYZE "AuditLog";

-- Vacuum to reclaim space
VACUUM ANALYZE;
