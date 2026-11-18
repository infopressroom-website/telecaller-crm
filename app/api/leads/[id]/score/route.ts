import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { assertCan } from '@/lib/auth/rbac';
import { db } from '@/lib/db';
import { calculateLeadScore } from '@/lib/lead-scoring';
import { AppError } from '@/lib/errors';

/**
 * Calculate and update lead score
 * POST /api/leads/:id/score
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    assertCan(user, 'lead', 'VIEW');

    const leadId = params.id;

    // Fetch lead with call logs for scoring
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: {
        callLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50 // Last 50 calls for calculation
        },
        followUps: {
          where: {
            status: 'PENDING',
          },
          orderBy: { scheduledAt: 'asc' },
          take: 10,
        },
      }
    });

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Calculate score
    const scoreTotal = calculateLeadScore(lead);

    // Update lead with new score
    const updatedLead = await db.lead.update({
      where: { id: leadId },
      data: {
        score: scoreTotal
      }
    });

    return NextResponse.json({
      success: true,
      score: scoreTotal,
      lead: updatedLead
    });

  } catch (error) {
    console.error('Lead scoring error:', error);
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'FORBIDDEN' ? 403 : 500 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to calculate lead score' },
      { status: 500 }
    );
  }
}

/**
 * Get current lead score
 * GET /api/leads/:id/score
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    assertCan(user, 'lead', 'VIEW');

    const leadId = params.id;

    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: {
        callLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        followUps: {
          where: {
            status: 'PENDING',
          },
          orderBy: { scheduledAt: 'asc' },
          take: 10,
        },
      }
    });

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Calculate current score (even if not saved)
    const scoreTotal = calculateLeadScore(lead);

    return NextResponse.json({
      score: lead.score || scoreTotal,
      calculated: scoreTotal,
      lastUpdated: lead.updatedAt
    });

  } catch (error) {
    console.error('Get lead score error:', error);
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'FORBIDDEN' ? 403 : 500 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to get lead score' },
      { status: 500 }
    );
  }
}
