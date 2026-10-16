import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';
import { runAgentConversation } from './agent';
import { seedDefaultProject } from './firestore';

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

      const { projectId, message } = req.body || {};

      // Fail-fast validation
      if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
        res.status(400).json({
          error: 'MISSING_PROJECT_ID',
          message: '[FAIL FAST] Mandatory field "projectId" is missing from request body.',
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

      // Configure SSE Headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const sendEvent = (event: string, data: Record<string, unknown>) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        sendEvent('connection_open', { status: 'connected', projectId });

        await runAgentConversation(projectId.trim(), message.trim(), {
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
        });

        sendEvent('done', { status: 'complete' });
        res.end();
      } catch (err: any) {
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
 * Creates or resets the project-default document in Firestore.
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

      const projectId = req.query.projectId as string || req.body?.projectId || 'project-default';

      try {
        const project = await seedDefaultProject(projectId);
        res.status(200).json({
          success: true,
          message: `Project "${projectId}" successfully seeded.`,
          project,
        });
      } catch (err: any) {
        res.status(500).json({
          error: 'SEED_FAILED',
          message: err?.message || 'Failed to seed default project.',
        });
      }
    });
  }
);
