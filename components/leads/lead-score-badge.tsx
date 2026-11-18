'use client';

import { useState, useEffect } from 'react';
import { getScoreColor, getScoreIcon } from '@/lib/lead-scoring';

interface LeadScoreBadgeProps {
  leadId: string;
  initialScore?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  autoCalculate?: boolean;
}

export function LeadScoreBadge({
  leadId,
  initialScore,
  size = 'md',
  showLabel = true,
  autoCalculate = false
}: LeadScoreBadgeProps) {
  const [score, setScore] = useState<number | null>(initialScore || null);
  const [loading, setLoading] = useState(false);
  const [grade, setGrade] = useState<'HOT' | 'WARM' | 'COLD'>('COLD');

  // Determine grade from score
  useEffect(() => {
    if (score !== null) {
      if (score >= 70) setGrade('HOT');
      else if (score >= 40) setGrade('WARM');
      else setGrade('COLD');
    }
  }, [score]);

  // Auto-calculate on mount if requested
  useEffect(() => {
    if (autoCalculate && score === null) {
      calculateScore();
    }
  }, []);

  const calculateScore = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/score`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const data = await response.json();
        setScore(data.score);
      }
    } catch (error) {
      console.error('Failed to calculate score:', error);
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };

  const iconSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  if (loading) {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-full bg-gray-100 text-gray-600 ${sizeClasses[size]}`}>
        <span className="animate-spin">⏳</span>
        <span>Calculating...</span>
      </div>
    );
  }

  if (score === null) {
    return (
      <button
        onClick={calculateScore}
        className={`inline-flex items-center gap-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition ${sizeClasses[size]}`}
      >
        <span>Calculate Score</span>
      </button>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${getScoreColor(score)} ${sizeClasses[size]}`}
      title={`Lead Score: ${score}/100 - ${grade}`}
    >
      <span className={iconSizes[size]}>
        {getScoreIcon(grade)}
      </span>
      <span className="font-semibold">{score}</span>
      {showLabel && (
        <>
          <span className="opacity-60">/100</span>
          <span className="font-bold ml-0.5">{grade}</span>
        </>
      )}
    </div>
  );
}
