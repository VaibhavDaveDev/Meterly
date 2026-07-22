/**
 * Email templates following Meterly's minimal design system
 * - No gradients, no excessive colors
 * - Clean typography, proper spacing
 * - Meterly logo at the top
 */

const METERLY_LOGO_SVG = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#064E3B"/><path d="M13 6L7 12h5l-1 6 6-6h-5l1-6z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const baseStyles = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica', 'Arial', sans-serif;
  color: #0A0A0F;
  line-height: 1.6;
  max-width: 600px;
  margin: 0 auto;
  padding: 40px 20px;
`;

const buttonStyle = `
  display: inline-block;
  padding: 12px 24px;
  background-color: #064E3B;
  color: white !important;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 500;
  margin: 20px 0;
`;

const buttonDangerStyle = `
  display: inline-block;
  padding: 12px 24px;
  background-color: #DC2626;
  color: white !important;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 500;
  margin: 20px 0;
`;

const footerStyle = `
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #E5E7EB;
  font-size: 13px;
  color: #64748B;
`;

/** Escape special HTML characters in user-supplied strings to prevent broken markup. */
function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function emailWrapper(content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="${baseStyles}">
      <div style="text-align: left;">
        ${METERLY_LOGO_SVG}
        <h1 style="font-size: 18px; font-weight: 600; margin: 16px 0 0 0; color: #0A0A0F;">Meterly</h1>
      </div>
      <div style="margin-top: 32px;">
        ${content}
      </div>
      <div style="${footerStyle}">
        <p style="margin: 0 0 8px 0;">Need help? Contact us at <a href="mailto:meterly.support@protonmail.com" style="color: #064E3B; text-decoration: none;">meterly.support@protonmail.com</a></p>
        <p style="margin: 0; color: #9CA3AF;">© 2026 Meterly. Transparent utility billing.</p>
      </div>
    </body>
    </html>
  `;
}

export function emailVerificationTemplate(otp: string): { subject: string; html: string } {
  return {
    subject: 'Verify your Meterly email',
    html: emailWrapper(`
      <p style="margin: 0 0 16px 0; font-size: 15px;">Welcome to Meterly. Verify your email address with this code:</p>
      <div style="background-color: #F8FAFC; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
        <p style="font-size: 36px; font-weight: 700; letter-spacing: 8px; margin: 0; font-family: monospace; color: #064E3B;">${otp}</p>
      </div>
      <p style="margin: 0; font-size: 14px; color: #64748B;">This code expires in 10 minutes. If you didn't create a Meterly account, you can ignore this email.</p>
    `),
  };
}

export function passwordResetTemplate(otp: string): { subject: string; html: string } {
  return {
    subject: 'Your Meterly password reset code',
    html: emailWrapper(`
      <p style="margin: 0 0 16px 0; font-size: 15px;">You requested a password reset for your Meterly account. Use this code to continue:</p>
      <div style="background-color: #F8FAFC; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
        <p style="font-size: 36px; font-weight: 700; letter-spacing: 8px; margin: 0; font-family: monospace; color: #064E3B;">${otp}</p>
      </div>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748B;">This code expires in 10 minutes.</p>
      <p style="margin: 0; font-size: 14px; color: #64748B;">If you didn't request this, you can safely ignore this email — your password has not been changed.</p>
    `),
  };
}

export function tenantInviteTemplate(ownerName: string, propertyName: string, inviteUrl: string): { subject: string; html: string } {
  const safeOwnerName = escapeHtml(ownerName);
  const safePropertyName = escapeHtml(propertyName);
  return {
    subject: `${ownerName} invited you to Meterly`,
    html: emailWrapper(`
      <p style="margin: 0 0 16px 0; font-size: 15px;"><strong>${safeOwnerName}</strong> invited you to track electricity bills for <strong>${safePropertyName}</strong>.</p>
      <a href="${inviteUrl}" style="${buttonStyle}">Accept invitation</a>
      <p style="margin: 0; font-size: 14px; color: #64748B;">This link expires in 7 days. If you don't have an account, you'll create one when accepting.</p>
    `),
  };
}

export function passwordChangedTemplate(dateStr: string, timeStr: string): { subject: string; html: string } {
  return {
    subject: 'Your Meterly password has been changed',
    html: emailWrapper(`
      <p style="margin: 0 0 16px 0; font-size: 15px;">This is a confirmation that the password for your Meterly account has been successfully changed.</p>
      <div style="background-color: #F8FAFC; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #0A0A0F;"><strong>Change details:</strong></p>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #64748B;">Date: ${dateStr}</p>
        <p style="margin: 0; font-size: 14px; color: #64748B;">Time: ${timeStr}</p>
      </div>
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748B;"><strong>Wasn't you?</strong> If you did not make this change, reset your password immediately:</p>
      <a href="https://meterly.pages.dev/forgot-password" style="${buttonDangerStyle}">Reset my password now</a>
      <p style="margin: 8px 0 0 0; font-size: 13px; color: #9CA3AF;">Or contact us at <a href="mailto:meterly.support@protonmail.com" style="color: #064E3B; text-decoration: none;">meterly.support@protonmail.com</a> if you need immediate assistance.</p>
    `),
  };
}
