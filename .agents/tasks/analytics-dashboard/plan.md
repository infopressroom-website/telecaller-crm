# Analytics Dashboard Implementation Plan

## Executive Summary

This plan outlines the implementation of an Advanced Analytics Dashboard for the Telecaller CRM system. The implementation follows existing patterns found in the codebase, particularly the `/dashboard` (admin) page at `app/(admin)/dashboard/page.tsx` and the reporting infrastructure in `services/report-service.ts` and `services/dashboard-service.ts`.

The analytics dashboard will provide deeper insights beyond the existing command centre dashboard, focusing on trends, predictions, and advanced metrics for data-driven decision making.

---

## Existing Patterns to Follow

### 1. File Structure & Architecture

**Pages**: Next.js 14 App Router with TypeScript
- Admin routes: `app/(admin)/[route]/page.tsx`
- App routes: `app/(app)/[route]/page.tsx`
- Telecaller routes: `app/(telecaller)/[route]/page.tsx`
- Server Components by default with `export const dynamic = "force-dynamic"`

**Features**: Component modules organized by domain
- Pattern: `features/[feature-name]/[component].tsx`
- Existing: `features/dashboard/`, `features/reports/`, `features/performance/`
- Components: charts, filters, grids, tables

**Services**: Server-only business logic with Prisma
- Pattern: `services/[domain]-service.ts`
- All services use `import "server-only"` at the top
- Redis caching with graceful fallback (`lib/redis.ts`)
- Permission checks via `assertCan(user, resource, action)`

**Actions**: Server actions for mutations
- Pattern: `app/actions/[domain].ts`
- Use `"use server"` directive
- Return `FormState` type with error handling
- Call `revalidatePath()` after mutations

### 2. UI Component Patterns

**Components in `components/ui/`**:
- `Card`: Base container with `rounded-card border border-line bg-white p-5`
- `Badge`: Colored status indicators with accessibility-compliant contrast
- `PageHeader`: Title, description, and action buttons
- `Button`: Primary actions with loading states
- `EmptyState`: Consistent empty/no-data states with icon and message
- `DataTable`: Reusable table component (not examined in detail but exists)

**Component Style**:
- Tailwind CSS utility classes
- Design tokens: `brand`, `navy`, `ink`, `line`, `slate` colors
- Responsive: mobile-first with `md:`, `lg:`, `xl:`, `2xl:` breakpoints
- Accessibility: ARIA labels, semantic HTML, keyboard navigation

### 3. Authentication & Authorization Pattern

**Permission System** (`lib/auth/rbac.ts`, `lib/permissions.ts`):
```typescript
// In pages:
const user = await requirePagePermission("resource", "VIEW");

// In API routes:
const user = await requireApiPermission("resource", "ACTION");

// In services:
assertCan(user, "resource", "ACTION");
```

**Data Scoping** (`lib/auth/scope.ts`):
- ALL: Super admin sees everything
- TEAMS: Manager/TL sees own teams
- OWN: Telecaller sees only own data
- NONE: No access
- Implemented via `leadWhere()`, `callScopeWhere()`, `userScopeWhere()`, etc.

**Permission Resources** (add new one for analytics):
```typescript
// lib/permissions.ts currently has:
"dashboard", "lead", "distribution", "user", "team", "call", 
"followup", "task", "attendance", "performance", "incentive", 
"qa", "report", "automation", "settings", "audit"

// Need to add: "analytics"
```

### 4. Data Query Patterns with Prisma

**Dashboard Service Pattern** (`services/dashboard-service.ts`):
- Async function `getDashboardData(user: AuthUser, filters: DashboardFilters)`
- Cache with Redis: `cacheGet()` → compute → `cacheSet()` (120s TTL)
- Parallel queries with `Promise.all()`
- Group by queries for aggregations
- Raw SQL for complex date grouping
- Scope enforcement on every query
- Return typed data structures

**Common Query Patterns**:
```typescript
// Aggregations
db.callLog.count({ where: { ...filters } })
db.lead.groupBy({ by: ["sourceId"], _count: { _all: true } })

// Date ranges
const inRange = { gte: from, lt: to }
db.callLog.findMany({ where: { createdAt: inRange } })

// Joins with select
db.user.findMany({ 
  where: { ... },
  select: { id: true, name: true, team: { select: { name: true } } }
})

// Raw SQL for complex queries
db.$queryRaw<RowType[]>(Prisma.sql`SELECT ... FROM ...`)
```

### 5. Chart Patterns with Recharts

**Charts Component** (`features/dashboard/charts.tsx`):
- Client components: `"use client"` directive
- Recharts library: `BarChart`, `LineChart`, `ResponsiveContainer`
- Color constants: `COLORS = { primary: "#2557D6", secondary: "#0E7490", tertiary: "#B45309" }`
- Accessibility: `<figure role="img" aria-label="...">` with `<figcaption className="sr-only">`
- Responsive wrapper: `<ResponsiveContainer width="100%" height="100%">`
- Chart height: `h-64` (256px)

**Chart Types Used**:
- `DailyActivityChart`: Line chart with multiple series
- `FunnelChart`: Horizontal bar chart
- `GroupedBarChart`: Multi-series bar chart

### 6. Filter Pattern

**FilterBar Component** (`features/dashboard/filter-bar.tsx`):
- Plain GET form (no JavaScript required)
- URL as single source of truth (shareable links)
- Filters: preset period, custom date range, team, campaign
- Date range presets: Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, Custom range
- Rendering: Grid layout with responsive columns

**Filter Parsing** (`lib/dashboard-filters.ts`):
```typescript
export type DashboardFilters = {
  range: { from: Date; to: Date; label: string; preset: string };
  teamId: string | null;
  campaignId: string | null;
  notice: string | null; // validation warnings
};

export function parseDashboardFilters(searchParams: Record<string, string | string[] | undefined>): DashboardFilters
```

### 7. Export Pattern

**Report Export** (`services/report-service.ts`, `app/api/reports/[type]/export/route.ts`):
- Format options: CSV, XLSX (ExcelJS), PDF (pdf-lib)
- API route: `/api/reports/[type]/export?format=csv&...filters`
- Cache reports with hash of filters (5 min TTL)
- Permission: `EXPORT` action required
- Headers: `Content-Type`, `Content-Disposition: attachment`

### 8. Database Schema Patterns

**Schema Conventions** (`prisma/schema.prisma`):
- CUID ids: `@id @default(cuid())`
- Timestamps: `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
- Soft delete: `archivedAt DateTime?`
- Relations: explicit foreign keys with cascade behavior
- Enums for status fields
- JSON fields for flexible metadata: `data Json?`

**Relevant Models**:
- `Lead`, `CallLog`, `FollowUp`, `User`, `Team`, `Campaign`, `LeadSource`
- `CallDisposition`, `LeadActivity`, `LeadAssignment`
- `Target`, `Incentive`, `Attendance`, `QAReview`

---

## Proposed File Structure for Analytics Feature

```
app/
├── (app)/
│   └── analytics/
│       ├── page.tsx                    # Main analytics dashboard
│       └── [section]/
│           └── page.tsx                # Drill-down pages (trends, forecasts, etc.)
├── actions/
│   └── analytics.ts                    # Server actions (export, save views)
└── api/
    └── analytics/
        ├── export/
        │   └── route.ts                # Export analytics data
        └── metrics/
            └── route.ts                # Real-time metrics API

features/
└── analytics/
    ├── charts/
    │   ├── trend-chart.tsx             # Time series trends
    │   ├── forecast-chart.tsx          # Predictive analytics
    │   ├── heatmap-chart.tsx           # Activity heatmap
    │   ├── conversion-funnel-advanced.tsx
    │   └── cohort-chart.tsx            # Cohort analysis
    ├── filters/
    │   ├── analytics-filter-bar.tsx    # Extended filter options
    │   └── metric-selector.tsx         # Choose metrics to display
    ├── widgets/
    │   ├── kpi-comparison.tsx          # Compare periods
    │   ├── trend-indicator.tsx         # Up/down with percentage
    │   └── metric-card-advanced.tsx    # Enhanced KPI card
    └── tables/
        ├── data-grid.tsx               # Sortable/filterable table
        └── export-button.tsx           # Export control

services/
└── analytics-service.ts                # Core analytics queries

lib/
├── analytics/
│   ├── metrics.ts                      # Metric definitions
│   ├── trends.ts                       # Trend calculation utilities
│   ├── forecasting.ts                  # Basic forecasting (moving avg, linear regression)
│   └── cohorts.ts                      # Cohort analysis utilities
└── permissions.ts                      # Add "analytics" resource

types/
└── analytics.ts                        # TypeScript types

prisma/
└── schema.prisma                       # Add AnalyticsSavedView model (optional)
```

---

## Data Queries Needed

### 1. Lead Funnel Analytics

**Conversion Funnel with Time Analysis**:
- Leads by source → Contacted → Connected → Interested → Qualified → Converted
- Average time in each stage
- Conversion rates between stages
- Drop-off points identification

**Queries**:
```typescript
// Stage transition times
SELECT 
  l.id,
  l."createdAt" as lead_created,
  MIN(c."createdAt") FILTER (WHERE c."dispositionId" IS NOT NULL) as first_contact,
  MIN(c."createdAt") FILTER (WHERE d."isConnected" = true) as first_connected,
  MIN(c."createdAt") FILTER (WHERE d."key" = 'INTERESTED') as first_interested,
  la."createdAt" FILTER (WHERE la."data"->>'to' = 'CONVERTED') as converted_at
FROM "Lead" l
LEFT JOIN "CallLog" c ON c."leadId" = l.id
LEFT JOIN "CallDisposition" d ON d.id = c."dispositionId"
LEFT JOIN "LeadActivity" la ON la."leadId" = l.id AND la.type = 'STATUS_CHANGED'
WHERE l."createdAt" >= $1 AND l."createdAt" < $2
GROUP BY l.id

// Stage duration aggregates
// Average days in each stage across all leads
```

### 2. Call Performance Analytics

**Call Metrics**:
- Call volume trends (hourly, daily, weekly patterns)
- Connect rate trends
- Average talk time trends
- Best calling times (by hour of day, day of week)
- Call outcome distribution over time

**Queries**:
```typescript
// Hourly pattern
db.$queryRaw`
  SELECT 
    EXTRACT(HOUR FROM (c."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata') as hour,
    COUNT(*)::int as attempts,
    COUNT(*) FILTER (WHERE d."isConnected")::int as connected,
    AVG(c."durationSec") FILTER (WHERE d."isConnected") as avg_duration
  FROM "CallLog" c
  LEFT JOIN "CallDisposition" d ON d.id = c."dispositionId"
  WHERE c."createdAt" >= $1 AND c."createdAt" < $2
  GROUP BY hour
  ORDER BY hour
`

// Daily trends with moving average
// Week-over-week comparison
```

### 3. Team Performance Analytics

**Team Metrics**:
- Team performance trends over time
- Team member productivity comparison
- Team conversion rate trends
- Workload distribution
- Performance vs targets (variance analysis)

**Queries**:
```typescript
// Team trends
db.callLog.groupBy({
  by: ["agentId"],
  where: { createdAt: inRange, agent: { teamId } },
  _count: { _all: true },
})

// Compare to targets
db.target.findMany({
  where: { teamId, period: "MONTHLY", startsOn: { lte: now } },
  include: { team: true }
})

// Calculate actual vs target gap
```

### 4. Cohort Analysis

**Lead Cohorts**:
- Group leads by creation month/week
- Track conversion rates by cohort
- Time-to-conversion by cohort
- Retention (follow-up completion) by cohort

**Queries**:
```typescript
// Leads grouped by creation month
db.$queryRaw`
  SELECT 
    DATE_TRUNC('month', (l."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata') as cohort,
    COUNT(*)::int as total_leads,
    COUNT(*) FILTER (WHERE EXISTS(
      SELECT 1 FROM "CallLog" c 
      JOIN "CallDisposition" d ON d.id = c."dispositionId" 
      WHERE c."leadId" = l.id AND d."key" = 'CONVERTED'
    ))::int as converted,
    AVG(
      EXTRACT(EPOCH FROM (
        (SELECT MIN(c2."createdAt") FROM "CallLog" c2 
         JOIN "CallDisposition" d2 ON d2.id = c2."dispositionId"
         WHERE c2."leadId" = l.id AND d2."key" = 'CONVERTED')
        - l."createdAt"
      )) / 86400
    ) as avg_days_to_convert
  FROM "Lead" l
  WHERE l."createdAt" >= $1
  GROUP BY cohort
  ORDER BY cohort DESC
`
```

### 5. Source & Campaign Performance

**Channel Analytics**:
- Lead source ROI trends
- Campaign performance over time
- Source quality metrics (conversion rate, time to convert)
- Campaign comparison matrix

**Queries**:
```typescript
// Source performance trends (weekly)
db.$queryRaw`
  SELECT 
    DATE_TRUNC('week', l."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') as week,
    s.name as source,
    COUNT(*)::int as leads,
    COUNT(*) FILTER (WHERE EXISTS(
      SELECT 1 FROM "CallLog" c 
      JOIN "CallDisposition" d ON d.id = c."dispositionId"
      WHERE c."leadId" = l.id AND d."key" = 'CONVERTED'
    ))::int as converted
  FROM "Lead" l
  JOIN "LeadSource" s ON s.id = l."sourceId"
  WHERE l."createdAt" >= $1 AND l."createdAt" < $2
  GROUP BY week, s.name
  ORDER BY week DESC, converted DESC
`
```

### 6. Trend & Forecasting Data

**Predictive Metrics**:
- Moving averages (7-day, 30-day)
- Linear regression for trend lines
- Simple forecasting (next week/month projections)
- Seasonal patterns

**Approach**:
- Fetch historical data (last 90 days minimum)
- Calculate moving averages in application layer
- Use simple linear regression for trend lines
- Display forecast with confidence indicators

---

## Components to Build

### 1. Charts

**Trend Line Chart** (`features/analytics/charts/trend-chart.tsx`):
- Multi-series line chart with trend lines
- Moving average overlays
- Zoom and pan capabilities (optional)
- Data points with tooltips

**Heatmap Chart** (`features/analytics/charts/heatmap-chart.tsx`):
- Hour x Day of Week grid
- Color intensity based on metric (calls, conversions)
- Used to identify best calling times

**Forecast Chart** (`features/analytics/charts/forecast-chart.tsx`):
- Historical data (solid line)
- Projected data (dashed line)
- Confidence interval (shaded area)

**Cohort Chart** (`features/analytics/charts/cohort-chart.tsx`):
- Retention/conversion table visualization
- Color-coded cells based on percentage
- Month/week cohorts

**Advanced Funnel Chart** (`features/analytics/charts/conversion-funnel-advanced.tsx`):
- Funnel with time metrics
- Drop-off percentages
- Click to drill down

### 2. Filters & Controls

**Analytics Filter Bar** (`features/analytics/filters/analytics-filter-bar.tsx`):
- Extends existing `FilterBar` pattern
- Additional filters:
  - Metric selection (multi-select)
  - Comparison period (compare to previous period)
  - Grouping (day/week/month/quarter)
  - Lead source filter
  - Disposition filter

**Metric Selector** (`features/analytics/filters/metric-selector.tsx`):
- Checkbox group or dropdown
- Select which metrics to display on dashboard
- Save preferences (local storage or database)

### 3. Widgets

**KPI Comparison Card** (`features/analytics/widgets/kpi-comparison.tsx`):
```tsx
{
  label: "Total Leads",
  current: 1250,
  previous: 980,
  change: +27.6, // percentage
  trend: "up",
  sparkline: [/* mini chart data */]
}
```

**Trend Indicator** (`features/analytics/widgets/trend-indicator.tsx`):
- Arrow icon (up/down)
- Percentage change
- Color coding (green/red)
- Context (vs last week/month)

**Metric Card Advanced** (`features/analytics/widgets/metric-card-advanced.tsx`):
- Similar to existing `StatCard`
- Add mini chart (sparkline)
- Add comparison data
- Add drill-down link

### 4. Tables

**Data Grid** (`features/analytics/tables/data-grid.tsx`):
- Sortable columns
- In-line filtering
- Pagination
- Export selected rows
- Based on existing `DataTable` pattern

**Export Button** (`features/analytics/tables/export-button.tsx`):
- Dropdown: CSV, Excel, PDF
- Loading state
- Success/error feedback
- Calls export API

---

## Integration Points

### 1. Navigation

**Add to `config/navigation.ts`**:
```typescript
export const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", resource: "dashboard", href: "/dashboard", icon: LayoutDashboard, ready: true },
  { 
    label: "Analytics", 
    resource: "analytics", 
    href: "/analytics", 
    icon: BarChart3, // or TrendingUp, LineChart
    ready: true 
  },
  // ... rest of navigation
];
```

### 2. Permissions

**Update `lib/permissions.ts`**:
```typescript
export const RESOURCES = [
  "dashboard", "lead", "distribution", "user", "team", "call", 
  "followup", "task", "attendance", "performance", "incentive", 
  "qa", "report", "automation", "settings", "audit",
  "analytics", // NEW
] as const;

export const DEFAULT_ROLE_GRANTS: Record<RoleKey, Partial<Record<Resource, Action[]>>> = {
  SUPER_ADMIN: all(),
  ADMIN: { ...all(), audit: ["VIEW"] },
  MANAGER: {
    // ... existing grants
    analytics: ["VIEW", "EXPORT"], // NEW
  },
  TEAM_LEADER: {
    // ... existing grants
    analytics: ["VIEW"], // NEW
  },
  QA_MANAGER: {
    // ... existing grants
    analytics: ["VIEW"], // NEW
  },
  // ... other roles
};
```

**Database Seed**:
- Update `prisma/seed.ts` to create permissions for "analytics" resource
- Grant to appropriate roles

### 3. Dashboard Link

**Add link from main dashboard**:
In `app/(admin)/dashboard/page.tsx`, add a card or button:
```tsx
<PageHeader 
  title="Command centre" 
  description={`Showing: ${filters.range.label} (IST)`}
  actions={
    <Link href="/analytics" className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold">
      Advanced Analytics
    </Link>
  }
/>
```

### 4. Cache Strategy

**Use existing Redis infrastructure**:
```typescript
// In services/analytics-service.ts
export async function getAnalyticsData(user: AuthUser, filters: AnalyticsFilters) {
  const cacheKey = `analytics:${hash(user.id, filters)}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return JSON.parse(cached);
  
  const data = await computeAnalytics(user, filters);
  await cacheSet(cacheKey, JSON.stringify(data), 300); // 5 min TTL
  
  return data;
}
```

**Cache Invalidation**:
- On new data: invalidate relevant analytics caches
- Pattern: `cacheDelPattern("analytics:*")` when leads/calls created
- Consider background job to pre-warm cache for common queries

---

## Implementation Checklist

### Phase 1: Foundation (Core Infrastructure)

- [ ] 1. **Add analytics permission resource**
  - Files: `lib/permissions.ts`
  - Add "analytics" to RESOURCES array
  - Add grants to DEFAULT_ROLE_GRANTS for relevant roles
  - Verify: `npm run typecheck` passes

- [ ] 2. **Create database migration for permissions**
  - Files: `prisma/seed.ts`
  - Add analytics permissions (VIEW, EXPORT)
  - Assign to roles: SUPER_ADMIN, ADMIN, MANAGER, TEAM_LEADER, QA_MANAGER
  - Verify: `npm run db:seed` succeeds, check database

- [ ] 3. **Create analytics service structure**
  - Files: `services/analytics-service.ts`, `types/analytics.ts`
  - Define AnalyticsFilters type
  - Define return data types (TrendData, CohortData, etc.)
  - Stub functions: getAnalyticsData, getTrendData, getCohortData
  - Verify: `npm run typecheck` passes

- [ ] 4. **Create analytics utilities**
  - Files: `lib/analytics/metrics.ts`, `lib/analytics/trends.ts`, `lib/analytics/cohorts.ts`
  - Implement moving average calculation
  - Implement linear regression (simple)
  - Implement cohort grouping logic
  - Verify: Add unit tests and run `npm run test`

### Phase 2: Data Layer (Queries & Services)

- [ ] 5. **Implement lead funnel analytics queries**
  - Files: `services/analytics-service.ts`
  - Function: `getFunnelAnalytics(user, filters)`
  - Query: Stage transitions, time in stage, drop-off rates
  - Add caching with 5-min TTL
  - Verify: Test with actual database, check performance

- [ ] 6. **Implement call performance analytics queries**
  - Files: `services/analytics-service.ts`
  - Function: `getCallAnalytics(user, filters)`
  - Query: Hourly patterns, daily trends, connect rate over time
  - Verify: Test query performance, ensure indexes exist

- [ ] 7. **Implement team performance analytics queries**
  - Files: `services/analytics-service.ts`
  - Function: `getTeamAnalytics(user, filters)`
  - Query: Team trends, member comparison, target variance
  - Verify: Check scope enforcement works correctly

- [ ] 8. **Implement cohort analysis queries**
  - Files: `services/analytics-service.ts`
  - Function: `getCohortAnalytics(user, filters)`
  - Query: Leads by creation period, conversion tracking
  - Verify: Test with multiple cohort periods

- [ ] 9. **Implement source/campaign analytics queries**
  - Files: `services/analytics-service.ts`
  - Function: `getChannelAnalytics(user, filters)`
  - Query: Source performance over time, campaign ROI
  - Verify: Test with actual campaign data

### Phase 3: UI Components (Charts & Widgets)

- [ ] 10. **Create base chart components**
  - Files: `features/analytics/charts/trend-chart.tsx`
  - Multi-series line chart with recharts
  - Follow existing chart pattern from `features/dashboard/charts.tsx`
  - Accessibility: figure/figcaption, aria-labels
  - Verify: Render with sample data, check responsive behavior

- [ ] 11. **Create heatmap chart**
  - Files: `features/analytics/charts/heatmap-chart.tsx`
  - Hour x Day grid with color intensity
  - Use recharts or custom SVG
  - Verify: Test with call activity data

- [ ] 12. **Create forecast chart**
  - Files: `features/analytics/charts/forecast-chart.tsx`
  - Historical + projected with confidence interval
  - Use recharts Area for shaded region
  - Verify: Visual distinction between actual and forecast

- [ ] 13. **Create cohort visualization**
  - Files: `features/analytics/charts/cohort-chart.tsx`
  - Table-based heatmap
  - Color-coded cells
  - Verify: Readability with different data ranges

- [ ] 14. **Create KPI comparison widgets**
  - Files: `features/analytics/widgets/kpi-comparison.tsx`, `features/analytics/widgets/trend-indicator.tsx`
  - Period comparison cards
  - Up/down indicators with percentage change
  - Verify: Test with positive/negative changes

### Phase 4: Filters & Controls

- [ ] 15. **Create analytics filter bar**
  - Files: `features/analytics/filters/analytics-filter-bar.tsx`
  - Extend existing FilterBar pattern
  - Add metric selector, comparison period, grouping
  - Plain GET form (URL as source of truth)
  - Verify: Test filter combinations, check URL params

- [ ] 16. **Create metric selector**
  - Files: `features/analytics/filters/metric-selector.tsx`
  - Multi-select for metrics to display
  - Save preferences to localStorage
  - Verify: Persistence across page loads

### Phase 5: Pages & Routes

- [ ] 17. **Create main analytics page**
  - Files: `app/(app)/analytics/page.tsx`
  - PageHeader with title and export actions
  - FilterBar with analytics-specific options
  - KPI grid with comparison metrics
  - Chart grid with trend, heatmap, cohort charts
  - Permission check: `requirePagePermission("analytics", "VIEW")`
  - Verify: Page loads, all sections render, data flows correctly

- [ ] 18. **Create export functionality**
  - Files: `app/api/analytics/export/route.ts`, `app/actions/analytics.ts`
  - Support CSV, XLSX, PDF formats
  - Reuse export utilities from report-service
  - Permission check: `requireApiPermission("analytics", "EXPORT")`
  - Verify: Download works, file format correct

- [ ] 19. **Create drill-down pages (optional)**
  - Files: `app/(app)/analytics/[section]/page.tsx`
  - Detailed views: trends, forecasts, cohorts
  - Deep-dive into specific metrics
  - Verify: Navigation from main page works

### Phase 6: Integration & Polish

- [ ] 20. **Add navigation menu item**
  - Files: `config/navigation.ts`
  - Add Analytics to ADMIN_NAV
  - Import appropriate icon (BarChart3, TrendingUp)
  - Set ready: true, resource: "analytics"
  - Verify: Menu item appears for users with permission

- [ ] 21. **Add link from main dashboard**
  - Files: `app/(admin)/dashboard/page.tsx`
  - Add "Advanced Analytics" button in PageHeader actions
  - Verify: Link visible, navigates correctly

- [ ] 22. **Add loading states**
  - Files: All page and component files
  - Use Suspense boundaries where appropriate
  - Add skeleton loaders for charts
  - Verify: No layout shift during loading

- [ ] 23. **Add empty states**
  - Files: All chart and widget components
  - Use EmptyState component pattern
  - Helpful messages when no data
  - Verify: Test with empty database/filtered results

- [ ] 24. **Performance optimization**
  - Review all queries for N+1 problems
  - Add database indexes if needed
  - Optimize cache TTL values
  - Consider pagination for large datasets
  - Verify: Run `EXPLAIN ANALYZE` on slow queries

- [ ] 25. **Accessibility review**
  - Check all charts have proper ARIA labels
  - Keyboard navigation works
  - Color contrast meets WCAG AA
  - Screen reader testing
  - Verify: Manual testing with screen reader

### Phase 7: Testing & Documentation

- [ ] 26. **Write unit tests**
  - Files: `services/analytics-service.test.ts`, `lib/analytics/*.test.ts`
  - Test metric calculations
  - Test trend/forecast functions
  - Test cohort grouping
  - Verify: `npm run test` passes

- [ ] 27. **Write integration tests**
  - Files: `tests/analytics.integration.test.ts` (if integration tests exist)
  - Test full page render
  - Test export functionality
  - Test permission enforcement
  - Verify: Integration tests pass

- [ ] 28. **Add documentation**
  - Files: `docs/ANALYTICS.md` (create if needed)
  - Document available metrics
  - Explain calculation methods
  - Document export formats
  - User guide for filters
  - Verify: Review with stakeholders

- [ ] 29. **Build verification**
  - Run full build: `npm run verify`
  - Check for TypeScript errors
  - Check for linting errors
  - Run all tests
  - Build Next.js app
  - Verify: All checks pass

- [ ] 30. **User acceptance testing**
  - Test with real data
  - Test with different user roles
  - Test on different screen sizes
  - Test export downloads
  - Verify: Sign-off from stakeholders

---

## Technical Considerations

### Performance

1. **Query Optimization**:
   - Use appropriate indexes on `createdAt`, `teamId`, `agentId`
   - Limit raw SQL queries to essential aggregations
   - Use Prisma where possible for query optimization
   - Consider materialized views for complex metrics

2. **Caching Strategy**:
   - Cache analytics data for 5 minutes (configurable)
   - Cache key includes user scope and filters
   - Invalidate on relevant mutations (leads, calls created)
   - Pre-warm cache for common queries (background job)

3. **Data Volume**:
   - Limit date ranges (max 1 year)
   - Paginate large result sets
   - Use aggregations server-side
   - Consider data archival strategy

### Scalability

1. **Database**:
   - Monitor query performance with `EXPLAIN ANALYZE`
   - Add composite indexes as needed
   - Consider read replicas for analytics queries
   - Partition large tables by date if needed

2. **Application**:
   - Use streaming for large exports
   - Implement request timeouts
   - Rate limit export endpoints
   - Consider background jobs for expensive calculations

### Security

1. **Authorization**:
   - Enforce permissions on every route
   - Respect data scopes (OWN, TEAMS, ALL)
   - Never expose data outside user's scope
   - Audit export actions

2. **Input Validation**:
   - Validate all filter parameters
   - Sanitize SQL inputs (use Prisma parameterization)
   - Limit date ranges to prevent DoS
   - Validate export format

### Accessibility

1. **Charts**:
   - Provide text alternatives (figcaption)
   - Use semantic HTML (figure, table)
   - Ensure color is not the only indicator
   - Test with screen readers

2. **Controls**:
   - Keyboard navigation for all filters
   - Focus management for modals/dropdowns
   - Clear labels for form controls
   - Error messages are announced

---

## Data Model Additions (Optional)

If saved views/dashboards are needed:

```prisma
// Add to schema.prisma

model AnalyticsSavedView {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  description String?
  config      Json     // { filters, metrics, chartTypes, layout }
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
}
```

This allows users to save custom dashboard configurations.

---

## Success Metrics

### User Adoption
- 80%+ of managers access analytics within first month
- Average 3+ views per week per active user
- Export feature used regularly

### Performance
- Page load < 2 seconds with cached data
- Queries complete < 5 seconds without cache
- No impact on main dashboard performance

### Business Impact
- Identify top-performing lead sources within 1 week
- Spot conversion trends early (week-over-week)
- Data-driven decisions for team optimization

---

## Future Enhancements (Out of Scope)

1. **Advanced Forecasting**:
   - Machine learning models
   - ARIMA time series forecasting
   - Seasonal decomposition

2. **Real-time Analytics**:
   - WebSocket updates
   - Live metrics dashboard
   - Streaming data pipeline

3. **Custom Reports Builder**:
   - Drag-and-drop interface
   - Custom metric definitions
   - Scheduled report delivery

4. **Predictive Lead Scoring**:
   - ML-based scoring (separate from existing rule-based)
   - Churn prediction
   - Conversion probability

5. **Advanced Visualizations**:
   - Sankey diagrams for flow
   - Network graphs for relationships
   - Geographic heatmaps

6. **Benchmarking**:
   - Industry averages
   - Historical comparisons
   - Goal setting tools

---

## Conclusion

This plan provides a comprehensive roadmap for implementing an Advanced Analytics Dashboard that:

1. **Follows existing patterns**: Maintains consistency with current codebase architecture
2. **Respects permissions**: Enforces RBAC and data scoping throughout
3. **Optimizes performance**: Uses caching, efficient queries, and proper indexing
4. **Ensures accessibility**: Meets WCAG standards for inclusive design
5. **Enables data-driven decisions**: Provides actionable insights beyond the command centre

The implementation is structured in phases for incremental delivery, with clear verification steps at each stage. The 30-item checklist ensures nothing is missed, and the plan can be followed by any developer familiar with the existing codebase patterns.

**Estimated Timeline**: 3-4 weeks for full implementation (Phases 1-7)
**Estimated Effort**: 80-100 developer hours

---

## Appendix: Key Files Reference

### Read Before Implementation
- `app/(admin)/dashboard/page.tsx` - Dashboard page structure
- `services/dashboard-service.ts` - Data query patterns
- `services/report-service.ts` - Export patterns
- `features/dashboard/charts.tsx` - Chart components
- `lib/auth/rbac.ts` - Permission checking
- `lib/permissions.ts` - Permission definitions

### Modify During Implementation
- `lib/permissions.ts` - Add analytics resource
- `config/navigation.ts` - Add navigation item
- `prisma/seed.ts` - Seed analytics permissions

### Create During Implementation
- `services/analytics-service.ts` - New service
- `features/analytics/**/*` - New components
- `app/(app)/analytics/**/*` - New pages
- `lib/analytics/**/*` - New utilities
- `types/analytics.ts` - New types

---

**Plan Status**: ✅ Complete and Ready for Implementation
**Last Updated**: 2024-11-19
**Created By**: Planning Agent (Workflow Step)
