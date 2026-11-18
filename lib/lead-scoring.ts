/**
 * Lead Scoring System
 * 
 * Calculates a 0-100 score for leads based on multiple factors:
 * - Lead source quality (10-20 points)
 * - Engagement level (20-30 points)
 * - Priority (10-20 points)
 * - Recency (0-10 points)
 * - Call success rate (10-20 points)
 */

import { Lead, CallLog, CallStatus, LeadPriority, LeadStatus } from '@prisma/client';

export interface LeadWithCalls extends Lead {
  callLogs?: CallLog[];
}

export interface LeadScore {
  total: number;
  breakdown: {
    source: number;
    engagement: number;
    priority: number;
    recency: number;
    callSuccess: number;
  };
  grade: 'HOT' | 'WARM' | 'COLD';
}

/**
 * Calculate comprehensive lead score
 */
export function calculateLeadScore(lead: LeadWithCalls): LeadScore {
  const breakdown = {
    source: calculateSourceScore(lead),
    engagement: calculateEngagementScore(lead),
    priority: calculatePriorityScore(lead),
    recency: calculateRecencyScore(lead),
    callSuccess: calculateCallSuccessScore(lead),
  };

  const total = Math.min(
    100,
    Math.round(
      breakdown.source +
      breakdown.engagement +
      breakdown.priority +
      breakdown.recency +
      breakdown.callSuccess
    )
  );

  const grade = getScoreGrade(total);

  return { total, breakdown, grade };
}

/**
 * Score based on lead source quality
 * Premium sources get higher scores
 */
function calculateSourceScore(lead: Lead): number {
  const sourceScores: Record<string, number> = {
    REFERRAL: 20,
    WEBSITE: 18,
    SOCIAL_MEDIA: 15,
    EMAIL_CAMPAIGN: 14,
    PAID_ADS: 12,
    COLD_CALL: 10,
    OTHER: 10,
  };

  return sourceScores[lead.source] || 10;
}

/**
 * Score based on engagement (calls, status changes)
 */
function calculateEngagementScore(lead: LeadWithCalls): number {
  const callLogs = lead.callLogs || [];
  let score = 0;

  // Base engagement points
  if (callLogs.length === 0) return 5; // New lead

  // Points for call attempts (max 10 points)
  score += Math.min(10, callLogs.length * 2);

  // Points for status progression (max 20 points)
  const statusScores: Record<LeadStatus, number> = {
    NEW: 0,
    ASSIGNED: 2,
    ATTEMPTED: 5,
    CONNECTED: 10,
    INTERESTED: 15,
    FOLLOW_UP: 12,
    QUALIFIED: 18,
    CONVERTED: 20,
    LOST: 0,
    INVALID: 0,
    DND: 0,
  };

  score += statusScores[lead.status] || 0;

  return Math.min(30, score);
}

/**
 * Score based on lead priority
 */
function calculatePriorityScore(lead: Lead): number {
  const priorityScores: Record<LeadPriority, number> = {
    URGENT: 20,
    HIGH: 15,
    MEDIUM: 10,
    LOW: 5,
  };

  return priorityScores[lead.priority] || 10;
}

/**
 * Score based on recency (last contact)
 */
function calculateRecencyScore(lead: LeadWithCalls): number {
  const callLogs = lead.callLogs || [];
  
  if (callLogs.length === 0) {
    // Check lead creation date
    const daysSinceCreation = getDaysSince(lead.createdAt);
    if (daysSinceCreation <= 1) return 10; // Very new
    if (daysSinceCreation <= 7) return 7;
    if (daysSinceCreation <= 30) return 4;
    return 2;
  }

  // Get most recent call
  const lastCall = callLogs.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];

  const daysSinceLastCall = getDaysSince(lastCall.createdAt);

  if (daysSinceLastCall <= 1) return 10;
  if (daysSinceLastCall <= 3) return 8;
  if (daysSinceLastCall <= 7) return 5;
  if (daysSinceLastCall <= 14) return 3;
  if (daysSinceLastCall <= 30) return 1;
  return 0;
}

/**
 * Score based on call success rate
 */
function calculateCallSuccessScore(lead: LeadWithCalls): number {
  const callLogs = lead.callLogs || [];
  
  if (callLogs.length === 0) return 10; // Neutral for new leads

  const connectedCalls = callLogs.filter(
    (call) => call.status === CallStatus.COMPLETED
  ).length;

  const successRate = connectedCalls / callLogs.length;

  if (successRate >= 0.8) return 20;
  if (successRate >= 0.6) return 16;
  if (successRate >= 0.4) return 12;
  if (successRate >= 0.2) return 8;
  return 5;
}

/**
 * Get score grade (HOT/WARM/COLD)
 */
function getScoreGrade(score: number): 'HOT' | 'WARM' | 'COLD' {
  if (score >= 70) return 'HOT';
  if (score >= 40) return 'WARM';
  return 'COLD';
}

/**
 * Helper: Calculate days since a date
 */
function getDaysSince(date: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get score color for UI
 */
export function getScoreColor(score: number): string {
  if (score >= 70) return 'text-red-600 bg-red-50';
  if (score >= 40) return 'text-yellow-600 bg-yellow-50';
  return 'text-blue-600 bg-blue-50';
}

/**
 * Get score icon for UI
 */
export function getScoreIcon(grade: 'HOT' | 'WARM' | 'COLD'): string {
  return {
    HOT: '🔥',
    WARM: '🌡️',
    COLD: '❄️',
  }[grade];
}
