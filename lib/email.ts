// Email utility functions for PTO notifications
// Note: This uses a basic implementation. Configure SMTP settings in environment variables.

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

interface PTOEmailData {
  providerName: string;
  providerEmail?: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  timeBlock: string;
  reason?: string;
  adminName?: string;
  adminComment?: string;
}

// For now, this logs the email. In production, integrate with an email service.
async function sendEmail(options: EmailOptions): Promise<boolean> {
  // TODO: Implement actual email sending with SMTP or a service like SendGrid
  // For now, we'll log the email details
  console.log('=== EMAIL NOTIFICATION ===');
  console.log('To:', options.to);
  console.log('Subject:', options.subject);
  console.log('Body:', options.html);
  console.log('==========================');

  // In production, use something like:
  // const nodemailer = require('nodemailer');
  // const transporter = nodemailer.createTransport({
  //   host: process.env.SMTP_HOST,
  //   port: parseInt(process.env.SMTP_PORT || '587'),
  //   auth: {
  //     user: process.env.SMTP_USER,
  //     pass: process.env.SMTP_PASSWORD,
  //   },
  // });
  // await transporter.sendMail(options);

  return true;
}

export async function sendPTOSubmissionEmail(data: PTOEmailData): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';

  const dateRange = data.startDate === data.endDate
    ? data.startDate
    : `${data.startDate} to ${data.endDate}`;

  const html = `
    <h2>New PTO Request Submitted</h2>
    <p>A new PTO request has been submitted and requires your attention.</p>
    <table style="border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Provider</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${data.providerName}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Dates</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${dateRange}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Leave Type</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${data.leaveType}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Time Block</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${data.timeBlock === 'FULL' ? 'Full Day' : data.timeBlock}</td>
      </tr>
      ${data.reason ? `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Reason</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${data.reason}</td>
      </tr>
      ` : ''}
    </table>
    <p>Please log in to the <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/pto-requests">admin panel</a> to review this request.</p>
    <hr style="margin: 20px 0;" />
    <p style="color: #666; font-size: 12px;">MSW Cardiology Scheduler</p>
  `;

  return sendEmail({
    to: adminEmail,
    subject: `PTO Request: ${data.providerName} - ${dateRange}`,
    html,
  });
}

export async function sendPTOApprovalEmail(data: PTOEmailData): Promise<boolean> {
  if (!data.providerEmail) {
    console.log('No provider email configured, skipping approval notification');
    return false;
  }

  const dateRange = data.startDate === data.endDate
    ? data.startDate
    : `${data.startDate} to ${data.endDate}`;

  const html = `
    <h2>PTO Request Approved</h2>
    <p>Your PTO request has been approved.</p>
    <table style="border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Dates</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${dateRange}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Leave Type</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${data.leaveType}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Time Block</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${data.timeBlock === 'FULL' ? 'Full Day' : data.timeBlock}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Approved By</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${data.adminName || 'Admin'}</td>
      </tr>
      ${data.adminComment ? `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Comment</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${data.adminComment}</td>
      </tr>
      ` : ''}
    </table>
    <p style="color: #059669; font-weight: bold;">Your time off has been confirmed!</p>
    <hr style="margin: 20px 0;" />
    <p style="color: #666; font-size: 12px;">MSW Cardiology Scheduler</p>
  `;

  return sendEmail({
    to: data.providerEmail,
    subject: `PTO Approved: ${dateRange}`,
    html,
  });
}

export async function sendPTODenialEmail(data: PTOEmailData): Promise<boolean> {
  if (!data.providerEmail) {
    console.log('No provider email configured, skipping denial notification');
    return false;
  }

  const dateRange = data.startDate === data.endDate
    ? data.startDate
    : `${data.startDate} to ${data.endDate}`;

  const html = `
    <h2>PTO Request Denied</h2>
    <p>Unfortunately, your PTO request has been denied.</p>
    <table style="border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Dates</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${dateRange}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Leave Type</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${data.leaveType}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Reviewed By</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${data.adminName || 'Admin'}</td>
      </tr>
      ${data.adminComment ? `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Reason for Denial</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${data.adminComment}</td>
      </tr>
      ` : ''}
    </table>
    <p>If you have questions, please contact the scheduling administrator.</p>
    <hr style="margin: 20px 0;" />
    <p style="color: #666; font-size: 12px;">MSW Cardiology Scheduler</p>
  `;

  return sendEmail({
    to: data.providerEmail,
    subject: `PTO Request Denied: ${dateRange}`,
    html,
  });
}
