const http = require('http');
const { createCloudFunction } = require('./config');
const { EmailService } = require('./emailTemplates');

const emailServiceInstance = new EmailService();

const handleSendEmail = async (req, res) => {
  const body = req.body || {};
  const actionType = body.action || body.type || req.query?.action;

  try {
    let result;
    if (actionType === 'sendThankYouEmail') {
      const targetEmail = body.summary?.email || body.email;
      if (!targetEmail) return res.status(400).json({ error: 'Recipient email is required for sendThankYouEmail' });
      result = await emailServiceInstance.sendThankYouEmail(body.summary || body, body.talentId);
    } else if (actionType === 'sendAcceptanceEmail') {
      const targetEmail = body.summary?.email || body.email;
      if (!targetEmail) return res.status(400).json({ error: 'Recipient email is required for sendAcceptanceEmail' });
      result = await emailServiceInstance.sendAcceptanceEmail(body.summary || body, body.talentId);
    } else if (actionType === 'sendRenewalEmail') {
      const targetEmail = body.summary?.email || body.email;
      if (!targetEmail) return res.status(400).json({ error: 'Recipient email is required for sendRenewalEmail' });
      result = await emailServiceInstance.sendRenewalEmail(body.summary || body, body.talentId);
    } else if (actionType === 'sendHirerWelcomeEmail' || actionType === 'sendSubscriberWelcomeEmail') {
      const targetEmail = typeof body.email === 'string' ? body.email : (body.email?.email || body.email?.to || body.to);
      if (!targetEmail) return res.status(400).json({ error: 'Recipient email is required for welcome email' });
      result = await emailServiceInstance.sendSubscriberWelcomeEmail(body.email || body, body.name, body.password);
    } else if (actionType === 'sendTalentCredentialsEmail' || actionType === 'sendCredentialsEmail') {
      const targetEmail = body.summary?.email || body.email;
      if (!targetEmail) return res.status(400).json({ error: 'Recipient email is required for credentials email' });
      if (body.summary && body.username) {
        result = await emailServiceInstance.sendTalentCredentialsEmail({ ...body.summary, username: body.username, password: body.password }, body.talentId);
      } else {
        result = await emailServiceInstance.sendTalentCredentialsEmail(body.summary || body, body.talentId);
      }
    } else if (actionType === 'sendOfferReplyNotification') {
      const targetEmail = body.hirerEmail || body.subscriberEmail || body.email;
      if (!targetEmail) return res.status(400).json({ error: 'Recipient hirerEmail is required for sendOfferReplyNotification' });
      result = await emailServiceInstance.sendOfferReplyNotification(targetEmail);
    } else if (actionType === 'sendHirerReplyNotification' || actionType === 'sendSubscriberReplyNotification') {
      const targetEmail = body.talentEmail || body.email;
      if (!targetEmail) return res.status(400).json({ error: 'Recipient talentEmail is required for sendHirerReplyNotification' });
      result = await emailServiceInstance.sendSubscriberReplyNotification(targetEmail, body.talentName || body.name);
    } else if (actionType === 'sendTermsUpdatedEmail') {
      const targetEmail = body.talentEmail || body.email;
      if (!targetEmail) return res.status(400).json({ error: 'Recipient talentEmail is required for sendTermsUpdatedEmail' });
      result = await emailServiceInstance.sendTermsUpdatedEmail(targetEmail, body.talentName || body.name, body.projectName, body.ir35Status);
    } else if (actionType === 'sendDirectorInvitationEmail' || actionType === 'sendCustomEmail') {
      const targetEmail = typeof body.to === 'string' ? body.to : body.email;
      if (!targetEmail) return res.status(400).json({ error: 'Recipient email is required for Director invitation email' });
      result = await emailServiceInstance.sendDirectorInvitationEmail(targetEmail, body.name, body.inviteLink);
    } else if (actionType === 'sendPasswordResetEmail') {
      const targetEmail = body.to || body.email || body.summary?.email;
      if (!targetEmail) return res.status(400).json({ error: 'Recipient email is required for sendPasswordResetEmail' });
      result = await emailServiceInstance.sendPasswordResetEmail(targetEmail, body.resetLink, body.name);
    } else {
      return res.status(400).json({ error: `Unknown email action type: ${actionType}` });
    }

    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error(`Error in emailService [${actionType}]:`, err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

const emailService = createCloudFunction('Email Service', handleSendEmail);

const PORT = parseInt(process.env.VITE_EMAIL_SERVICE_PORT || '8085', 10);
if (require.main === module) {
  const server = http.createServer(emailService);
  server.listen(PORT, () => {
    console.log(`[Email Service] listening on http://127.0.0.1:${PORT}`);
  });
}

module.exports = emailService;
module.exports.emailService = emailService;
module.exports.emailServiceInstance = emailServiceInstance;
module.exports.EmailService = EmailService;
