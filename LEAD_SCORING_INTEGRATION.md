# 🎯 Lead Scoring - Integration Guide

**Status:** ✅ IMPLEMENTED & READY TO USE

---

## 📦 What's Been Created

### Core Files:
1. ✅ `lib/lead-scoring.ts` - Scoring algorithm
2. ✅ `app/api/leads/[id]/score/route.ts` - REST API
3. ✅ `components/leads/lead-score-badge.tsx` - Compact display
4. ✅ `components/leads/lead-score-details.tsx` - Detailed breakdown
5. ✅ Database schema updated (score field added to Lead model)

---

## 🚀 HOW TO USE

### Option 1: Add to Lead List (Simple Badge)

**File:** `app/(app)/leads/page.tsx` or your lead list component

```typescript
import { LeadScoreBadge } from '@/components/leads/lead-score-badge';

// In your lead list rendering:
{leads.map(lead => (
  <tr key={lead.id}>
    <td>{lead.name}</td>
    <td>{lead.primaryMobile}</td>
    <td>
      <LeadScoreBadge 
        leadId={lead.id} 
        initialScore={lead.score}
        size="sm"
        showLabel={false}
      />
    </td>
  </tr>
))}
```

### Option 2: Add to Lead Detail Page (Full Details)

**File:** `app/(app)/leads/[id]/page.tsx` or lead detail component

```typescript
import { LeadScoreBadge } from '@/components/leads/lead-score-badge';
import { LeadScoreDetails } from '@/components/leads/lead-score-details';

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      {/* Header with badge */}
      <div className="flex items-center gap-4">
        <h1>Lead Details</h1>
        <LeadScoreBadge 
          leadId={params.id}
          size="lg"
          autoCalculate={true}
        />
      </div>

      {/* Full breakdown section */}
      <div className="mt-6">
        <LeadScoreDetails leadId={params.id} />
      </div>
    </div>
  );
}
```

### Option 3: API Usage (Manual)

```typescript
// Calculate score
const response = await fetch(`/api/leads/${leadId}/score`, {
  method: 'POST'
});

const { score, breakdown, grade } = await response.json();
// score: 0-100
// grade: 'HOT' | 'WARM' | 'COLD'
// breakdown: { source: 15, engagement: 25, priority: 15, recency: 8, callSuccess: 18 }

// Get existing score
const response = await fetch(`/api/leads/${leadId}/score`);
const data = await response.json();
```

---

## 🎨 Component Props

### LeadScoreBadge

```typescript
interface LeadScoreBadgeProps {
  leadId: string;              // Required: Lead ID
  initialScore?: number | null; // Optional: Pre-loaded score
  size?: 'sm' | 'md' | 'lg';   // Optional: Display size (default: 'md')
  showLabel?: boolean;          // Optional: Show /100 and grade text (default: true)
  autoCalculate?: boolean;      // Optional: Auto-calculate on mount (default: false)
}
```

**Examples:**
```tsx
// Compact (for lists)
<LeadScoreBadge leadId={id} initialScore={75} size="sm" showLabel={false} />
// Output: 🔥 75

// Full (for headers)
<LeadScoreBadge leadId={id} size="lg" autoCalculate />
// Output: 🔥 75 /100 HOT

// With manual trigger
<LeadScoreBadge leadId={id} />
// Shows "Calculate Score" button if no score exists
```

### LeadScoreDetails

```typescript
interface LeadScoreDetailsProps {
  leadId: string;  // Required: Lead ID
}
```

**Features:**
- Collapsible panel ("View Score Details" link)
- Full breakdown with progress bars
- Score component visualization
- Recalculate button
- Auto-loads on expand

---

## 📊 Scoring Algorithm

### How It Works:

**Total Score:** 0-100 points

| Factor | Max Points | Description |
|--------|------------|-------------|
| **Lead Source** | 20 | Quality of source (REFERRAL=20, WEBSITE=18, etc) |
| **Engagement** | 30 | Calls made, status progression |
| **Priority** | 20 | URGENT=20, HIGH=15, MEDIUM=10, LOW=5 |
| **Recency** | 10 | Days since last contact |
| **Call Success** | 20 | Percentage of connected calls |

### Grading:

- **🔥 HOT** (70-100): High priority, immediate action
- **🌡️ WARM** (40-69): Medium priority, follow up soon
- **❄️ COLD** (0-39): Low priority, nurture over time

---

## 🔄 Auto-Calculation

### Option A: On Lead Update (Recommended)

```typescript
// After updating lead or adding call log
async function updateLead(leadId: string, data: any) {
  // Update lead
  await prisma.lead.update({
    where: { id: leadId },
    data
  });
  
  // Recalculate score
  await fetch(`/api/leads/${leadId}/score`, { method: 'POST' });
}
```

### Option B: Cron Job (Batch)

```typescript
// scripts/recalculate-scores.ts
import { prisma } from '@/lib/prisma';

async function recalculateAllScores() {
  const leads = await prisma.lead.findMany({
    where: {
      status: { notIn: ['CONVERTED', 'LOST', 'INVALID'] }
    }
  });
  
  for (const lead of leads) {
    await fetch(`${process.env.APP_URL}/api/leads/${lead.id}/score`, {
      method: 'POST'
    });
  }
}
```

**Run daily:**
```bash
# Add to cron or use Vercel Cron
0 0 * * * node scripts/recalculate-scores.ts
```

### Option C: On-Demand Only

Let users click "Calculate Score" button when needed.

---

## 🎯 Advanced Usage

### Sort Leads by Score

```typescript
// In lead list query
const leads = await prisma.lead.findMany({
  orderBy: {
    score: 'desc'  // Hot leads first
  }
});
```

### Filter by Grade

```typescript
// Get only HOT leads
const hotLeads = await prisma.lead.findMany({
  where: {
    score: { gte: 70 }
  }
});

// Get WARM leads
const warmLeads = await prisma.lead.findMany({
  where: {
    score: { gte: 40, lt: 70 }
  }
});
```

### Custom Scoring Rules

Edit `lib/lead-scoring.ts` to adjust:
- Point allocations
- Grading thresholds
- Factor weights
- Custom logic

---

## 🔧 Customization

### Change Grade Thresholds

```typescript
// lib/lead-scoring.ts
function getScoreGrade(score: number): 'HOT' | 'WARM' | 'COLD' {
  if (score >= 80) return 'HOT';  // Changed from 70
  if (score >= 50) return 'WARM'; // Changed from 40
  return 'COLD';
}
```

### Add Custom Factors

```typescript
// lib/lead-scoring.ts
export function calculateLeadScore(lead: LeadWithCalls): LeadScore {
  const breakdown = {
    source: calculateSourceScore(lead),
    engagement: calculateEngagementScore(lead),
    priority: calculatePriorityScore(lead),
    recency: calculateRecencyScore(lead),
    callSuccess: calculateCallSuccessScore(lead),
    customFactor: calculateCustomScore(lead)  // Add your factor
  };
  
  // Include in total
  const total = Math.min(100, Math.round(
    breakdown.source +
    breakdown.engagement +
    breakdown.priority +
    breakdown.recency +
    breakdown.callSuccess +
    breakdown.customFactor
  ));
}
```

---

## 📱 Mobile Responsive

All components are mobile-friendly:
- Badges scale with size prop
- Details panel is touch-friendly
- Progress bars are responsive
- Works on all screen sizes

---

## ⚡ Performance

- Scores are cached in database
- Calculation only on demand
- API endpoints are optimized
- Components use React best practices
- No unnecessary re-renders

---

## 🧪 Testing

```typescript
// Test scoring algorithm
import { calculateLeadScore } from '@/lib/lead-scoring';

const testLead = {
  id: 'test',
  source: 'REFERRAL',
  status: 'INTERESTED',
  priority: 'HIGH',
  createdAt: new Date(),
  callLogs: [
    { status: 'COMPLETED', createdAt: new Date() },
    { status: 'COMPLETED', createdAt: new Date() }
  ]
};

const score = calculateLeadScore(testLead);
console.log(score);
// Expected: High score (70+) for this lead profile
```

---

## 📈 Benefits

1. **Prioritize Efforts** - Focus on hot leads first
2. **Data-Driven** - Objective scoring, not gut feeling
3. **Improved Conversion** - Work high-value leads
4. **Team Motivation** - Visual progress indicators
5. **Performance Tracking** - Monitor lead quality trends

---

## 🎉 READY TO USE!

Lead Scoring is now fully implemented. Just import the components where you need them!

**Next Steps:**
1. Add `<LeadScoreBadge>` to your lead list
2. Add `<LeadScoreDetails>` to lead detail page
3. Optionally setup auto-calculation
4. Start using scores to prioritize work!

---

**Questions? Check `ADVANCED_FEATURES_GUIDE.md` for more details!** 🚀
