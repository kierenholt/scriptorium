const admin = require('firebase-admin');
const { logToFirestore, useEmulators, loadEnv } = require('./config');
const { sendMailDevSmtp } = require('./smtpTransport');

function getApiKey() {
  return process.env.RESEND_API_KEY;
}

function getFromEmail() {
  if (!process.env.RESEND_FROM_EMAIL && typeof loadEnv === 'function') {
    loadEnv();
  }
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error('RESEND_FROM_EMAIL environment variable is required');
  }
  return fromEmail;
}

async function getLogWriter() {
  return async (level, message, details = null) => {
    try {
      await logToFirestore(level, message, details);
    } catch (err) {
      console.error(`Failed to write telemetry log to Firestore: ${err.message}`);
    }
  };
}

async function saveEmailRecord(emailId, to, from, type, subject, body) {
  try {
    await admin.firestore().collection('emails').doc(emailId).set({
      id: emailId,
      emailId,
      to,
      from,
      type,
      subject,
      body,
      sentAt: new Date().toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error(`Error saving ${type} email record to Firestore: ${e.message}`);
  }
}

async function sendEmailHelper({ type, to, subject, html, logMeta = {}, returnPayload = false }) {
  const from = getFromEmail();
  const apiKey = getApiKey();
  const writeLog = await getLogWriter();
  const emailId = `email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const payload = { emailId, subject, body: html, from, to };

  await writeLog('info', `Attempting to send ${type} email via emailService`, { to, subject, body: html, from, ...logMeta });
  await saveEmailRecord(emailId, to, from, type, subject, html);

  const useResendDirect = process.env.USE_RESEND_DIRECT === 'true' || process.env.RESEND_DIRECT === 'true';
  if (useEmulators && !useResendDirect) {
    try {
      await sendMailDevSmtp({ from, to, subject, html });
      await writeLog('info', `${type} email sent successfully via MailDev`, { to, subject, emailId });
    } catch (err) {
      await writeLog('error', `Error sending ${type} email via MailDev`, { error: err.message });
      throw new Error(`MailDev SMTP service is not reachable (127.0.0.1:1025): ${err.message}`);
    }
    return returnPayload ? payload : emailId;
  }

  if (!apiKey) {
    await writeLog('warn', 'RESEND_API_KEY is not set. Email sending failed.', { to });
    throw new Error('RESEND_API_KEY environment variable is required for email dispatch.');
  }

  const fetchFn = globalThis.fetch;
  if (typeof fetchFn !== 'function') {
    throw new Error('fetch is not available in the current runtime environment');
  }
  const response = await fetchFn('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to: [to], subject, html })
  });
  const responseText = await response.text();
  let responseData;
  try { responseData = JSON.parse(responseText); } catch (e) { responseData = responseText; }

  if (!response.ok) {
    await writeLog('error', `Failed to send ${type} email via Resend API`, { status: response.status, error: responseData });
    const errMessage = typeof responseData === 'object' && responseData.message ? responseData.message : responseText;
    throw new Error(`Resend email service request failed with status ${response.status}: ${errMessage}`);
  }
  await writeLog('info', `${type} email sent successfully via Resend`, { to, resendId: responseData.id });
  return returnPayload ? payload : emailId;
}

module.exports = {
  getApiKey,
  getFromEmail,
  getLogWriter,
  saveEmailRecord,
  sendEmailHelper
};
