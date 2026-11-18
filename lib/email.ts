/**
 * Email service with multiple provider support
 * Primary: Resend, Fallback: SendGrid, Console logging in dev
 */

import { Resend } from 'resend';
import { env, isDevelopment } from './env';

let resend: Resend | null = null;
let emailAvailable = false;

// Initialize Resend if configured
if (env.RESEND_API_KEY) {
  try {
    resend = new Resend(env.RESEND_API_KEY);
    emailAvailable = true;
    console.log('✓ Resend email service initialized');
  } catch (error) {
    console.error('Failed to initialize Resend:', error);
  }
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

/**
 * Send email using configured provider
 * Falls back to console logging in development if no provider configured
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const from = options.from || env.EMAIL_FROM || 'CRM <noreply@crm.test>';
  
  // Development mode - log to console
  if (isDevelopment && !emailAvailable) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email (Development Mode)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`From: ${from}`);
    console.log(`To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(options.text || options.html);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return true;
  }
  
  // Production mode without email configured
  if (!emailAvailable) {
    console.warn('Email service not configured. Email not sent:', options.subject);
    return false;
  }
  
  try {
    // Try Resend
    if (resend) {
      const result = await resend.emails.send({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        cc: options.cc,
        bcc: options.bcc,
      });
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      return true;
    }
    
    // TODO: Add SendGrid fallback if needed
    
    return false;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetLink: string
): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Reset Your Password</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
    <p style="margin-top: 0;">Hello,</p>
    
    <p>We received a request to reset your password for your Telecaller CRM account.</p>
    
    <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" style="display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600;">Reset Password</a>
    </div>
    
    <p style="font-size: 14px; color: #6b7280;">If you didn't request a password reset, you can safely ignore this email.</p>
    
    <p style="font-size: 14px; color: #6b7280;">For security, the link above will only work once. If you need to reset your password again, please request a new link.</p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #9ca3af; margin: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="font-size: 12px; color: #667eea; word-break: break-all; margin: 5px 0 0 0;">${resetLink}</p>
  </div>
</body>
</html>
  `.trim();
  
  const text = `
Reset Your Password

We received a request to reset your password for your Telecaller CRM account.

Click the link below to reset your password (expires in 1 hour):
${resetLink}

If you didn't request a password reset, you can safely ignore this email.
  `.trim();
  
  return sendEmail({
    to: email,
    subject: 'Reset Your Password - Telecaller CRM',
    html,
    text,
  });
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(
  email: string,
  name: string,
  tempPassword: string
): Promise<boolean> {
  const loginUrl = `${env.APP_URL}/login`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Telecaller CRM</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Telecaller CRM!</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
    <p style="margin-top: 0;">Hi ${name},</p>
    
    <p>Your account has been created successfully! You can now access the Telecaller CRM system.</p>
    
    <div style="background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-weight: 600;">Your Login Credentials:</p>
      <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
      <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${tempPassword}</code></p>
    </div>
    
    <p style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px; font-size: 14px;">
      ⚠️ <strong>Important:</strong> You will be required to change this password on your first login for security purposes.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginUrl}" style="display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600;">Login Now</a>
    </div>
    
    <p style="font-size: 14px; color: #6b7280;">If you have any questions or need help getting started, please contact your administrator.</p>
  </div>
</body>
</html>
  `.trim();
  
  const text = `
Welcome to Telecaller CRM!

Hi ${name},

Your account has been created successfully!

Login Credentials:
Email: ${email}
Temporary Password: ${tempPassword}

IMPORTANT: You will be required to change this password on your first login.

Login here: ${loginUrl}
  `.trim();
  
  return sendEmail({
    to: email,
    subject: 'Welcome to Telecaller CRM - Your Account Details',
    html,
    text,
  });
}

/**
 * Send lead assignment notification
 */
export async function sendLeadAssignmentEmail(
  email: string,
  userName: string,
  leadName: string,
  leadCode: string
): Promise<boolean> {
  const leadUrl = `${env.APP_URL}/leads/${leadCode}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Lead Assigned</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #10b981; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">🎯 New Lead Assigned</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
    <p style="margin-top: 0;">Hi ${userName},</p>
    
    <p>A new lead has been assigned to you:</p>
    
    <div style="background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 18px; font-weight: 600; color: #667eea;">${leadName}</p>
      <p style="margin: 5px 0; font-size: 14px; color: #6b7280;">Lead Code: ${leadCode}</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${leadUrl}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600;">View Lead</a>
    </div>
    
    <p style="font-size: 14px; color: #6b7280;">Login to the system to view full lead details and start your follow-up.</p>
  </div>
</body>
</html>
  `.trim();
  
  const text = `
New Lead Assigned

Hi ${userName},

A new lead has been assigned to you:
Lead: ${leadName}
Code: ${leadCode}

View lead: ${leadUrl}
  `.trim();
  
  return sendEmail({
    to: email,
    subject: `New Lead Assigned: ${leadName}`,
    html,
    text,
  });
}

/**
 * Send follow-up reminder
 */
export async function sendFollowUpReminderEmail(
  email: string,
  userName: string,
  leadName: string,
  dueDate: string,
  notes: string
): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Follow-up Reminder</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f59e0b; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">⏰ Follow-up Reminder</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
    <p style="margin-top: 0;">Hi ${userName},</p>
    
    <p>You have a follow-up due:</p>
    
    <div style="background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 18px; font-weight: 600;">${leadName}</p>
      <p style="margin: 5px 0; color: #f59e0b;"><strong>Due:</strong> ${dueDate}</p>
      ${notes ? `<p style="margin: 10px 0 0 0; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280;">${notes}</p>` : ''}
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${env.APP_URL}/follow-ups" style="display: inline-block; background: #f59e0b; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600;">View Follow-ups</a>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  return sendEmail({
    to: email,
    subject: `Follow-up Reminder: ${leadName}`,
    html,
  });
}

/**
 * Check if email service is available
 */
export function isEmailAvailable(): boolean {
  return emailAvailable || isDevelopment;
}
