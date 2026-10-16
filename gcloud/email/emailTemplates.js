const { useEmulators } = require('./config');
const {
  getApiKey,
  getFromEmail,
  getLogWriter,
  saveEmailRecord,
  sendEmailHelper
} = require('./emailDispatcher');

class EmailService {
  getApiKey() {
    return getApiKey();
  }
  getFromEmail() {
    return getFromEmail();
  }
  async getLogWriter() {
    return getLogWriter();
  }
  async saveEmailRecord(emailId, to, from, type, subject, body) {
    return saveEmailRecord(emailId, to, from, type, subject, body);
  }

  async sendThankYouEmail(summary, talentId) {
    const subject = `Welcome to the Talent Hub, ${summary.name}!`;
    const html = `
      <h1>Hi ${summary.name},</h1>
      <p>Thank you for submitting your profile to our Talent Hub.</p>
      <p>Here is a summary of the details we received:</p>
      <ul>
        <li><strong>Name:</strong> ${summary.name}</li>
        <li><strong>Email:</strong> ${summary.email}</li>
        <li><strong>Phone:</strong> ${summary.phone}</li>
        <li><strong>Role:</strong> ${summary.role || 'Not specified'}</li>
        <li><strong>Experience:</strong> ${summary.experience || 'Not specified'} years</li>
        <li><strong>Skills:</strong> ${summary.skills || 'Not specified'}</li>
        <li><strong>LinkedIn:</strong> ${summary.linkedin || 'Not specified'}</li>
      </ul>
      <p>We will review your profile and get back to you shortly.</p>
      <p>Best regards,<br/>The Scriptorium Team</p>
    `;
    return sendEmailHelper({ type: 'thank-you', to: summary.email, subject, html, logMeta: { summary } });
  }

  async sendAcceptanceEmail(summary, talentId) {
    const subject = `Congratulations, ${summary.name}!`;
    const html = `
      <h1>Congratulations ${summary.name},</h1>
      <p>Congratulations you have been accepted to Scriptorium Talent Hub!</p>
      <p>Best regards,<br/>The Scriptorium Team</p>
    `;
    return sendEmailHelper({ type: 'acceptance', to: summary.email, subject, html, logMeta: { name: summary.name }, returnPayload: true });
  }

  async sendRenewalEmail(summary, talentId) {
    const subject = `Renew your data consent, ${summary.name}!`;
    const host = process.env.VITE_FUNCTIONS_EMULATOR_HOST || 'localhost';
    const port = process.env.VITE_FUNCTIONS_EMULATOR_PORT || '5001';
    const projectId = 'scriptorium-503507';
    const region = process.env.VITE_FIREBASE_REGION || 'europe-west2';
    const renewUrl = useEmulators
      ? `http://${host}:${port}/${projectId}/${region}/renewDataRetention?talentId=${talentId}`
      : `https://${region}-${projectId}.cloudfunctions.net/renewDataRetention?talentId=${talentId}`;
    const html = `
      <h1>Hi ${summary.name},</h1>
      <p>Your data retention period at Scriptorium Talent Hub is approaching its expiration.</p>
      <p>Please click the link below to permit us to keep your data for another 2 years:</p>
      <p><a href="${renewUrl}">Permit data retention for another 2 years</a></p>
      <p>Best regards,<br/>The Scriptorium Team</p>
    `;
    return sendEmailHelper({ type: 'renewal', to: summary.email, subject, html, logMeta: { name: summary.name }, returnPayload: true });
  }

  async sendSubscriberWelcomeEmail(email, name, password) {
    const to = typeof email === 'string' ? email : (email.email || email.to);
    const recipientName = typeof email === 'object' ? email.name : name;
    const subPassword = typeof email === 'object' ? name : password;
    const subject = `Welcome to Scriptorium!`;
    const html = `thank you for subscribing to Scriptorium, your password is ${subPassword}`;
    return sendEmailHelper({ type: 'subscriber-welcome', to, subject, html, logMeta: { name: recipientName } });
  }

  async sendTalentCredentialsEmail(summary, talentId) {
    const subject = `Your Scriptorium Talent Hub Credentials`;
    const html = `
      <h1>Hi ${summary.name},</h1>
      <p>Thank you for creating an account on the Scriptorium Talent Hub.</p>
      <p>Here are your login credentials:</p>
      <ul>
        <li><strong>Username:</strong> ${summary.username}</li>
        <li><strong>Password:</strong> ${summary.password}</li>
      </ul>
      <p>You can sign in at any time to track your CV vetting status.</p>
      <p>Best regards,<br/>The Scriptorium Team</p>
    `;
    return sendEmailHelper({ type: 'talent-credentials', to: summary.email, subject, html, logMeta: { name: summary.name } });
  }

  async sendOfferReplyNotification(subscriberEmail) {
    const subject = `New Message regarding candidate offer`;
    const html = `<p>You have a new message please check your dashboard</p>`;
    return sendEmailHelper({ type: 'offer-reply-notification', to: subscriberEmail, subject, html });
  }

  async sendSubscriberReplyNotification(talentEmail, talentName) {
    const subject = `New Message regarding candidate offer`;
    const html = `<p>Hi ${talentName},</p><p>You have received a new message regarding your candidate offer. Please sign in to your Talent Dashboard to view it.</p>`;
    return sendEmailHelper({ type: 'subscriber-reply-notification', to: talentEmail, subject, html });
  }

  async sendTermsUpdatedEmail(talentEmail, talentName, projectName, ir35Status) {
    const subject = `Updated Terms Offered for Project: ${projectName || 'Project'}`;
    const html = `<p>Hi ${talentName || 'Candidate'},</p><p>The hirer has updated the working terms and IR35 determination (${ir35Status || 'Updated'}) for project <strong>${projectName || 'Project'}</strong>.</p><p>Previous terms have been rendered void. Please sign in to your Talent Dashboard to review and re-accept the updated terms.</p>`;
    return sendEmailHelper({ type: 'terms-updated-notification', to: talentEmail, subject, html });
  }

  async sendDirectorInvitationEmail(email, name, inviteLink) {
    const subject = `You have been invited as a Director on Scriptorium`;
    const html = `<p>Hello ${name || email},</p><p>You have been invited by a Platform Curator to set up your Director account on Scriptorium.</p><p><a href="${inviteLink}">Click here to accept invitation & complete Director signup</a></p>`;
    return sendEmailHelper({ type: 'director-invitation', to: email, subject, html });
  }

  async sendPasswordResetEmail(email, resetLink, name) {
    const to = typeof email === 'string' ? email : (email.email || email.to);
    const recipientName = name || (typeof email === 'object' ? email.name : 'User');
    const subject = `Reset Your Scriptorium Password`;
    const html = `
      <h1>Password Reset Request</h1>
      <p>Hi ${recipientName},</p>
      <p>A password reset was requested for your Scriptorium account.</p>
      <p>Please click the button below or copy and paste the link into your browser to reset your password:</p>
      <p style="margin: 20px 0;">
        <a href="${resetLink}" style="background-color: #4f46e5; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
      </p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>This password reset link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
      <p>Best regards,<br/>The Scriptorium Team</p>
    `;
    return sendEmailHelper({ type: 'password-reset', to, subject, html, logMeta: { name: recipientName, resetLink } });
  }
}

module.exports = {
  EmailService
};
