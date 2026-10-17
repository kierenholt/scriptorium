import { GoogleGenAI } from '@google/genai';
import { serverConfig } from './config';
import { allToolDeclarations } from './tools/declarations';
import { dispatchToolCall, ToolExecutionResult } from './tools/executors';
import { getProject, getRecentMessages, persistMessage, db } from './firestore';
import { ToolCallExecution, FileAttachment } from './types';
import { logToFirestore } from './logger';
import { downloadBufferFromGcs } from './storage';
import { generateEntityId, assertValidEntityId } from './entityId';

export interface StreamCallbacks {
  onToolCallStart: (toolCall: { id: string; name: string; args: Record<string, unknown> }) => void;
  onToolCallResult: (result: { id: string; name: string; success: boolean; result?: unknown; error?: string }) => void;
  onTextChunk: (text: string) => void;
  onError: (err: Error) => void;
}

const SYSTEM_INSTRUCTION = `You are Scriptorium's Project Supervisor Agent.
Scriptorium provides a managed talent-as-a-service platform for creative, localisation, and marketing teams, curating vetted talent pools across copywriters, transcreation specialists, AI post-editors, translators, and project managers.
Your responsibility is to assist the supervisor in viewing, managing, and mutating the current Firestore project document, and managing candidate talent.

Firestore Record ID Conventions (Strict Taxonomy: [a-z]{2}-[a-z0-9]{6}):
All system entity identifiers strictly follow the 2-letter prefix + 6-alphanumeric character convention:
- "pr-XXXXXX": Scriptorium Project documents (e.g. pr-7k4x9q)
- "ms-XXXXXX": Chat messages in projects/{projectId}/messages (e.g. ms-a8f3k2)
- "em-XXXXXX": Email records in emails/{emailId} (e.g. em-v9d2m5)
- "ar-XXXXXX": Deliverable and dossier artifacts in project.artifacts (e.g. ar-4k8x2q)
- "tl-XXXXXX": Talent candidate CV profiles in datastore (e.g. tl-3n7w1z)

Operational Guidelines:
1. When the supervisor asks to find, source, or shortlist candidates, freelancers, or specialists:
   - Immediately invoke "searchTalentPool" with descriptive query terms and optional structured filters (minYearsExperience, vettedOnly).
   - Present candidate results clearly with their key competencies, experience, and relevance.
2. When the supervisor asks to register, upload, index, or add a candidate/freelancer profile or CV:
   - Immediately invoke "indexTalentCv" with the candidate's name, role, skills, and optional location, yearsExperience, summary.
3. When the user asks to inspect or query project details or list available projects:
   - Invoke "lookupProjectRecord" to fetch a project document by ID (e.g. "pr-7k4x9q").
   - Invoke "listRecentProjects" to see recently active or created projects.
4. When the user asks to modify the project specification:
   - Invoke "updateProjectLifecycleStage", "renameProjectDocument", "updateProjectBriefDescription", "addProjectRequirementTag", or "removeProjectRequirementTag".
5. When tool execution results are returned:
   - Explain clearly what was done and conclude with a concise message confirming the new state.
6. If an action is invalid or fails:
   - Explain the exact error directly.
7. When inspecting attached files or documents:
   - Carefully read the attached file content.
   - If asked to extract specific data (e.g. an ID, code, or specific field), follow the user's formatting instructions precisely.
8. When the supervisor asks to inspect, check, or read email communications, received emails, or verification tokens:
   - Invoke "readCandidateEmailMessage" with the appropriate search query, recipient, sender, or email ID.
   - Extract and report the requested details accurately (e.g. verification code, token, subject, or message body).
9. When the supervisor asks to send or dispatch an email (e.g. to a candidate, client, or specific address):
   - Invoke "sendCandidateEmailMessage" with the target recipient "to", "subject", and message "body".
   - Confirm clearly that the email was successfully dispatched.
10. When the supervisor asks to save, promote, or attach an uploaded file or deliverable to project artifacts:
    - Invoke "saveProjectArtifact" with the attached file's GCS URI ("sourceFileUri"), the artifactName, and optional comment or mimeType.
11. When the supervisor asks to retrieve a project artifact document or get its secure download URL:
    - Invoke "getProjectArtifactDownloadUrl" with the query, artifactId, or comment phrase.
    - Invoke "lookupProjectArtifact" to inspect artifact details without generating a download URL.
    - Present the returned timeboxed download URL and markdown link clearly in your response.`;

const EMAIL_SYSTEM_INSTRUCTION = `You are Scriptorium's Email & Communications Supervisor Agent.
Scriptorium provides a managed talent-as-a-service platform for creative, localisation, and marketing teams, curating vetted talent pools across copywriters, transcreation specialists, AI post-editors, translators, and project managers.
Your responsibility is to assist the supervisor in viewing and triaging incoming and unassigned candidate emails, matching incoming talent or inquiries to suitable projects, assigning emails to projects, drafting communications, and querying talent or project databases.

Firestore Record ID Conventions (Strict Taxonomy: [a-z]{2}-[a-z0-9]{6}):
All system entity identifiers strictly follow the 2-letter prefix + 6-alphanumeric character convention:
- "pr-XXXXXX": Scriptorium Project documents (e.g. pr-7k4x9q)
- "ms-XXXXXX": Chat messages in system_chats/emails/messages (e.g. ms-a8f3k2)
- "em-XXXXXX": Email records in emails/{emailId} (e.g. em-v9d2m5)
- "ar-XXXXXX": Deliverable and dossier artifacts in project.artifacts (e.g. ar-4k8x2q)
- "tl-XXXXXX": Talent candidate CV profiles in datastore (e.g. tl-3n7w1z)

Operational Guidelines for Email Supervisor:
1. When asked to triage, inspect, or summarize incoming emails:
   - If a specific email is currently selected in the viewer (see CURRENTLY SELECTED EMAIL IN VIEWER below), reference its content, sender, and subject directly.
   - You can invoke "listUnassignedInboxEmails" to view unassigned candidate or client emails waiting in the inbox.
   - You can invoke "readCandidateEmailMessage" to fetch details of any specific email by ID, sender, or subject query.
2. When asked to match a candidate email to projects or suggest projects:
   - Invoke "listRecentProjects" to see active projects and their requirements/tags.
   - Invoke "getProjectsFromEmailSender" to check if this candidate/sender has interacted with previous projects.
   - Invoke "lookupProjectRecord" to inspect candidate project briefs in detail.
3. When asked to assign an email to a project:
   - Invoke "assignEmailToProject" with the emailId and target projectId (e.g. "pr-xxxxxx"). Confirm the assignment once completed.
4. When asked to dispatch or send an email:
   - Invoke "sendCandidateEmailMessage" with target "to", "subject", "body", and optional target "projectId".
5. When asked to search or index talent:
   - Invoke "searchTalentPool" or "indexTalentCv".
6. When tool execution results are returned:
   - Explain clearly what was done and conclude with a concise message confirming the new state.`;

export async function runAgentConversation(
  projectId: string,
  userPrompt: string,
  callbacks: StreamCallbacks,
  fileAttachment?: FileAttachment,
  selectedEmailId?: string
): Promise<{ finalResponse: string; toolExecutions: ToolCallExecution[] }> {
  // Fail fast check
  if (!projectId || projectId.trim() === '') {
    throw new Error('[FAIL FAST] projectId cannot be empty in runAgentConversation.');
  }

  const isEmailContext = projectId.trim() === 'emails';

  if (!isEmailContext) {
    assertValidEntityId(projectId.trim(), 'pr');
  }

  if (!userPrompt || userPrompt.trim() === '') {
    throw new Error('[FAIL FAST] userPrompt cannot be empty in runAgentConversation.');
  }

  // Verify project exists if in project context
  let currentProject: any = null;
  if (!isEmailContext) {
    currentProject = await getProject(projectId);
    if (!currentProject) {
      throw new Error(`[FAIL FAST] Project with ID "${projectId}" does not exist in Firestore.`);
    }
  }

  // If in email context and selectedEmailId is provided, load its full details
  let selectedEmailData: any = null;
  if (isEmailContext && selectedEmailId && typeof selectedEmailId === 'string' && selectedEmailId.trim() !== '') {
    const trimmedId = selectedEmailId.trim();
    try {
      const emailSnap = await db.collection('emails').doc(trimmedId).get();
      if (emailSnap.exists) {
        selectedEmailData = emailSnap.data();
      } else {
        const querySnap = await db.collection('emails').where('emailId', '==', trimmedId).limit(1).get();
        if (!querySnap.empty) {
          selectedEmailData = querySnap.docs[0].data();
        } else {
          const resendSnap = await db.collection('emails').where('resendId', '==', trimmedId).limit(1).get();
          if (!resendSnap.empty) {
            selectedEmailData = resendSnap.docs[0].data();
          }
        }
      }
    } catch (e: any) {
      await logToFirestore('warn', `[agent] Failed to load selected email "${trimmedId}": ${e?.message}`, {}, 'agent');
    }
  }

  const ai = new GoogleGenAI({ apiKey: serverConfig.geminiApiKey });

  // Load recent message history
  const recentHistory = await getRecentMessages(projectId, 10);

  // Build GenAI contents history
  const contents: any[] = [];

  for (const msg of recentHistory) {
    if (msg.sender === 'user') {
      contents.push({ role: 'user', parts: [{ text: msg.content }] });
    } else if (msg.sender === 'agent') {
      contents.push({ role: 'model', parts: [{ text: msg.content }] });
    }
  }

  // Build user turn parts including optional file attachment
  const userParts: any[] = [];

  if (fileAttachment?.uri) {
    if (fileAttachment.uri.startsWith('gs://')) {
      await logToFirestore('info', `[agent] Downloading attached file from "${fileAttachment.uri}"`, { fileAttachment }, 'agent');
      const { buffer, mimeType: fetchedMime } = await downloadBufferFromGcs(fileAttachment.uri);
      const mimeType = fileAttachment.mimeType || fetchedMime;
      userParts.push({
        inlineData: {
          mimeType,
          data: buffer.toString('base64'),
        },
      });
      userParts.push({
        text: `[Attached File: "${fileAttachment.filename || 'uploaded_document'}" | GCS URI: "${fileAttachment.uri}"]`,
      });
    } else {
      throw new Error(`[FAIL FAST] Unsupported file attachment URI scheme: "${fileAttachment.uri}". Must be a "gs://" URI.`);
    }
  }

  userParts.push({ text: userPrompt });

  // Append latest user prompt
  contents.push({ role: 'user', parts: userParts });

  // Persist user prompt immediately
  const userMsgId = generateEntityId('ms');
  await persistMessage(projectId, {
    id: userMsgId,
    sender: 'user',
    content: userPrompt,
    fileAttachment,
    timestamp: new Date().toISOString(),
  });

  const toolExecutions: ToolCallExecution[] = [];
  let finalResponseText = '';
  let maxTurns = 5;

  let fullSystemInstruction = '';
  if (isEmailContext) {
    const selectedEmailContext = selectedEmailData
      ? `CURRENTLY SELECTED EMAIL IN VIEWER:\n${JSON.stringify(
          {
            id: selectedEmailData.id || selectedEmailId,
            resendId: selectedEmailData.resendId,
            from: selectedEmailData.from,
            to: selectedEmailData.to,
            subject: selectedEmailData.subject,
            direction: selectedEmailData.direction,
            projectId: selectedEmailData.projectId || null,
            receivedAt: selectedEmailData.sentAt || selectedEmailData.createdAt || selectedEmailData.timestamp,
            body: selectedEmailData.body || selectedEmailData.content || '',
          },
          null,
          2
        )}`
      : 'CURRENTLY SELECTED EMAIL IN VIEWER: None selected.';
    fullSystemInstruction = `${EMAIL_SYSTEM_INSTRUCTION}\n\n${selectedEmailContext}`;
  } else {
    fullSystemInstruction = `${SYSTEM_INSTRUCTION}\n\nCURRENT PROJECT STATE:\n${JSON.stringify(currentProject, null, 2)}`;
  }

  while (maxTurns > 0) {
    maxTurns--;

    const response = await ai.models.generateContent({
      model: serverConfig.modelName,
      contents,
      config: {
        systemInstruction: fullSystemInstruction,
        tools: [{ functionDeclarations: allToolDeclarations }],
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate || !candidate.content) {
      break;
    }

    const parts = candidate.content.parts || [];
    const functionCalls = parts.filter((p: any) => p.functionCall).map((p: any) => p.functionCall);

    if (functionCalls.length > 0) {
      // Model produced function calls
      // CRITICAL: Must preserve the entire candidate.content to keep thought_signature intact.
      // Gemini 3.x strictly requires thought_signature to be echoed back in conversation history.
      contents.push(candidate.content);

      const responseParts: any[] = [];

      for (const fc of functionCalls) {
        const callId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const executionRecord: ToolCallExecution = {
          id: callId,
          name: fc.name,
          args: fc.args || {},
          status: 'executing',
        };
        toolExecutions.push(executionRecord);

        // Notify client that tool execution started
        callbacks.onToolCallStart({
          id: callId,
          name: fc.name,
          args: fc.args || {},
        });

        await logToFirestore('info', `[agent] Invoking tool "${fc.name}"`, { callId, tool: fc.name, args: fc.args }, 'agent');

        // Execute against Firestore
        const result: ToolExecutionResult = await dispatchToolCall(
          projectId,
          fc.name,
          (fc.args || {}) as Record<string, unknown>
        );

        executionRecord.status = result.success ? 'success' : 'error';
        if (result.data !== undefined) {
          executionRecord.result = result.data;
        }
        if (result.error !== undefined) {
          executionRecord.error = result.error;
        }

        await logToFirestore(
          result.success ? 'info' : 'warn',
          `[agent] Completed tool "${fc.name}" -> ${result.success ? 'SUCCESS' : 'FAILED'}`,
          { callId, tool: fc.name, success: result.success, error: result.error, result: result.data },
          'agent'
        );

        // Notify client of tool result
        callbacks.onToolCallResult({
          id: callId,
          name: fc.name,
          success: result.success,
          result: result.data,
          error: result.error,
        });


        // Add to response parts for GenAI
        responseParts.push({
          functionResponse: {
            name: fc.name,
            response: result,
          },
        });
      }

      // Add function responses back to history
      contents.push({
        role: 'user',
        parts: responseParts,
      });

      // Continue loop for agent to consume function responses
      continue;
    }

    // Model produced text response
    for (const part of parts) {
      if (part.text) {
        finalResponseText += part.text;
        callbacks.onTextChunk(part.text);
      }
    }

    // Done with tool execution turns
    break;
  }

  // Persist agent response
  const agentMsgId = generateEntityId('ms');
  await persistMessage(projectId, {
    id: agentMsgId,
    sender: 'agent',
    content: finalResponseText,
    toolCalls: toolExecutions,
    timestamp: new Date().toISOString(),
  });

  return {
    finalResponse: finalResponseText,
    toolExecutions,
  };
}
