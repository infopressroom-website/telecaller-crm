# 👨‍💻 Developer Guide - Telecaller CRM

Welcome to the team! This guide will help you understand the codebase and start contributing.

---

## 📚 Table of Contents

1. [Getting Started](#getting-started)
2. [Project Structure](#project-structure)
3. [Tech Stack](#tech-stack)
4. [Development Workflow](#development-workflow)
5. [Coding Standards](#coding-standards)
6. [Common Tasks](#common-tasks)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+ (check: `node --version`)
- **PostgreSQL** 15+ (check: `psql --version`)
- **Git** (check: `git --version`)
- **Code Editor:** VS Code recommended

### First Time Setup

```bash
# 1. Clone repository
git clone https://github.com/your-org/telecaller-crm.git
cd telecaller-crm

# 2. Install dependencies
npm install

# 3. Setup environment
copy .env.example .env
# Edit .env with your database credentials

# 4. Setup database
npm run db:migrate
npm run db:seed
npm run db:seed:demo

# 5. Start development server
npm run dev
```

**Or use the automated script:**
```powershell
.\scripts\quick-start.ps1
```

### VS Code Extensions (Recommended)

Install these for better development experience:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "ms-vscode.powershell"
  ]
}
```

---

## 📁 Project Structure

```
telecaller-crm/
├── app/                      # Next.js app directory (routes)
│   ├── (app)/               # Main application pages
│   │   ├── leads/          # Lead management
│   │   ├── calls/          # Call logs
│   │   ├── team/           # Team management
│   │   └── ...             # Other features
│   ├── (auth)/             # Authentication pages
│   ├── (admin)/            # Admin pages
│   ├── (telecaller)/       # Telecaller workspace
│   ├── api/                # API routes
│   │   ├── auth/          # Auth endpoints
│   │   ├── leads/         # Lead endpoints
│   │   └── ...
│   └── actions/            # Server actions
│
├── components/              # Reusable React components
│   ├── ui/                 # UI primitives (Button, Input, etc.)
│   └── layout/             # Layout components
│
├── features/               # Feature-specific components
│   ├── leads/             # Lead feature components
│   ├── calls/             # Call feature components
│   └── ...
│
├── lib/                    # Shared utilities
│   ├── auth/              # Authentication utilities
│   ├── db.ts              # Database client
│   ├── permissions.ts     # RBAC definitions
│   └── ...
│
├── services/              # Business logic layer
│   ├── lead-service.ts    # Lead operations
│   ├── call-service.ts    # Call operations
│   ├── auth-service.ts    # Auth operations
│   └── ...
│
├── prisma/                # Database
│   ├── schema.prisma      # Database schema
│   ├── migrations/        # Migration history
│   └── seed.ts           # Seed data
│
├── validations/           # Zod schemas
│   ├── lead.ts           # Lead validation
│   ├── user.ts           # User validation
│   └── ...
│
├── scripts/              # Utility scripts
│   ├── quick-start.ps1
│   ├── database-tools.ps1
│   └── ...
│
└── public/              # Static assets
```

### Key Files

- **`app/layout.tsx`** - Root layout
- **`lib/db.ts`** - Prisma client singleton
- **`lib/auth/session.ts`** - Session management
- **`lib/permissions.ts`** - Role-based access control
- **`middleware.ts`** - Edge middleware (redirects, etc.)

---

## 🛠 Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS
- **Server Components** - Default rendering strategy

### Backend
- **Next.js API Routes** - Backend endpoints
- **Prisma** - Database ORM
- **PostgreSQL** - Relational database
- **Zod** - Runtime validation
- **bcrypt** - Password hashing

### Key Patterns
- **Server Actions** for mutations
- **Server Components** for data fetching
- **Services layer** for business logic
- **Repository pattern** via Prisma

---

## 💻 Development Workflow

### Branch Strategy

```bash
main            # Production-ready code
├── develop     # Development branch
│   ├── feature/lead-import
│   ├── feature/call-recording
│   ├── bugfix/login-error
│   └── hotfix/security-patch
```

### Creating a Feature

```bash
# 1. Create branch from develop
git checkout develop
git pull
git checkout -b feature/your-feature-name

# 2. Make changes
# ... code ...

# 3. Commit with descriptive message
git add .
git commit -m "feat: add lead import validation"

# 4. Push and create PR
git push origin feature/your-feature-name
```

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: bug fix
docs: documentation changes
style: formatting changes
refactor: code refactoring
test: add/update tests
chore: maintenance tasks
```

**Examples:**
```bash
git commit -m "feat: add lead bulk assignment"
git commit -m "fix: resolve login session timeout"
git commit -m "refactor: optimize lead list query"
```

---

## 📏 Coding Standards

### TypeScript

```typescript
// ✅ Good: Type everything
interface LeadData {
  name: string;
  phone: string;
  email?: string;
}

async function createLead(data: LeadData): Promise<Lead> {
  // ...
}

// ❌ Bad: Using 'any'
async function createLead(data: any) {
  // ...
}
```

### Components

```typescript
// ✅ Good: Server Component (default)
export default async function LeadsPage() {
  const leads = await getLeads();
  return <LeadTable leads={leads} />;
}

// ✅ Good: Client Component (when needed)
'use client';
export function LeadForm({ onSubmit }: LeadFormProps) {
  const [loading, setLoading] = useState(false);
  // ...
}
```

### Services

```typescript
// ✅ Good: Services handle business logic
export async function createLead(
  user: AuthUser,
  data: LeadInput
): Promise<Lead> {
  // Check permissions
  assertCan(user, 'lead', 'CREATE');
  
  // Validate input
  const validated = leadSchema.parse(data);
  
  // Business logic
  const leadCode = generateLeadCode();
  
  // Database operation
  const lead = await db.lead.create({
    data: { ...validated, leadCode }
  });
  
  // Audit log
  await audit({
    actorId: user.id,
    action: 'lead.created',
    entityType: 'Lead',
    entityId: lead.id
  });
  
  return lead;
}
```

### Naming Conventions

```typescript
// Files
lead-service.ts          // Services
LeadTable.tsx           // Components
lead.ts                 // Types/schemas
use-lead-form.ts        // Hooks

// Variables
const leadList = [];    // camelCase
const MAX_LEADS = 100;  // UPPER_CASE for constants

// Functions
function getLeadById()  // Verbs for functions
function createLead()
function updateLead()

// Components
function LeadTable()    // PascalCase
function LeadForm()
```

---

## 🔧 Common Tasks

### Adding a New Page

```bash
# 1. Create page file
# app/(app)/my-feature/page.tsx

import { requirePagePermission } from '@/lib/auth/session';

export default async function MyFeaturePage() {
  const user = await requirePagePermission('feature', 'VIEW');
  
  return (
    <div>
      <h1>My Feature</h1>
    </div>
  );
}
```

### Adding a New API Endpoint

```typescript
// app/api/my-endpoint/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { z } from 'zod';

const inputSchema = z.object({
  name: z.string(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const validated = inputSchema.parse(body);
    
    // Your logic here
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
```

### Adding a Database Model

```prisma
// 1. Add to prisma/schema.prisma
model MyModel {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([name])
}
```

```bash
# 2. Create migration
npx prisma migrate dev --name add_my_model

# 3. Generate client
npx prisma generate
```

### Adding a Server Action

```typescript
// app/actions/my-actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/session';

export async function myAction(formData: FormData) {
  const user = await requireUser();
  
  // Validate
  const name = formData.get('name') as string;
  if (!name) throw new Error('Name is required');
  
  // Business logic
  // ...
  
  // Revalidate cache
  revalidatePath('/my-page');
  
  return { success: true };
}
```

---

## 🧪 Testing

### Unit Tests

```typescript
// services/__tests__/lead-service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createLead } from '../lead-service';

describe('Lead Service', () => {
  beforeEach(async () => {
    // Setup test database
    await db.lead.deleteMany();
  });
  
  it('should create a lead', async () => {
    const lead = await createLead(mockUser, {
      name: 'Test Lead',
      primaryMobile: '919876543210',
    });
    
    expect(lead.name).toBe('Test Lead');
    expect(lead.leadCode).toMatch(/^LD-/);
  });
  
  it('should throw error for invalid phone', async () => {
    await expect(
      createLead(mockUser, {
        name: 'Test',
        primaryMobile: 'invalid',
      })
    ).rejects.toThrow();
  });
});
```

### Running Tests

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific test
npm run test lead-service

# Watch mode
npm run test:watch
```

---

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Failed

```bash
# Check if PostgreSQL is running
Get-Service postgresql*

# Test connection
psql -U postgres -d telecaller_crm -c "SELECT 1;"

# Check DATABASE_URL in .env
cat .env | Select-String "DATABASE_URL"
```

#### TypeScript Errors

```bash
# Regenerate Prisma client
npm run db:generate

# Clean and rebuild
Remove-Item -Recurse -Force .next
npm run build
```

#### Port Already in Use

```bash
# Find process using port 3000
Get-NetTCPConnection -LocalPort 3000

# Kill process
Stop-Process -Id <PID>

# Or use different port
$env:PORT=3001; npm run dev
```

#### Authentication Not Working

```bash
# Clear session cookies
# Go to browser DevTools > Application > Cookies > Delete

# Check AUTH_SECRET is set
cat .env | Select-String "AUTH_SECRET"

# Regenerate AUTH_SECRET if needed
$secret = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).Guid * 3))
echo "AUTH_SECRET=$secret"
```

---

## 📚 Resources

### Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Internal Docs
- `AUDIT_REPORT.md` - Security analysis
- `IMPLEMENTATION_ROADMAP.md` - Feature roadmap
- `DEPLOYMENT_GUIDE.md` - Deployment instructions
- `CHECKLIST.md` - Task checklist

### Tools
- **Prisma Studio** - Database GUI: `npm run db:studio`
- **Type checking** - `npm run typecheck`
- **Linting** - `npm run lint`
- **Database tools** - `.\scripts\database-tools.ps1`

---

## 🤝 Getting Help

### Before Asking
1. Check this guide
2. Search existing issues on GitHub
3. Check the documentation
4. Try debugging with console.log

### When Asking
Include:
- What you're trying to do
- What you expected
- What actually happened
- Steps to reproduce
- Error messages (full stack trace)
- Your environment (OS, Node version, etc.)

### Channels
- **Slack:** #dev-telecaller-crm
- **GitHub Issues:** Bug reports and feature requests
- **Code Review:** Pull requests

---

## 🎯 Next Steps

1. **Explore the codebase**
   - Read through key files
   - Understand the architecture
   - Check existing features

2. **Pick a task**
   - Check GitHub issues
   - Look for "good first issue" labels
   - Ask team lead for suggestions

3. **Make your first contribution**
   - Fix a small bug
   - Improve documentation
   - Add a test
   - Refactor code

4. **Learn and grow**
   - Review others' PRs
   - Share knowledge
   - Improve processes

---

**Welcome to the team! Happy coding! 🚀**

---

*Last updated: November 18, 2026*
