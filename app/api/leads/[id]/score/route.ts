import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateLeadScore } from '@/lib/lead-scoring';

/**
 * Calculate and update lead score
 * POST /api/leads/:id/score
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const leadId = params.id;

    // Fetch lead with call logs for scoring
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        callLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50 // Last 50 calls for calculation
        }
      }
    });

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Calculate score
    const scoreData = calculateLeadScore(lead);

    // Update lead with new score
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        score: scoreData.total
      }
    });

    return NextResponse.json({
      success: true,
      score: scoreData.total,
      breakdown: scoreData.breakdown,
      grade: scoreData.grade,
      lead: updatedLead
    });

  } catch (error) {
    console.error('Lead scoring error:', error);
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
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const leadId = params.id;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        callLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    });

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Calculate current score (even if not saved)
    const scoreData = calculateLeadScore(lead);

    return NextResponse.json({
      score: lead.score || scoreData.total,
      calculated: scoreData,
      lastUpdated: lead.updatedAt
    });

  } catch (error) {
    console.error('Get lead score error:', error);
    return NextResponse.json(
      { error: 'Failed to get lead score' },
      { status: 500 }
    );
  }
}
