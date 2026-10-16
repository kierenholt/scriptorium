# Email Service (`gcloud/email`)

The Email Service dispatches transactional outbound email communications across the platform. It integrates with the Resend API in production and routes emails to MailDev in local development environments. Every dispatched email is logged into the `emails` Firestore collection.

## Configuration & Local Port

- **Local Port**: `8085` (configured via `VITE_EMAIL_SERVICE_PORT` / `VITE_EMAIL_SERVICE_URL`)
- **Sender Address**: Configured via `RESEND_FROM_EMAIL` (`info@scriptorium.co.uk`)
- **Local MailDev**: Listens on `http://127.0.0.1:1080` (SMTP `1025`)
- **GCP Region**: `europe-west2`

## Key Files & Modules

- [index.js](file:///home/kieren/Documents/code/scriptorium/gcloud/email/index.js): Microservice entry point & email template dispatchers.
- [config.js](file:///home/kieren/Documents/code/scriptorium/gcloud/email/config.js): Shared environment configuration, Fail-Fast dotenv loader, Firestore telemetry logger, and monitored Cloud Function / HTTP request wrapper.

## Supported Email Templates & Functions

| Action Type | Recipient | Trigger / Purpose |
| :--- | :---: | :--- |
| `sendThankYouEmail` | Candidate | Application submission thank you summary email |
| `sendAcceptanceEmail` | Candidate | Curator profile vetting approval email |
| `sendRenewalEmail` | Candidate | Data retention consent 2-year renewal notice email |
| `sendTalentCredentialsEmail` | Candidate | Account credentials setup confirmation email |
| `sendHirerWelcomeEmail` | Hirer | Employer paid subscription welcome email with generated password |
| `sendOfferReplyNotificationEmail` | Candidate | Employer message notification regarding offer/project thread |
| `sendHirerReplyNotificationEmail` | Hirer | Candidate reply notification regarding offer/project thread |
