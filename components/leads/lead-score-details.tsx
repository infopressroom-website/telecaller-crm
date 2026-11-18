'use client';

import { useState, useEffect } from 'react';
import { getScoreColor, getScoreIcon } from '@/lib/lead-scoring';

interface ScoreBreakdown {
  source: number;
  engagement: number;
  priority: number;
  recency: number;
  callSuccess: number;
}

interface LeadScoreDetailsProps {
  leadId: string;
}

export function LeadScoreDetails({ leadId }: LeadScoreDetailsProps) {
  const [data, setData] = useState<{
    score: number;
    breakdown: ScoreBreakdown;
    grade: 'HOT' | 'WARM' | 'COLD';
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const loadScoreDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/score`);
      if (response.ok) {
        const result = await response.json();
        setData({
          score: result.calculated.total,
          breakdown: result.calculated.breakdown,
          grade: result.calculated.grade
        });
      }
    } catch (error) {
      console.error('Failed to load score details:', error);
    } finally {
      setLoading(false);
    }
  };

  const recalculateScore = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/score`, {
        method: 'POST'
      });
      if (response.ok) {
        const result = await response.json();
        setData({
          score: result.score,
          breakdown: result.breakdown,
          grade: result.grade
        });
      }
    } catch (error) {
      console.error('Failed to recalculate score:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !data) {
      loadScoreDetails();
    }
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm text-blue-600 hover:text-blue-700 underline"
      >
        View Score Details
      </button>
    );
  }

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Lead Score Breakdown</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      {loading && !data && (
        <div className="text-center py-8 text-gray-500">
          <div className="animate-spin text-2xl mb-2">⏳</div>
          Loading score details...
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* Total Score */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50">
            <div>
              <div className="text-sm text-gray-600">Total Score</div>
              <div className="text-2xl font-bold">{data.score}/100</div>
            </div>
            <div className={`text-4xl ${getScoreColor(data.score)} px-4 py-2 rounded-full`}>
              {getScoreIcon(data.grade)} <span className="font-bold">{data.grade}</span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 mb-3">Score Components:</div>
            
            <ScoreBar
              label="Lead Source Quality"
              score={data.breakdown.source}
              maxScore={20}
              description="Quality of lead source"
            />
            
            <ScoreBar
              label="Engagement Level"
              score={data.breakdown.engagement}
              maxScore={30}
              description="Calls, responses, status progression"
            />
            
            <ScoreBar
              label="Priority Level"
              score={data.breakdown.priority}
              maxScore={20}
              description="Assigned priority importance"
            />
            
            <ScoreBar
              label="Recency"
              score={data.breakdown.recency}
              maxScore={10}
              description="Time since last contact"
            />
            
            <ScoreBar
              label="Call Success Rate"
              score={data.breakdown.callSuccess}
              maxScore={20}
              description="Percentage of successful connections"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t">
            <button
              onClick={recalculateScore}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Recalculating...
                </>
              ) : (
                <>
                  🔄 Recalculate Score
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBar({
  label,
  score,
  maxScore,
  description
}: {
  label: string;
  score: number;
  maxScore: number;
  description: string;
}) {
  const percentage = (score / maxScore) * 100;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-600">{score}/{maxScore}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs text-gray-500">{description}</div>
    </div>
  );
}
