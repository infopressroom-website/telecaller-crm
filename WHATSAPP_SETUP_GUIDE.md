# WhatsApp Integration Setup Guide

This guide helps you configure Meta WhatsApp Business API for bidirectional messaging with leads in Telecaller CRM.

## Prerequisites

1. A Meta Business Account
2. A WhatsApp Business Account
3. A verified Meta Business App with WhatsApp Business API access
4. A phone number registered with WhatsApp Business API

## Step 1: Create Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/apps)
2. Click **Create App**
3. Select **Business** as app type
4. Fill in app details and create
5. In the dashboard, add **WhatsApp** product

## Step 2: Get Credentials

### Phone Number ID
1. In your Meta App dashboard, go to **WhatsApp → Getting Started**
2. Find **Phone Number ID** in the test number section
3. Copy this value for `WHATSAPP_PHONE_NUMBER_ID`

### Access Token
1. In the same section, find **Temporary access token**
2. For production, generate a **Permanent Access Token**:
   - Go to **System Users** in Business Settings
   - Create a system user or select existing
   - Assign the WhatsApp Business Management permission
   - Generate token and copy for `WHATSAPP_ACCESS_TOKEN`

### Business Account ID
1. In your Meta App dashboard, go to **WhatsApp → Getting Started**
2. Find **WhatsApp Business Account ID**
3. Copy for `WHATSAPP_BUSINESS_ACCOUNT_ID`

### Verify Token
1. Generate a secure random string (24+ characters):
   ```bash
   openssl rand -hex 24
   ```
2. Use this value for `WHATSAPP_VERIFY_TOKEN`

## Step 3: Configure Environment Variables

Add these to your `.env` file (never commit these to git):

```env
WHATSAPP_PHONE_NUMBER_ID="your_phone_number_id"
WHATSAPP_ACCESS_TOKEN="your_access_token"
WHATSAPP_BUSINESS_ACCOUNT_ID="your_business_account_id"
WHATSAPP_VERIFY_TOKEN="your_random_verify_token_min_24_chars"
```

**Important:** Restart your application after adding these variables.

## Step 4: Configure Webhook in Meta

1. In Meta App dashboard, go to **WhatsApp → Configuration → Webhook**
2. Click **Edit**
3. Enter Callback URL:
   ```
   https://your-domain.com/api/whatsapp/webhook
   ```
   Replace `your-domain.com` with your actual domain (must be HTTPS)

4. Enter Verify Token:
   Use the same value you set for `WHATSAPP_VERIFY_TOKEN`

5. Click **Verify and Save**

6. Subscribe to webhook fields:
   - ☑️ messages
   - ☑️ message_status

## Step 5: Enable in CRM

1. Log in to Telecaller CRM as an administrator
2. Go to **Settings → WhatsApp**
3. Click **Test Credentials** to verify connection
4. Enable **WhatsApp messaging** toggle
5. Click **Sync Templates** to load approved message templates

## Step 6: Create Message Templates

WhatsApp requires approved templates for initiating conversations (first message in 24-hour window):

1. In Meta Business Manager, go to **WhatsApp Manager → Message Templates**
2. Click **Create Template**
3. Choose category (Marketing, Utility, or Authentication)
4. Design your template with variables like `{{1}}`, `{{2}}`, etc.
5. Submit for approval (usually takes a few minutes to a few hours)
6. Once approved, sync templates in CRM: **Settings → WhatsApp → Sync Templates**

### Template Best Practices

- Keep messages clear and professional
- Use variables for personalization (customer name, appointment time, etc.)
- Include opt-out language for marketing messages
- Test templates with test phone numbers before using with leads

## Usage in CRM

### Sending Messages

1. Open a lead's detail page
2. Go to the **WhatsApp** tab
3. **First message:** Click "Send Template" and select an approved template
4. **Follow-up messages:** Type directly in the message composer (within 24-hour window)

### Receiving Messages

- Incoming messages automatically appear in the lead's WhatsApp tab
- Lead owner receives in-app notification
- Messages are logged in the lead timeline

## Troubleshooting

### "WhatsApp messaging is not configured"
- Verify all environment variables are set correctly
- Restart the application after adding variables
- Check Settings → WhatsApp shows "Active" status

### Webhook verification fails
- Ensure APP_URL in `.env` is your public HTTPS domain
- Verify `WHATSAPP_VERIFY_TOKEN` matches exactly between `.env` and Meta dashboard
- Check server logs for webhook errors

### "Invalid request: Template not found"
- Template must be approved in Meta dashboard
- Run **Sync Templates** in Settings → WhatsApp
- Wait a few minutes after approval before syncing

### Messages not sending
- Check phone number format (must be E.164: +919876543210)
- Verify lead has valid mobile number
- First message to a lead must use an approved template
- Check API rate limits (1000 messages per day for test numbers)

### Incoming messages not appearing
- Verify webhook is configured correctly in Meta dashboard
- Check webhook fields are subscribed: messages, message_status
- Test with Meta test number first
- Check server logs at `/api/whatsapp/webhook`

## Production Checklist

- [ ] Permanent Access Token generated (not temporary)
- [ ] Production phone number verified and approved
- [ ] Webhook configured with HTTPS callback URL
- [ ] Message templates approved for production use
- [ ] Rate limits understood (check Meta Business Manager)
- [ ] Privacy policy URL added to Meta app settings
- [ ] Data processing addendum signed with Meta
- [ ] Test end-to-end flow with real phone numbers
- [ ] Monitor webhook events in WhatsAppWebhookEvent table

## API Limits

**Test Phone Number:**
- 250 conversations per month
- 1000 messages per day

**Production:**
- Depends on your Meta Business verification level
- Check limits in WhatsApp Manager → Insights

## Support Resources

- [Meta WhatsApp Cloud API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Message Templates Guide](https://developers.facebook.com/docs/whatsapp/message-templates)
- [Webhook Setup](https://developers.facebook.com/docs/graph-api/webhooks/getting-started)
- [Error Codes Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)

## Security Notes

- **Never commit** `.env` file to version control
- Access tokens have full API access - protect them carefully
- Rotate tokens periodically
- Use system users (not personal users) for production tokens
- Monitor webhook logs for suspicious activity
- Verify webhook signatures if Meta implements them (currently optional)
