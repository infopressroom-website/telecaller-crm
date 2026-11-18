# 📡 Telecaller CRM - API Documentation

**Version:** 1.0  
**Base URL:** `http://localhost:3000/api`  
**Production URL:** `https://your-domain.com/api`

---

## 🔐 Authentication

All API endpoints (except health check) require authentication.

### Session-based (Web)
```http
Cookie: session=<session-token>
```

### Bearer Token (API - Coming Soon)
```http
Authorization: Bearer <api-token>
```

---

## 📋 Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 1000,
    "totalPages": 20
  }
}
```

### Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

---

## 🏥 Health Check

### GET /health
Check API health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-11-18T10:00:00.000Z",
  "version": "1.0.0"
}
```

---

## 👤 Authentication

### GET /auth/me
Get current authenticated user.

**Response:**
```json
{
  "id": "user-id",
  "email": "user@example.com",
  "name": "User Name",
  "roleKey": "TELECALLER",
  "role": {
    "id": "role-id",
    "key": "TELECALLER",
    "name": "Telecaller"
  },
  "teamId": "team-id",
  "team": {
    "id": "team-id",
    "name": "Team A"
  }
}
```

---

## 📞 Leads

### Export Leads
**GET** `/leads/export?format=csv`  
**GET** `/leads/export?format=xlsx`

**Query Parameters:**
- `format` - `csv` or `xlsx` (required)
- `status` - Filter by status
- `ownerId` - Filter by owner
- `teamId` - Filter by team
- `campaignId` - Filter by campaign
- `sourceId` - Filter by source
- `priority` - Filter by priority
- `from` - Date from (YYYY-MM-DD)
- `to` - Date to (YYYY-MM-DD)

**Response:** File download (CSV or Excel)

### Import Leads
**POST** `/leads/import`

**Body:** `multipart/form-data`
- `file` - CSV or Excel file
- `campaignId` - Campaign ID (optional)
- `sourceId` - Source ID (optional)

**Response:**
```json
{
  "id": "import-job-id",
  "filename": "leads.csv",
  "totalRows": 1000,
  "status": "PROCESSING"
}
```

### Get Import Status
**GET** `/leads/import/[id]`

**Response:**
```json
{
  "id": "import-job-id",
  "filename": "leads.csv",
  "totalRows": 1000,
  "processed": 850,
  "successful": 800,
  "failed": 50,
  "status": "PROCESSING"
}
```

### Download Import Report
**GET** `/leads/import/[id]/report`

**Response:** Excel file with import results

---

## 📊 Reports

### Export Report
**GET** `/reports/[type]/export?format=pdf`

**Path Parameters:**
- `type` - Report type (calls, leads, performance, team)

**Query Parameters:**
- `format` - `pdf`, `csv`, or `xlsx` (required)
- `from` - Date from (YYYY-MM-DD)
- `to` - Date to (YYYY-MM-DD)
- `teamId` - Filter by team
- `userId` - Filter by user

**Response:** File download

---

## 📞 Calls

### Get Call Recording
**GET** `/calls/[id]/recording`

**Response:** Audio file stream or presigned URL

---

## 🔗 Webhooks

### Telephony Webhook (Exotel)
**POST** `/webhooks/telephony/[provider]/[secret]`

**Path Parameters:**
- `provider` - Telephony provider (e.g., `exotel`)
- `secret` - Webhook secret from environment variable

**Body:** Provider-specific webhook payload

**Response:**
```json
{
  "status": "received"
}
```

**Security:** 
- Secret must match `EXOTEL_WEBHOOK_SECRET`
- Validates webhook signature
- Logs all webhook events

---

## ⏰ Cron/Scheduled Tasks

### Run Automation Rules
**POST** `/cron/automation`

**Headers:**
```http
Authorization: Bearer <CRON_SECRET>
```

**Response:**
```json
{
  "processed": 25,
  "succeeded": 20,
  "failed": 5,
  "duration": 1234
}
```

**Security:**
- Requires `CRON_SECRET` from environment
- Should be called every minute by scheduler
- Idempotent (safe to run multiple times)

---

## 🔄 Real-time (Pusher)

### Authenticate Channel
**POST** `/pusher/auth`

**Body:**
```json
{
  "socket_id": "12345.67890",
  "channel_name": "private-user-123"
}
```

**Response:**
```json
{
  "auth": "pusher-key:signature",
  "channel_data": "{\"user_id\":\"123\"}"
}
```

---

## 🚨 Rate Limits

| Endpoint | Limit |
|----------|-------|
| Authentication | 5 per minute per IP |
| API endpoints | 100 per minute per user |
| Webhooks | 1000 per minute |
| Exports | 10 per minute per user |

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1700000000
```

**Rate Limit Exceeded:**
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": "2026-11-18T10:01:00.000Z"
}
```

---

## 📄 Pagination

Paginated endpoints accept:

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)

**Response Meta:**
```json
{
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 1000,
    "totalPages": 20,
    "hasMore": true
  }
}
```

---

## 🔍 Filtering & Sorting

Most list endpoints support:

**Filtering:**
```http
GET /api/v1/leads?status=NEW&priority=HIGH
```

**Sorting:**
```http
GET /api/v1/leads?sort=created_desc
GET /api/v1/leads?sort=name_asc
```

**Available Sort Fields:**
- `created_asc` / `created_desc`
- `updated_asc` / `updated_desc`
- `name_asc` / `name_desc`

---

## ❌ Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid input data |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Server error |

---

## 🔐 Security Best Practices

### For API Consumers

1. **Keep credentials secure**
   - Never commit API keys to version control
   - Use environment variables
   - Rotate keys regularly

2. **Handle rate limits**
   - Implement exponential backoff
   - Cache responses when appropriate
   - Use webhooks instead of polling

3. **Validate responses**
   - Check `success` field
   - Handle errors gracefully
   - Log errors for debugging

4. **Use HTTPS**
   - Always use HTTPS in production
   - Validate SSL certificates

### For API Providers

1. **Authentication**
   - All endpoints require authentication
   - Use strong session secrets
   - Implement token expiration

2. **Input Validation**
   - Validate all inputs with Zod
   - Sanitize user data
   - Prevent injection attacks

3. **Rate Limiting**
   - Protect against brute force
   - Per-user and per-IP limits
   - Different limits for different endpoints

4. **Audit Logging**
   - Log all sensitive operations
   - Track API usage
   - Monitor for abuse

---

## 📚 API Versioning

Current version: **v1**

**URL Structure:**
```
/api/health          # No version (utility)
/api/auth/*          # No version (auth)
/api/v1/*            # Version 1 (future)
```

**Version Strategy:**
- Major changes → new version (v2)
- Minor changes → same version
- Deprecation notice → 6 months minimum

---

## 🧪 Testing

### Development
```bash
# Start dev server
npm run dev

# Test endpoint
curl http://localhost:3000/api/health
```

### With Authentication
```bash
# Login first to get session cookie
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@crm.test","password":"ChangeMe-Dev-Only-123"}'

# Use session cookie
curl -b cookies.txt http://localhost:3000/api/auth/me
```

---

## 📖 Additional Resources

- **OpenAPI/Swagger:** `/api/docs` (Coming Soon)
- **Postman Collection:** Download from repository
- **Code Examples:** See `examples/` directory
- **Support:** GitHub Issues

---

**Last Updated:** November 18, 2026  
**Maintainer:** Development Team
