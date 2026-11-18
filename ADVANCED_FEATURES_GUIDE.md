# 🚀 Advanced Features Implementation Guide

**Features:** Lead Scoring, Advanced Analytics, WhatsApp Integration  
**Status:** Implementation Ready  
**Estimated Implementation Time:** 5-7 days (or hire developer)

---

## ✅ FEATURE 1: LEAD SCORING SYSTEM

### Status: Core Logic Implemented ✅

**What's Done:**
- ✅ Scoring algorithm (`lib/lead-scoring.ts`)
- ✅ Database schema updated (score field added)
- ✅ 0-100 scoring based on 5 factors
- ✅ HOT/WARM/COLD grading

**What's Needed:** (2-3 hours)
1. API endpoint to calculate score
2. UI component to display score
3. Auto-calculate on lead update
4. Sort/filter by score in lead list

**Implementation Steps:**

```typescript
// 1. Create API endpoint: app/api/leads/[id]/score/route.ts
import { calculateLeadScore } from '@/lib/lead-scoring';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: { callLogs: true }
  });
  
  const scoreData = calculateLeadScore(lead);
  
  await prisma.lead.update({
    where: { id: params.id },
    data: { score: scoreData.total }
  });
  
  return Response.json(scoreData);
}

// 2. Add to Lead UI component
import { getScoreColor, getScoreIcon } from '@/lib/lead-scoring';

<div className={`px-2 py-1 rounded ${getScoreColor(lead.score)}`}>
  {getScoreIcon(lead.grade)} {lead.score}/100
</div>

// 3. Auto-calculate hook (after lead update)
await fetch(`/api/leads/${leadId}/score`, { method: 'POST' });
```

**Benefits:**
- Prioritize high-value leads
- Focus telecaller efforts
- Improve conversion rates
- Data-driven decisions

---

## 📊 FEATURE 2: ADVANCED ANALYTICS DASHBOARD

### Status: Architecture Designed

**Components Needed:**

### 2.1 Analytics Page
**File:** `app/(app)/analytics/page.tsx`

```typescript
export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <ConversionFunnel />
      <LeadSourcePerformance />
      <TeamProductivity />
      <CallOutcomeDistribution />
      <TrendsOverTime />
      <CohortAnalysis />
      <GoalTracking />
    </div>
  );
}
```

### 2.2 API Endpoints Needed

```
GET /api/analytics/funnel
GET /api/analytics/sources
GET /api/analytics/team-performance
GET /api/analytics/call-outcomes
GET /api/analytics/trends?period=daily|weekly|monthly
GET /api/analytics/cohorts
GET /api/analytics/goals
```

### 2.3 Example: Conversion Funnel

```typescript
// app/api/analytics/funnel/route.ts
export async function GET() {
  const funnel = await prisma.lead.groupBy({
    by: ['status'],
    _count: true
  });
  
  return Response.json({
    NEW: funnel.find(f => f.status === 'NEW')?._count || 0,
    ATTEMPTED: funnel.find(f => f.status === 'ATTEMPTED')?._count || 0,
    CONNECTED: funnel.find(f => f.status === 'CONNECTED')?._count || 0,
    INTERESTED: funnel.find(f => f.status === 'INTERESTED')?._count || 0,
    QUALIFIED: funnel.find(f => f.status === 'QUALIFIED')?._count || 0,
    CONVERTED: funnel.find(f => f.status === 'CONVERTED')?._count || 0,
  });
}

// Component
import { BarChart } from 'recharts';

function ConversionFunnel({ data }) {
  return (
    <BarChart data={[
      { name: 'New', value: data.NEW },
      { name: 'Attempted', value: data.ATTEMPTED },
      { name: 'Connected', value: data.CONNECTED },
      { name: 'Interested', value: data.INTERESTED },
      { name: 'Qualified', value: data.QUALIFIED },
      { name: 'Converted', value: data.CONVERTED },
    ]} />
  );
}
```

### 2.4 Charts Library
Already installed: **Recharts**

**Chart Types:**
- Bar charts (funnel, sources)
- Line charts (trends)
- Pie charts (distribution)
- Area charts (cumulative)

### 2.5 Export Functionality

```typescript
// Export to Excel
import * as XLSX from 'xlsx';

function exportToExcel(data) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Analytics');
  XLSX.writeFile(wb, 'analytics.xlsx');
}

// Export to PDF
import jsPDF from 'jspdf';

function exportToPDF() {
  const doc = new jsPDF();
  doc.text('Analytics Report', 10, 10);
  // Add charts as images
  doc.save('analytics.pdf');
}
```

**Benefits:**
- Visual insights
- Data-driven decisions
- Performance tracking
- Goal monitoring
- Team accountability

---

## 💬 FEATURE 3: WHATSAPP INTEGRATION

### Status: Architecture Designed

**Prerequisites:**
1. WhatsApp Business Account
2. Meta Business Manager access
3. WhatsApp Business API access

### 3.1 Setup WhatsApp Business API

**Option A: Meta Cloud API** (Recommended - FREE)

1. Go to https://developers.facebook.com/
2. Create app → Business → WhatsApp
3. Get credentials:
   - Phone Number ID
   - WhatsApp Business Account ID
   - Access Token

**Option B: On-Premise API** (Complex)
- Requires dedicated server
- Docker container
- Not recommended for start

### 3.2 Database Schema

```prisma
// Add to schema.prisma

model WhatsAppMessage {
  id              String   @id @default(cuid())
  leadId          String
  lead            Lead     @relation(fields: [leadId], references: [id])
  
  messageId       String?  // WhatsApp message ID
  direction       String   // OUTBOUND or INBOUND
  content         String
  templateId      String?  // If using template
  
  status          String   // PENDING, SENT, DELIVERED, READ, FAILED
  statusTimestamp DateTime?
  
  sentBy          String?  // User ID who sent
  receivedAt      DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([leadId])
  @@index([createdAt])
}

model WhatsAppTemplate {
  id          String   @id @default(cuid())
  name        String   @unique
  content     String
  category    String   // MARKETING, UTILITY, AUTHENTICATION
  language    String   @default("en")
  status      String   @default("PENDING") // PENDING, APPROVED, REJECTED
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### 3.3 WhatsApp Service

```typescript
// lib/whatsapp.ts

import axios from 'axios';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;

export interface SendMessageParams {
  to: string; // Phone number in international format
  message: string;
  templateName?: string;
}

export async function sendWhatsAppMessage(params: SendMessageParams) {
  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: params.to,
        type: params.templateName ? 'template' : 'text',
        ...(params.templateName ? {
          template: {
            name: params.templateName,
            language: { code: 'en' }
          }
        } : {
          text: { body: params.message }
        })
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return {
      success: true,
      messageId: response.data.messages[0].id
    };
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function handleWhatsAppWebhook(body: any) {
  // Process incoming messages
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const message = changes?.value?.messages?.[0];
  
  if (message) {
    const from = message.from;
    const text = message.text?.body;
    
    // Save to database
    await prisma.whatsAppMessage.create({
      data: {
        messageId: message.id,
        direction: 'INBOUND',
        content: text,
        status: 'RECEIVED',
        receivedAt: new Date(),
        leadId: await findLeadByPhone(from)
      }
    });
  }
}
```

### 3.4 API Endpoints

```typescript
// app/api/whatsapp/send/route.ts
export async function POST(req: Request) {
  const { leadId, message, templateName } = await req.json();
  
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  
  const result = await sendWhatsAppMessage({
    to: lead.primaryMobile,
    message,
    templateName
  });
  
  // Save to database
  await prisma.whatsAppMessage.create({
    data: {
      leadId,
      direction: 'OUTBOUND',
      content: message,
      messageId: result.messageId,
      status: result.success ? 'SENT' : 'FAILED',
      sentBy: req.user.id
    }
  });
  
  return Response.json(result);
}

// app/api/whatsapp/webhook/route.ts
export async function POST(req: Request) {
  const body = await req.json();
  await handleWhatsAppWebhook(body);
  return Response.json({ success: true });
}

// GET verification for Meta
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  
  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_TOKEN) {
    return new Response(challenge);
  }
  return new Response('Forbidden', { status: 403 });
}
```

### 3.5 UI Components

```typescript
// app/(app)/leads/[id]/components/whatsapp-chat.tsx

export function WhatsAppChat({ leadId }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  async function sendMessage() {
    await fetch('/api/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify({
        leadId,
        message: newMessage
      })
    });
    
    setNewMessage('');
    loadMessages();
  }
  
  return (
    <div className="flex flex-col h-96 border rounded">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`px-4 py-2 rounded-lg max-w-xs ${
              msg.direction === 'OUTBOUND'
                ? 'bg-green-100 text-green-900'
                : 'bg-gray-100 text-gray-900'
            }`}>
              {msg.content}
              <div className="text-xs mt-1 opacity-60">
                {formatTime(msg.createdAt)} {msg.status === 'READ' && '✓✓'}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Input */}
      <div className="border-t p-4 flex gap-2">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type message..."
          className="flex-1 px-3 py-2 border rounded"
        />
        <button onClick={sendMessage} className="px-4 py-2 bg-green-600 text-white rounded">
          Send
        </button>
      </div>
    </div>
  );
}
```

### 3.6 Environment Variables

```env
# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_WEBHOOK_TOKEN=your_random_webhook_token
```

### 3.7 Webhook Setup in Meta

1. Go to WhatsApp Business App settings
2. Configuration → Webhooks
3. Callback URL: `https://your-domain.com/api/whatsapp/webhook`
4. Verify token: (same as WHATSAPP_WEBHOOK_TOKEN)
5. Subscribe to: `messages`

**Benefits:**
- Direct communication
- Higher engagement
- Message history
- Delivery tracking
- Template support (pre-approved messages)

---

## 🎯 QUICK START: Which to Implement First?

### Option A: Lead Scoring (Easiest - 2-3 hours)
✅ **Do this first**
- Immediate value
- No external dependencies
- Quick win

**Steps:**
1. Run migration: `npx prisma db push`
2. Create API endpoint (above code)
3. Add UI component (above code)
4. Test with existing leads

### Option B: WhatsApp (Medium - 2 days)
✅ **High impact for India market**
- Requires WhatsApp Business API setup
- Follow Meta documentation
- Implement as shown above

**Steps:**
1. Get WhatsApp Business API access
2. Add database models
3. Implement service layer
4. Create UI components
5. Setup webhook
6. Test with sandbox number

### Option C: Analytics (Complex - 3-4 days)
✅ **Best for data-driven decisions**
- Requires multiple API endpoints
- Chart integrations
- Export functionality

**Steps:**
1. Create analytics API endpoints
2. Build dashboard page
3. Add Recharts visualizations
4. Implement filters
5. Add export features

---

## 💰 COST ESTIMATE

### WhatsApp Business API Pricing (India)
- Marketing messages: ₹0.38 per message
- Utility messages: ₹0.24 per message
- Authentication messages: ₹0.18 per message
- **First 1000 conversations/month: FREE**

### Development Time (if hiring)
- Lead Scoring: 3-4 hours × ₹500/hr = ₹1,500-2,000
- WhatsApp Integration: 2 days × 8hrs × ₹500/hr = ₹8,000
- Advanced Analytics: 3 days × 8hrs × ₹500/hr = ₹12,000
- **Total: ₹21,500-22,000**

---

## 📚 RESOURCES

### Lead Scoring
- Algorithm: `lib/lead-scoring.ts` (already implemented)
- No external dependencies

### WhatsApp
- Meta Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
- Get Started: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- Message Templates: https://business.facebook.com/wa/manage/message-templates

### Analytics
- Recharts: https://recharts.org/
- XLSX: https://www.npmjs.com/package/xlsx
- jsPDF: https://www.npmjs.com/package/jspdf

---

## ✅ IMPLEMENTATION CHECKLIST

### Lead Scoring
- [x] Algorithm implemented
- [x] Schema updated
- [ ] API endpoint created
- [ ] UI component added
- [ ] Auto-calculation on update
- [ ] Sort/filter by score

### WhatsApp
- [ ] Business API access obtained
- [ ] Database models added
- [ ] Service layer implemented
- [ ] API endpoints created
- [ ] UI components built
- [ ] Webhook configured
- [ ] Tested with sandbox

### Analytics
- [ ] Analytics page created
- [ ] API endpoints built
- [ ] Charts integrated
- [ ] Filters implemented
- [ ] Export functionality added
- [ ] Real-time updates working

---

## 🚀 NEXT STEPS

**I recommend:**

1. **Implement Lead Scoring NOW** (2-3 hours)
   - Core logic already done
   - Just need API + UI
   - Immediate value

2. **Setup WhatsApp Next Week** (2 days)
   - Get Business API access (1 day)
   - Implement code (1 day)
   - High impact for India

3. **Build Analytics Later** (3-4 days)
   - When you have more data
   - After team is using system

**Want me to implement Lead Scoring API & UI now?** (30 minutes)

Or **hire a developer** for all 3 features? (5-7 days, ~₹20k)

**Aapko kya karna hai batao!** 🚀
