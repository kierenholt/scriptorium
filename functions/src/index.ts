import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';
import path from 'path';
import { runAgentConversation } from './agent';
import { seedDefaultProject, getProject } from './firestore';
import { searchVertexAI } from './vertexSearch';
import { uploadBufferToGcs, downloadBufferFromGcs } from './storage';
import { verifyArtifactDownloadToken } from './artifactTokens';
import { setupFirestoreLogging, logToFirestore } from './logger';
import { serverConfig } from './config';
import { assertValidEntityId } from './entityId';
import {
  executeAssignEmailToProject,
  executeListUnassignedInboxEmails,
  executeDeleteCandidateEmailMessage,
} from './tools/emailExecutors';

export { setupFirestoreLogging, logToFirestore } from './logger';

// Automatically mirror all console.log/info/warn/error to Firestore function_logs collection
setupFirestoreLogging('backend');

const corsHandler = cors({ origin: true });


/**
 * SSE Chat Endpoint.
 * Streams tool call start, execution results, and agent text tokens.
 */
export const chat = onRequest(
  {
    region: 'europe-west2',
    timeoutSeconds: 120,
    cors: true,
  },
  async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    corsHandler(req, res, async () => {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      if (req.method !== 'POST') {
        res.status(405).json({
          error: 'METHOD_NOT_ALLOWED',
          message: 'Only POST requests are supported on /chat.',
        });
        return;
      }

      const { projectId, message, fileUri, fileMimeType } = req.body || {};

      // Fail-fast validation
      if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
        res.status(400).json({
          error: 'MISSING_PROJECT_ID',
          message: '[FAIL FAST] Mandatory field "projectId" is missing from request body.',
        });
        return;
      }

      try {
        assertValidEntityId(projectId.trim(), 'pr');
      } catch (err: any) {
        res.status(400).json({
          error: 'INVALID_PROJECT_ID',
          message: err.message,
        });
        return;
      }

      if (!message || typeof message !== 'string' || message.trim() === '') {
        res.status(400).json({
          error: 'MISSING_MESSAGE',
          message: '[FAIL FAST] Mandatory field "message" is missing from request body.',
        });
        return;
      }

      const fileAttachment = fileUri && typeof fileUri === 'string' && fileUri.trim() !== ''
        ? { uri: fileUri.trim(), mimeType: typeof fileMimeType === 'string' ? fileMimeType.trim() : undefined }
        : undefined;

      // Configure SSE Headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      await logToFirestore(
        'info',
        `[chat] Incoming request for project "${projectId}"`,
        { projectId, message, fileAttachment },
        'chat'
      );

      const sendEvent = (event: string, data: Record<string, unknown>) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        sendEvent('connection_open', { status: 'connected', projectId });

        await runAgentConversation(
          projectId.trim(),
          message.trim(),
          {
            onToolCallStart: (toolCall) => {
              sendEvent('tool_call_start', toolCall);
            },
            onToolCallResult: (result) => {
              sendEvent('tool_call_result', result);
            },
            onTextChunk: (text) => {
              sendEvent('agent_text', { token: text });
            },
            onError: (err) => {
              sendEvent('error', { message: err.message });
            },
          },
          fileAttachment
        );

        await logToFirestore('info', `[chat] Agent conversation completed for project "${projectId}"`, { projectId }, 'chat');
        sendEvent('done', { status: 'complete' });
        res.end();
      } catch (err: any) {
        await logToFirestore('error', `[chat] Error during agent execution: ${err?.message}`, { error: err?.message }, 'chat');
        sendEvent('error', {
          error: 'EXECUTION_FAILED',
          message: err?.message || 'Unknown error occurred during agent execution.',
        });
        res.end();
      }
    });
  }
);

/**
 * Project Seed Endpoint.
 * Creates or resets the default project document in Firestore.
 */
export const seed = onRequest(
  {
    region: 'europe-west2',
    timeoutSeconds: 30,
    cors: true,
  },
  async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    corsHandler(req, res, async () => {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      const projectId = (req.query.projectId as string) || req.body?.projectId || serverConfig.defaultProjectId;

      try {
        assertValidEntityId(projectId, 'pr');
      } catch (err: any) {
        res.status(400).json({
          error: 'INVALID_PROJECT_ID',
          message: err.message,
        });
        return;
      }

      try {
        await logToFirestore('info', `[seed] Seeding project "${projectId}"`, { projectId }, 'seed');
        const project = await seedDefaultProject(projectId);
        res.status(200).json({
          success: true,
          message: `Project "${projectId}" successfully seeded.`,
          project,
        });
      } catch (err: any) {
        await logToFirestore('error', `[seed] Failed to seed project "${projectId}": ${err?.message}`, { error: err?.message }, 'seed');
        res.status(500).json({
          error: 'SEED_FAILED',
          message: err?.message || 'Failed to seed default project.',
        });
      }
    });
  }
);


/**
 * Vertex AI Search Endpoint.
 * Executes semantic candidate / talent searches against Discovery Engine.
 */
export const searchTalent = onRequest(
  {
    region: 'europe-west2',
    timeoutSeconds: 60,
    cors: true,
  },
  async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    corsHandler(req, res, async () => {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      if (req.method !== 'POST') {
        res.status(405).json({
          error: 'METHOD_NOT_ALLOWED',
          message: 'Only POST requests are supported on /searchTalent.',
        });
        return;
      }

      const { query, filter, pageSize } = req.body || {};

      // Fail-fast validation
      if (!query || typeof query !== 'string' || query.trim() === '') {
        res.status(400).json({
          error: 'MISSING_QUERY',
          message: '[FAIL FAST] Mandatory field "query" is missing from request body.',
        });
        return;
      }

      try {
        await logToFirestore('info', `[searchTalent] Executing candidate search query: "${query.trim()}"`, { query, filter, pageSize }, 'searchTalent');
        const searchResult = await searchVertexAI({
          query: query.trim(),
          filter: filter && typeof filter === 'string' ? filter.trim() : undefined,
          pageSize: typeof pageSize === 'number' ? pageSize : undefined,
        });

        await logToFirestore('info', `[searchTalent] Search completed with ${searchResult.results?.length ?? 0} results`, { count: searchResult.results?.length ?? 0 }, 'searchTalent');
        res.status(200).json(searchResult);
      } catch (err: any) {
        await logToFirestore('error', `[searchTalent] Error executing search: ${err?.message}`, { error: err?.message }, 'searchTalent');
        res.status(500).json({
          error: 'VERTEX_SEARCH_FAILED',
          message: err?.message || 'Error executing Vertex AI Search.',
        });
      }

    });
  }
);

/**
 * Document / File Upload Endpoint.
 * Accepts a base64 encoded file payload and stores it in Cloud Storage under uploads/.
 */
export const upload = onRequest(
  {
    region: 'europe-west2',
    timeoutSeconds: 60,
    cors: true,
  },
  async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    corsHandler(req, res, async () => {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      if (req.method !== 'POST') {
        res.status(405).json({
          error: 'METHOD_NOT_ALLOWED',
          message: 'Only POST requests are supported on /upload.',
        });
        return;
      }

      const { filename, mimeType, content } = req.body || {};

      // Fail-fast validation
      if (!filename || typeof filename !== 'string' || filename.trim() === '') {
        res.status(400).json({
          error: 'MISSING_FILENAME',
          message: '[FAIL FAST] Mandatory field "filename" is missing from request body.',
        });
        return;
      }

      if (!mimeType || typeof mimeType !== 'string' || mimeType.trim() === '') {
        res.status(400).json({
          error: 'MISSING_MIME_TYPE',
          message: '[FAIL FAST] Mandatory field "mimeType" is missing from request body.',
        });
        return;
      }

      if (!content || typeof content !== 'string' || content.trim() === '') {
        res.status(400).json({
          error: 'MISSING_CONTENT',
          message: '[FAIL FAST] Mandatory field "content" (base64) is missing from request body.',
        });
        return;
      }

      try {
        const buffer = Buffer.from(content, 'base64');
        if (buffer.length === 0) {
          res.status(400).json({
            error: 'EMPTY_CONTENT',
            message: '[FAIL FAST] Decoded file content buffer is empty.',
          });
          return;
        }

        await logToFirestore(
          'info',
          `[upload] Uploading file "${filename.trim()}" (${mimeType.trim()}, ${buffer.length} bytes)`,
          { filename: filename.trim(), mimeType: mimeType.trim(), size: buffer.length },
          'upload'
        );

        const { uri, size } = await uploadBufferToGcs(filename.trim(), mimeType.trim(), buffer);

        await logToFirestore(
          'info',
          `[upload] Successfully uploaded to "${uri}"`,
          { uri, size },
          'upload'
        );

        res.status(200).json({
          success: true,
          uri,
          filename: filename.trim(),
          mimeType: mimeType.trim(),
          size,
        });
      } catch (err: any) {
        await logToFirestore('error', `[upload] Upload failed: ${err?.message}`, { error: err?.message }, 'upload');
        res.status(500).json({
          error: 'UPLOAD_FAILED',
          message: err?.message || 'Failed to upload file to Cloud Storage.',
        });
      }
    });
  }
);

/**
 * Email Service Endpoint.
 * Dispatches outbound transactional emails and records telemetry.
 */
export const emailService = onRequest(
  {
    region: 'europe-west2',
    timeoutSeconds: 60,
    cors: true,
  },
  async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    corsHandler(req, res, async () => {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      try {
        await logToFirestore('info', `[emailService] Incoming request`, { action: req.body?.action || req.query?.action }, 'emailService');
        const emailModule = require(path.resolve(__dirname, '../../gcloud/email'));
        return await emailModule(req, res);
      } catch (err: any) {
        await logToFirestore('error', `[emailService] Error handling request: ${err?.message}`, { error: err?.message }, 'emailService');
        if (!res.headersSent) {
          res.status(500).json({ error: err?.message || 'Internal email service error' });
        }
      }
    });
  }
);

/**
 * Project Artifact Secure Download Endpoint.
 * Validates timeboxed HMAC signature and streams file directly from GCS.
 */
export const downloadArtifact = onRequest(
  {
    region: 'europe-west2',
    timeoutSeconds: 60,
    cors: true,
  },
  async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    corsHandler(req, res, async () => {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      if (req.method !== 'GET') {
        res.status(405).json({
          error: 'METHOD_NOT_ALLOWED',
          message: 'Only GET requests are supported on /downloadArtifact.',
        });
        return;
      }

      const { projectId, artifactId, expires, signature } = req.query;

      if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
        res.status(400).json({
          error: 'MISSING_PROJECT_ID',
          message: '[FAIL FAST] Mandatory query param "projectId" is missing.',
        });
        return;
      }

      if (!artifactId || typeof artifactId !== 'string' || artifactId.trim() === '') {
        res.status(400).json({
          error: 'MISSING_ARTIFACT_ID',
          message: '[FAIL FAST] Mandatory query param "artifactId" is missing.',
        });
        return;
      }

      try {
        assertValidEntityId((projectId as string).trim(), 'pr');
        assertValidEntityId((artifactId as string).trim(), 'ar');
      } catch (err: any) {
        res.status(400).json({
          error: 'INVALID_ENTITY_ID',
          message: err.message,
        });
        return;
      }

      if (!expires || typeof expires !== 'string' || !Number(expires)) {
        res.status(400).json({
          error: 'MISSING_EXPIRES',
          message: '[FAIL FAST] Mandatory query param "expires" is missing or invalid.',
        });
        return;
      }

      if (!signature || typeof signature !== 'string' || signature.trim() === '') {
        res.status(400).json({
          error: 'MISSING_SIGNATURE',
          message: '[FAIL FAST] Mandatory query param "signature" is missing.',
        });
        return;
      }

      const verification = verifyArtifactDownloadToken(
        projectId.trim(),
        artifactId.trim(),
        Number(expires),
        signature.trim()
      );

      if (!verification.valid) {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: verification.reason || 'Invalid or expired signature.',
        });
        return;
      }

      try {
        const project = await getProject(projectId.trim());
        if (!project) {
          res.status(404).json({
            error: 'PROJECT_NOT_FOUND',
            message: `Project "${projectId}" not found.`,
          });
          return;
        }

        const artifact = (project.artifacts || []).find((a) => a.id === artifactId.trim());
        if (!artifact) {
          res.status(404).json({
            error: 'ARTIFACT_NOT_FOUND',
            message: `Artifact "${artifactId}" not found in project "${projectId}".`,
          });
          return;
        }

        const { buffer, mimeType, filename } = await downloadBufferFromGcs(artifact.gcsUri);

        res.setHeader('Content-Type', mimeType || artifact.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename || artifact.name)}"`);
        res.setHeader('Content-Length', buffer.length);
        res.status(200).send(buffer);
      } catch (err: any) {
        await logToFirestore('error', `[downloadArtifact] Error serving file: ${err?.message}`, { error: err?.message, projectId, artifactId }, 'downloadArtifact');
        res.status(500).json({
          error: 'DOWNLOAD_FAILED',
          message: err?.message || 'Failed to download artifact.',
        });
      }
    });
  }
);

/**
 * Assign / Associate Email with Project Endpoint.
 * Explicitly associates an email from the emails repository with a project document.
 */
export const assignEmail = onRequest(
  {
    region: 'europe-west2',
    timeoutSeconds: 60,
    cors: true,
  },
  async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    corsHandler(req, res, async () => {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      if (req.method !== 'POST') {
        res.status(405).json({
          error: 'METHOD_NOT_ALLOWED',
          message: 'Only POST requests are supported on /assignEmail.',
        });
        return;
      }

      const { emailId, projectId } = req.body || {};

      if (!emailId || typeof emailId !== 'string' || emailId.trim() === '') {
        res.status(400).json({
          error: 'MISSING_EMAIL_ID',
          message: '[FAIL FAST] Mandatory field "emailId" is missing from request body.',
        });
        return;
      }

      if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
        res.status(400).json({
          error: 'MISSING_PROJECT_ID',
          message: '[FAIL FAST] Mandatory field "projectId" is missing from request body.',
        });
        return;
      }

      try {
        await logToFirestore(
          'info',
          `[assignEmail] Assigning email "${emailId}" to project "${projectId}"`,
          { emailId, projectId },
          'assignEmail'
        );

        const result = await executeAssignEmailToProject(projectId.trim(), {
          emailId: emailId.trim(),
          projectId: projectId.trim(),
        });

        if (!result.success) {
          res.status(400).json(result);
          return;
        }

        res.status(200).json(result);
      } catch (err: any) {
        await logToFirestore(
          'error',
          `[assignEmail] Failed to assign email: ${err?.message}`,
          { error: err?.message, emailId, projectId },
          'assignEmail'
        );
        res.status(500).json({
          error: 'ASSIGN_EMAIL_FAILED',
          message: err?.message || 'Failed to assign email to project.',
        });
      }
    });
  }
);

/**
 * List Unassigned Inbox Emails Endpoint.
 * Retrieves unassigned emails from Resend API and repository inbox.
 */
export const listInboxEmails = onRequest(
  {
    region: 'europe-west2',
    timeoutSeconds: 60,
    cors: true,
  },
  async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    corsHandler(req, res, async () => {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      try {
        const limit = req.query.limit ? Number(req.query.limit) : 25;
        const result = await executeListUnassignedInboxEmails('', { limit });
        res.status(200).json(result);
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Failed to list inbox emails' });
      }
    });
  }
);

/**
 * Delete Email Endpoint.
 * Permanently removes an email record from the repository and any project association.
 */
export const deleteEmail = onRequest(
  {
    region: 'europe-west2',
    timeoutSeconds: 60,
    cors: true,
  },
  async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    corsHandler(req, res, async () => {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      if (req.method !== 'POST' && req.method !== 'DELETE') {
        res.status(405).json({
          error: 'METHOD_NOT_ALLOWED',
          message: 'Only POST and DELETE requests are supported on /deleteEmail.',
        });
        return;
      }

      const emailId = (req.body?.emailId || req.query?.emailId)?.toString()?.trim();

      if (!emailId) {
        res.status(400).json({
          error: 'MISSING_EMAIL_ID',
          message: '[FAIL FAST] Mandatory field "emailId" is missing from request.',
        });
        return;
      }

      try {
        await logToFirestore(
          'info',
          `[deleteEmail] Deleting email "${emailId}"`,
          { emailId },
          'deleteEmail'
        );

        const result = await executeDeleteCandidateEmailMessage('', {
          emailId,
        });

        if (!result.success) {
          res.status(400).json(result);
          return;
        }

        res.status(200).json(result);
      } catch (err: any) {
        await logToFirestore(
          'error',
          `[deleteEmail] Failed to delete email: ${err?.message}`,
          { error: err?.message, emailId },
          'deleteEmail'
        );
        res.status(500).json({
          error: 'DELETE_EMAIL_FAILED',
          message: err?.message || 'Failed to delete email record.',
        });
      }
    });
  }
);



