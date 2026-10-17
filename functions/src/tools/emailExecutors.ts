import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firestore';
import { generateEntityId, assertValidEntityId } from '../entityId';
import { ProjectEmail } from '../types';
import {
  ToolExecutionResult,
  ReadEmailArgs,
  SendEmailArgs,
  GetProjectsFromEmailSenderArgs,
  AssignEmailToProjectArgs,
  ListUnassignedInboxEmailsArgs,
  DeleteEmailArgs,
} from './types';

/**
 * Cache an inbound email retrieved from Resend Inbound Receiving API into Firestore 'emails' collection.
 * Ensures an em-xxxxxx ID is assigned and persists full content for repository tracking.
 */
async function cacheInboundEmailToFirestore(re: any): Promise<string> {
  const resendId = re.id;
  if (!resendId) return '';

  try {
    // 1. Check if record already exists by resendId
    const snap = await db.collection('emails').where('resendId', '==', resendId).limit(1).get();
    if (!snap.empty) {
      const existingDoc = snap.docs[0];
      const existingData = existingDoc.data();
      const newBody = re.text || re.html || '';
      if (newBody && !existingData.body) {
        await existingDoc.ref.set(
          {
            body: newBody,
            content: newBody,
          },
          { merge: true }
        );
      }
      return existingDoc.id;
    }

    // 2. Check if record already exists by document ID == resendId
    const directDoc = await db.collection('emails').doc(resendId).get();
    if (directDoc.exists) {
      return directDoc.id;
    }

    // 3. Create new record with strict em-xxxxxx ID convention
    const emailEntityId = generateEntityId('em');
    const toAddress = Array.isArray(re.to) ? re.to.join(', ') : (re.to || '');
    const bodyContent = re.html || re.text || '';

    await db.collection('emails').doc(emailEntityId).set({
      id: emailEntityId,
      emailId: emailEntityId,
      resendId,
      direction: 'inbound',
      to: toAddress,
      from: re.from || '',
      subject: re.subject || '(No Subject)',
      body: bodyContent,
      content: re.text || re.html || '',
      sentAt: re.created_at || new Date().toISOString(),
      createdAt: re.created_at || new Date().toISOString(),
    });

    return emailEntityId;
  } catch (err: any) {
    return '';
  }
}

/**
 * Execute readCandidateEmailMessage tool.
 * Reads or searches dispatched / received emails via Resend Inbound Receiving API, Outbound API, and Firestore emails collection.
 */
export async function executeReadCandidateEmailMessage(
  _projectId: string,
  args: ReadEmailArgs
): Promise<ToolExecutionResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const query = args.query ? args.query.trim().toLowerCase() : undefined;
  const recipient = args.recipient ? args.recipient.trim().toLowerCase() : undefined;
  const sender = args.sender ? args.sender.trim().toLowerCase() : undefined;
  const emailId = args.emailId ? args.emailId.trim() : undefined;

  // 1. If explicit emailId is provided, fetch directly
  if (emailId) {
    if (emailId.startsWith('em-')) {
      try {
        const doc = await db.collection('emails').doc(emailId).get();
        if (doc.exists) {
          const data = doc.data()!;
          return {
            success: true,
            message: `Retrieved email "${data.subject}" from repository records.`,
            data: {
              emailId: doc.id,
              resendId: data.resendId,
              subject: data.subject,
              to: data.to,
              from: data.from,
              content: data.body || data.content,
              createdAt: data.sentAt || data.createdAt,
            },
          };
        }
      } catch (e) {}
    }

    if (apiKey) {
      // Query Resend Inbound Receiving API first
      try {
        const receivingRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
          headers: { Authorization: `Bearer ${apiKey}`, 'User-Agent': 'scriptorium/1.0' },
        });
        if (receivingRes.ok) {
          const data: any = await receivingRes.json();
          const cachedId = await cacheInboundEmailToFirestore(data);
          return {
            success: true,
            message: `Retrieved received inbound email "${data.subject}" for ID ${emailId}.`,
            data: {
              emailId: cachedId || data.id,
              resendId: data.id,
              subject: data.subject,
              to: Array.isArray(data.to) ? data.to.join(', ') : (data.to || ''),
              from: data.from,
              content: data.text || data.html || '',
              createdAt: data.created_at,
            },
          };
        }
      } catch (err: any) {}

      // Query Resend Outbound API
      try {
        const res = await fetch(`https://api.resend.com/emails/${emailId}`, {
          headers: { Authorization: `Bearer ${apiKey}`, 'User-Agent': 'scriptorium/1.0' },
        });
        if (res.ok) {
          const data: any = await res.json();
          return {
            success: true,
            message: `Retrieved email "${data.subject}" for ID ${emailId}.`,
            data: {
              emailId: data.id,
              subject: data.subject,
              to: data.to,
              from: data.from,
              content: data.text || data.html,
              createdAt: data.created_at,
            },
          };
        }
      } catch (err: any) {}
    }

    // Check Firestore by emailId or resendId
    try {
      const qSnap = await db.collection('emails').where('emailId', '==', emailId).limit(1).get();
      if (!qSnap.empty) {
        const data = qSnap.docs[0].data();
        return {
          success: true,
          message: `Retrieved email "${data.subject}" from repository records.`,
          data: {
            emailId: qSnap.docs[0].id,
            resendId: data.resendId,
            subject: data.subject,
            to: data.to,
            from: data.from,
            content: data.body || data.content,
            createdAt: data.sentAt || data.createdAt,
          },
        };
      }
      const rSnap = await db.collection('emails').where('resendId', '==', emailId).limit(1).get();
      if (!rSnap.empty) {
        const data = rSnap.docs[0].data();
        return {
          success: true,
          message: `Retrieved email "${data.subject}" from repository records.`,
          data: {
            emailId: rSnap.docs[0].id,
            resendId: data.resendId,
            subject: data.subject,
            to: data.to,
            from: data.from,
            content: data.body || data.content,
            createdAt: data.sentAt || data.createdAt,
          },
        };
      }
    } catch (e) {}
  }

  // 2. Search Resend Inbound Receiving API
  if (apiKey) {
    try {
      const receivingRes = await fetch('https://api.resend.com/emails/receiving', {
        headers: { Authorization: `Bearer ${apiKey}`, 'User-Agent': 'scriptorium/1.0' },
      });
      if (receivingRes.ok) {
        const listData: any = await receivingRes.json();
        const emails: any[] = listData.data || (Array.isArray(listData) ? listData : []);

        // Direct header/metadata matching
        for (const e of emails) {
          const matchSender = !sender || (e.from && e.from.toLowerCase().includes(sender));
          const matchQuery =
            !query ||
            (e.subject && e.subject.toLowerCase().includes(query)) ||
            (e.from && e.from.toLowerCase().includes(query));
          const matchRecip =
            !recipient ||
            (Array.isArray(e.to)
              ? e.to.some((t: string) => t.toLowerCase().includes(recipient))
              : typeof e.to === 'string' && e.to.toLowerCase().includes(recipient));

          if (matchSender && matchRecip && matchQuery) {
            const detailRes = await fetch(`https://api.resend.com/emails/receiving/${e.id}`, {
              headers: { Authorization: `Bearer ${apiKey}`, 'User-Agent': 'scriptorium/1.0' },
            });
            const detail = detailRes.ok ? await detailRes.json() : e;
            const cachedId = await cacheInboundEmailToFirestore(detail);
            return {
              success: true,
              message: `Found received email matching search: "${detail.subject}".`,
              data: {
                emailId: cachedId || detail.id,
                resendId: detail.id,
                subject: detail.subject,
                to: Array.isArray(detail.to) ? detail.to.join(', ') : (detail.to || ''),
                from: detail.from,
                content: detail.text || detail.html || '',
                createdAt: detail.created_at,
              },
            };
          }
        }

        // Body content matching for recent inbound emails when query is specified
        if (query) {
          for (const e of emails.slice(0, 10)) {
            const matchSender = !sender || (e.from && e.from.toLowerCase().includes(sender));
            const matchRecip =
              !recipient ||
              (Array.isArray(e.to)
                ? e.to.some((t: string) => t.toLowerCase().includes(recipient))
                : typeof e.to === 'string' && e.to.toLowerCase().includes(recipient));
            if (matchSender && matchRecip) {
              const detailRes = await fetch(`https://api.resend.com/emails/receiving/${e.id}`, {
                headers: { Authorization: `Bearer ${apiKey}`, 'User-Agent': 'scriptorium/1.0' },
              });
              if (detailRes.ok) {
                const detail = await detailRes.json();
                const text = (detail.text || '').toLowerCase();
                const html = (detail.html || '').toLowerCase();
                if (text.includes(query) || html.includes(query)) {
                  const cachedId = await cacheInboundEmailToFirestore(detail);
                  return {
                    success: true,
                    message: `Found received email matching query in body: "${detail.subject}".`,
                    data: {
                      emailId: cachedId || detail.id,
                      resendId: detail.id,
                      subject: detail.subject,
                      to: Array.isArray(detail.to) ? detail.to.join(', ') : (detail.to || ''),
                      from: detail.from,
                      content: detail.text || detail.html || '',
                      createdAt: detail.created_at,
                    },
                  };
                }
              }
            }
          }
        }
      }
    } catch (err: any) {}

    // Search Resend Outbound API
    try {
      const res = await fetch('https://api.resend.com/emails', {
        headers: { Authorization: `Bearer ${apiKey}`, 'User-Agent': 'scriptorium/1.0' },
      });
      if (res.ok) {
        const listData: any = await res.json();
        const emails = listData.data || [];
        const matched = emails.find((e: any) => {
          const matchSender = !sender || (e.from && e.from.toLowerCase().includes(sender));
          const matchQuery =
            !query ||
            (e.subject && e.subject.toLowerCase().includes(query)) ||
            (e.from && e.from.toLowerCase().includes(query));
          const matchRecip =
            !recipient ||
            (Array.isArray(e.to)
              ? e.to.some((t: string) => t.toLowerCase().includes(recipient))
              : typeof e.to === 'string' && e.to.toLowerCase().includes(recipient));
          return matchQuery && matchRecip && matchSender;
        });

        if (matched) {
          const detailRes = await fetch(`https://api.resend.com/emails/${matched.id}`, {
            headers: { Authorization: `Bearer ${apiKey}`, 'User-Agent': 'scriptorium/1.0' },
          });
          const detail = detailRes.ok ? await detailRes.json() : matched;
          return {
            success: true,
            message: `Found email matching search: "${detail.subject}".`,
            data: {
              emailId: detail.id,
              subject: detail.subject,
              to: detail.to,
              from: detail.from,
              content: detail.text || detail.html,
              createdAt: detail.created_at,
            },
          };
        }
      }
    } catch (err: any) {}
  }

  // 3. Fallback: Search Firestore 'emails' collection
  try {
    const snap = await db.collection('emails').orderBy('createdAt', 'desc').limit(25).get();
    if (!snap.empty) {
      for (const doc of snap.docs) {
        const data = doc.data();
        const sub = (data.subject || '').toLowerCase();
        const from = (data.from || '').toLowerCase();
        const to = (typeof data.to === 'string' ? data.to : JSON.stringify(data.to || '')).toLowerCase();
        const matchSender = !sender || from.includes(sender);
        const matchQuery =
          !query || sub.includes(query) || (typeof data.body === 'string' && data.body.toLowerCase().includes(query)) || from.includes(query);
        const matchRecip = !recipient || to.includes(recipient);
        if (matchQuery && matchRecip && matchSender) {
          return {
            success: true,
            message: `Found email from repository records: "${data.subject}".`,
            data: {
              emailId: doc.id,
              subject: data.subject,
              to: data.to,
              from: data.from,
              content: data.body,
              createdAt: data.sentAt,
            },
          };
        }
      }
    }
  } catch (err: any) {}

  return {
    success: false,
    error: 'NOT_FOUND',
    message: `No email found matching criteria (query: "${query || '*'}", recipient: "${recipient || '*'}", sender: "${sender || '*'}").`,
  };
}

/**
 * Execute sendCandidateEmailMessage tool.
 * Sends an outbound email via Resend API and logs the record to Firestore emails collection.
 */
export async function executeSendCandidateEmailMessage(
  projectId: string,
  args: SendEmailArgs
): Promise<ToolExecutionResult> {
  const to = args.to?.trim();
  const subject = args.subject?.trim();
  const body = args.body?.trim();

  if (!to) {
    return {
      success: false,
      error: 'MISSING_RECIPIENT',
      message: 'Failed to send email: parameter "to" is required.',
    };
  }
  if (!subject) {
    return {
      success: false,
      error: 'MISSING_SUBJECT',
      message: 'Failed to send email: parameter "subject" is required.',
    };
  }
  if (!body) {
    return {
      success: false,
      error: 'MISSING_BODY',
      message: 'Failed to send email: parameter "body" is required.',
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'MISSING_RESEND_API_KEY',
      message: 'Failed to send email: RESEND_API_KEY environment variable is not configured.',
    };
  }
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@seamcode.co.uk';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html: body.includes('<') ? body : `<p>${body}</p>`,
        text: body.replace(/<[^>]*>/g, ''),
      }),
    });

    const resData: any = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: resData.message || `Resend API returned HTTP ${res.status}`,
        message: `Failed to dispatch email via Resend: ${resData.message || res.statusText}`,
      };
    }

    const emailId = generateEntityId('em');
    const resendId = resData.id;
    const sentAt = new Date().toISOString();

    // Save record to Firestore emails collection
    await db.collection('emails').doc(emailId).set({
      id: emailId,
      emailId,
      resendId,
      to,
      from: fromEmail,
      subject,
      body,
      type: 'agent-dispatch',
      direction: 'outbound',
      sentAt,
      projectId,
    });

    const projectEmail: ProjectEmail = {
      id: emailId,
      resendId,
      direction: 'outbound',
      from: fromEmail,
      to,
      subject,
      body,
      timestamp: sentAt,
      assignedAt: sentAt,
    };

    // Automatically associate and record outbound email directly into active project document
    if (projectId) {
      try {
        await db.collection('projects').doc(projectId).set(
          {
            emails: FieldValue.arrayUnion(projectEmail),
            updatedAt: sentAt,
          },
          { merge: true }
        );
      } catch (projErr: any) {
        console.warn(`[sendCandidateEmailMessage] Failed to append email to project ${projectId}:`, projErr?.message);
      }
    }

    return {
      success: true,
      message: `Email successfully dispatched to ${to} with subject "${subject}" (Record ID: ${emailId}).`,
      data: {
        emailId,
        resendId,
        to,
        from: fromEmail,
        subject,
        body,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error communicating with Resend email API.',
      message: `Failed to send email to ${to}: ${err?.message}`,
    };
  }
}

/**
 * Execute getProjectsFromEmailSender tool.
 * Identifies all projects associated with a given sender email address.
 */
export async function executeGetProjectsFromEmailSender(
  _projectId: string,
  args: GetProjectsFromEmailSenderArgs
): Promise<ToolExecutionResult> {
  const senderEmail = args.senderEmail?.trim().toLowerCase();

  if (!senderEmail) {
    return {
      success: false,
      error: 'MISSING_SENDER_EMAIL',
      message: '[FAIL FAST] Mandatory parameter "senderEmail" is missing from getProjectsFromEmailSender.',
    };
  }

  try {
    const matchedProjectIds = new Set<string>();

    // 1. Search in emails collection where to or from matches senderEmail
    const emailsSnap = await db.collection('emails').get();
    for (const doc of emailsSnap.docs) {
      const data = doc.data();
      const from = (data.from || '').toLowerCase();
      const to = Array.isArray(data.to)
        ? data.to.map((t: string) => String(t).toLowerCase())
        : [String(data.to || '').toLowerCase()];

      const matches = from.includes(senderEmail) || to.some((t: string) => t.includes(senderEmail));
      if (matches && data.projectId && typeof data.projectId === 'string') {
        matchedProjectIds.add(data.projectId);
      }
    }

    // 2. Search in projects collection where project.emails contains senderEmail
    const projectsSnap = await db.collection('projects').get();
    const candidateProjects: Array<{
      projectId: string;
      title: string;
      status: string;
      description?: string;
    }> = [];

    for (const doc of projectsSnap.docs) {
      const data = doc.data();
      let matches = matchedProjectIds.has(doc.id);

      if (!matches && Array.isArray(data.emails)) {
        matches = data.emails.some((em: any) => {
          const from = (em.from || '').toLowerCase();
          const to = Array.isArray(em.to)
            ? em.to.map((t: string) => String(t).toLowerCase())
            : [String(em.to || '').toLowerCase()];
          return from.includes(senderEmail) || to.some((t: string) => t.includes(senderEmail));
        });
      }

      if (matches) {
        candidateProjects.push({
          projectId: doc.id,
          title: data.title || doc.id,
          status: data.status || 'draft',
          description: data.description || '',
        });
      }
    }

    if (candidateProjects.length === 0) {
      return {
        success: true,
        message: `No existing projects found associated with sender email "${senderEmail}".`,
        data: {
          senderEmail,
          projects: [],
        },
      };
    }

    return {
      success: true,
      message: `Found ${candidateProjects.length} project(s) associated with sender email "${senderEmail}": ${candidateProjects.map((p) => `${p.title} (${p.projectId})`).join(', ')}.`,
      data: {
        senderEmail,
        count: candidateProjects.length,
        projects: candidateProjects,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'LOOKUP_FAILED',
      message: `Failed to search projects for sender "${senderEmail}": ${err?.message}`,
    };
  }
}

/**
 * Execute assignEmailToProject tool.
 * Moves/associates an inbound or unassigned email message into a project document.
 */
export async function executeAssignEmailToProject(
  projectId: string,
  args: AssignEmailToProjectArgs
): Promise<ToolExecutionResult> {
  const emailId = args.emailId?.trim();
  const targetProjectId = (args.projectId || projectId)?.trim();

  if (!emailId) {
    return {
      success: false,
      error: 'MISSING_EMAIL_ID',
      message: '[FAIL FAST] Mandatory parameter "emailId" is missing from assignEmailToProject.',
    };
  }

  if (!targetProjectId) {
    return {
      success: false,
      error: 'MISSING_PROJECT_ID',
      message: '[FAIL FAST] Mandatory parameter "projectId" is missing from assignEmailToProject.',
    };
  }

  try {
    assertValidEntityId(targetProjectId, 'pr');
  } catch (err: any) {
    return {
      success: false,
      error: 'INVALID_PROJECT_ID',
      message: err.message,
    };
  }

  try {
    // 1. Locate email in Firestore emails collection
    let emailDoc = await db.collection('emails').doc(emailId).get();
    let resendDetail: any = null;

    if (!emailDoc.exists) {
      const querySnap = await db.collection('emails').where('emailId', '==', emailId).limit(1).get();
      if (!querySnap.empty) {
        emailDoc = querySnap.docs[0];
      } else {
        const resendSnap = await db.collection('emails').where('resendId', '==', emailId).limit(1).get();
        if (!resendSnap.empty) {
          emailDoc = resendSnap.docs[0];
        }
      }
    }

    // If not found in Firestore, query Resend Inbound Receiving API first, then Outbound API
    if (!emailDoc.exists) {
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey) {
        try {
          const receivingRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
            headers: { Authorization: `Bearer ${apiKey}`, 'User-Agent': 'scriptorium/1.0' },
          });
          if (receivingRes.ok) {
            resendDetail = await receivingRes.json();
            resendDetail.direction = 'inbound';
          }
        } catch (err: any) {}

        if (!resendDetail) {
          try {
            const res = await fetch(`https://api.resend.com/emails/${emailId}`, {
              headers: { Authorization: `Bearer ${apiKey}`, 'User-Agent': 'scriptorium/1.0' },
            });
            if (res.ok) {
              resendDetail = await res.json();
            }
          } catch (err: any) {}
        }
      }
    }

    if (!emailDoc.exists && !resendDetail) {
      return {
        success: false,
        error: 'EMAIL_NOT_FOUND',
        message: `No email record found matching ID "${emailId}" in repository or Resend API.`,
      };
    }

    // 2. Verify project exists
    const projectRef = db.collection('projects').doc(targetProjectId);
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) {
      return {
        success: false,
        error: 'PROJECT_NOT_FOUND',
        message: `Project "${targetProjectId}" does not exist in repository.`,
      };
    }

    const emailData = emailDoc.exists ? emailDoc.data()! : {};
    const assignedAt = new Date().toISOString();
    const resolvedEmailId = emailDoc.exists && emailDoc.id.startsWith('em-')
      ? emailDoc.id
      : (emailData.emailId?.startsWith('em-') ? emailData.emailId : generateEntityId('em'));

    const fromAddress = emailDoc.exists ? emailData.from : resendDetail.from;
    const toAddress = emailDoc.exists ? emailData.to : resendDetail.to;
    const subject = emailDoc.exists ? emailData.subject : resendDetail.subject;
    const body = emailDoc.exists
      ? (emailData.body || emailData.content || '')
      : (resendDetail.text || resendDetail.html || '');
    const timestamp = emailDoc.exists
      ? (emailData.sentAt || emailData.createdAt || assignedAt)
      : (resendDetail.created_at || assignedAt);
    const resendId = emailDoc.exists
      ? (emailData.resendId || (!emailDoc.id.startsWith('em-') ? emailDoc.id : undefined))
      : (resendDetail.id || emailId);

    const projectEmail: ProjectEmail = {
      id: resolvedEmailId,
      resendId,
      direction: emailDoc.exists ? (emailData.direction || 'inbound') : (resendDetail.direction || 'inbound'),
      from: fromAddress || 'unknown@sender.com',
      to: toAddress || targetProjectId,
      subject: subject || '(No Subject)',
      body,
      timestamp,
      assignedAt,
    };

    // 3. Persist/update email document in emails collection
    await db.collection('emails').doc(resolvedEmailId).set(
      {
        id: resolvedEmailId,
        emailId: resolvedEmailId,
        resendId,
        projectId: targetProjectId,
        assignedAt,
        from: projectEmail.from,
        to: projectEmail.to,
        subject: projectEmail.subject,
        body: projectEmail.body,
        direction: projectEmail.direction,
        sentAt: projectEmail.timestamp,
      },
      { merge: true }
    );

    // 4. Update target project document with projectEmail in emails array
    await projectRef.set(
      {
        emails: FieldValue.arrayUnion(projectEmail),
        updatedAt: assignedAt,
      },
      { merge: true }
    );

    const projectTitle = projectDoc.data()?.title || targetProjectId;

    return {
      success: true,
      message: `Email "${projectEmail.subject}" (${resolvedEmailId}) successfully associated and stored in project "${projectTitle}" (${targetProjectId}).`,
      data: {
        emailId: resolvedEmailId,
        projectId: targetProjectId,
        subject: projectEmail.subject,
        direction: projectEmail.direction,
        assignedAt,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'ASSIGN_EMAIL_FAILED',
      message: `Failed to assign email "${emailId}" to project "${targetProjectId}": ${err?.message}`,
    };
  }
}

/**
 * Execute listUnassignedInboxEmails tool.
 * Lists unassigned incoming candidate or client emails waiting in the inbox.
 */
export async function executeListUnassignedInboxEmails(
  _projectId: string,
  args: ListUnassignedInboxEmailsArgs
): Promise<ToolExecutionResult> {
  const limit = Math.min(Math.max(args.limit || 10, 1), 50);

  try {
    const assignedIds = new Set<string>();
    const snap = await db.collection('emails').get();
    const unassigned: any[] = [];

    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.projectId) {
        assignedIds.add(doc.id);
        if (data.resendId) assignedIds.add(data.resendId);
        if (data.emailId) assignedIds.add(data.emailId);
      } else {
        unassigned.push({
          emailId: doc.id,
          resendId: data.resendId,
          subject: data.subject || '(No Subject)',
          from: data.from || '',
          to: data.to || '',
          direction: data.direction || 'inbound',
          body: (data.body || data.content || '').substring(0, 200),
          receivedAt: data.sentAt || data.createdAt || '',
        });
      }
    }

    // Also collect all assigned email IDs from projects
    const projectsSnap = await db.collection('projects').get();
    for (const pDoc of projectsSnap.docs) {
      const pData = pDoc.data();
      if (Array.isArray(pData.emails)) {
        for (const pe of pData.emails) {
          if (pe.id) assignedIds.add(pe.id);
          if (pe.resendId) assignedIds.add(pe.resendId);
        }
      }
    }

    // Query Resend Inbound Receiving API directly for incoming/unassigned emails sitting in the inbox
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch('https://api.resend.com/emails/receiving', {
          headers: { Authorization: `Bearer ${apiKey}`, 'User-Agent': 'scriptorium/1.0' },
        });
        if (res.ok) {
          const listData: any = await res.json();
          const receivedEmails = listData.data || (Array.isArray(listData) ? listData : []);
          for (const re of receivedEmails) {
            if (!assignedIds.has(re.id) && !unassigned.some((u) => u.emailId === re.id || u.resendId === re.id)) {
              let bodySnippet = '';
              try {
                const detailRes = await fetch(`https://api.resend.com/emails/receiving/${re.id}`, {
                  headers: { Authorization: `Bearer ${apiKey}`, 'User-Agent': 'scriptorium/1.0' },
                });
                if (detailRes.ok) {
                  const detail = await detailRes.json();
                  bodySnippet = (detail.text || detail.html || '').substring(0, 200);
                  const cachedId = await cacheInboundEmailToFirestore(detail);
                  unassigned.push({
                    emailId: cachedId || re.id,
                    resendId: re.id,
                    subject: re.subject || '(No Subject)',
                    from: re.from || '',
                    to: Array.isArray(re.to) ? re.to.join(', ') : (re.to || ''),
                    direction: 'inbound',
                    body: bodySnippet,
                    receivedAt: re.created_at || '',
                  });
                  continue;
                }
              } catch (e) {}

              // If detail fetch failed, push summary & cache basic
              const cachedId = await cacheInboundEmailToFirestore(re);
              unassigned.push({
                emailId: cachedId || re.id,
                resendId: re.id,
                subject: re.subject || '(No Subject)',
                from: re.from || '',
                to: Array.isArray(re.to) ? re.to.join(', ') : (re.to || ''),
                direction: 'inbound',
                body: bodySnippet,
                receivedAt: re.created_at || '',
              });
            }
          }
        }
      } catch (err: any) {}
    }

    const sliced = unassigned.slice(0, limit);

    return {
      success: true,
      message: `Retrieved ${sliced.length} unassigned inbox email(s).`,
      data: {
        count: sliced.length,
        emails: sliced,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'LIST_INBOX_FAILED',
      message: `Failed to list unassigned inbox emails: ${err?.message}`,
    };
  }
}

/**
 * Execute deleteCandidateEmailMessage tool.
 * Permanently deletes an email record from Firestore 'emails' collection,
 * removes it from any associated project document's emails array,
 * and attempts deletion via Resend API if applicable.
 */
export async function executeDeleteCandidateEmailMessage(
  projectId: string,
  args: DeleteEmailArgs
): Promise<ToolExecutionResult> {
  const emailId = args.emailId?.trim();

  if (!emailId) {
    return {
      success: false,
      error: 'MISSING_EMAIL_ID',
      message: '[FAIL FAST] Mandatory parameter "emailId" is missing from deleteCandidateEmailMessage.',
    };
  }

  try {
    // 1. Locate email in Firestore emails collection
    let emailDoc = await db.collection('emails').doc(emailId).get();

    if (!emailDoc.exists) {
      const querySnap = await db.collection('emails').where('emailId', '==', emailId).limit(1).get();
      if (!querySnap.empty) {
        emailDoc = querySnap.docs[0];
      } else {
        const resendSnap = await db.collection('emails').where('resendId', '==', emailId).limit(1).get();
        if (!resendSnap.empty) {
          emailDoc = resendSnap.docs[0];
        }
      }
    }

    let targetProjectId = (emailDoc.exists ? emailDoc.data()?.projectId : null) || (projectId ? projectId.trim() : null);
    let resendId = emailDoc.exists
      ? (emailDoc.data()?.resendId || (!emailDoc.id.startsWith('em-') ? emailDoc.id : undefined))
      : (!emailId.startsWith('em-') ? emailId : undefined);
    const emailSubject = emailDoc.exists ? emailDoc.data()?.subject : undefined;

    // 2. If associated with a project, remove from project document's emails array
    if (targetProjectId) {
      try {
        const projectRef = db.collection('projects').doc(targetProjectId);
        const projectDoc = await projectRef.get();
        if (projectDoc.exists) {
          const projectData = projectDoc.data();
          const existingEmails: any[] = Array.isArray(projectData?.emails) ? projectData.emails : [];
          const updatedEmails = existingEmails.filter(
            (e) => e.id !== emailId && e.id !== emailDoc.id && (!resendId || e.resendId !== resendId)
          );
          if (updatedEmails.length !== existingEmails.length) {
            await projectRef.set(
              {
                emails: updatedEmails,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
          }
        }
      } catch (projErr: any) {
        console.warn(`[executeDeleteEmail] Failed to clean up project email array:`, projErr?.message);
      }
    }

    // 3. If email has a resendId or is a Resend ID, attempt deletion via Resend API
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey && resendId) {
      try {
        const recRes = await fetch(`https://api.resend.com/emails/receiving/${resendId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${apiKey}`, 'User-Agent': 'scriptorium/1.0' },
        });
        if (!recRes.ok) {
          await fetch(`https://api.resend.com/emails/${resendId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${apiKey}`, 'User-Agent': 'scriptorium/1.0' },
          });
        }
      } catch (resendErr: any) {
        console.warn(`[executeDeleteEmail] Resend API deletion attempt failed:`, resendErr?.message);
      }
    }

    // 4. Delete the email document from Firestore emails collection
    if (emailDoc.exists) {
      await emailDoc.ref.delete();
    } else {
      await db.collection('emails').doc(emailId).delete();
    }

    return {
      success: true,
      message: `Email "${emailSubject || emailId}" (${emailDoc.exists ? emailDoc.id : emailId}) was permanently deleted from the repository.`,
      data: {
        emailId: emailDoc.exists ? emailDoc.id : emailId,
        subject: emailSubject,
        projectId: targetProjectId,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'DELETE_EMAIL_FAILED',
      message: `Failed to delete email "${emailId}": ${err?.message}`,
    };
  }
}

// Domain-named function aliases
export const executeReadEmail = executeReadCandidateEmailMessage;
export const checkReceivedEmail = executeReadCandidateEmailMessage;
export const executeSendEmail = executeSendCandidateEmailMessage;
export const executeDispatchEmail = executeSendCandidateEmailMessage;
export const getProjectsFromEmailSender = executeGetProjectsFromEmailSender;
export const getProjectsFromSender = executeGetProjectsFromEmailSender;
export const assignEmailToProject = executeAssignEmailToProject;
export const moveEmailToProject = executeAssignEmailToProject;
export const associateEmailWithProject = executeAssignEmailToProject;
export const listUnassignedInboxEmails = executeListUnassignedInboxEmails;
export const listInboxEmails = executeListUnassignedInboxEmails;
export const executeDeleteEmail = executeDeleteCandidateEmailMessage;
export const deleteCandidateEmailMessage = executeDeleteCandidateEmailMessage;
export const deleteEmail = executeDeleteCandidateEmailMessage;
