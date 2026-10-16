import { GoogleGenAI } from '@google/genai';
import { serverConfig } from './config';
import { allToolDeclarations } from './tools/declarations';
import { dispatchToolCall, ToolExecutionResult } from './tools/executors';
import { getProject, getRecentMessages, persistMessage } from './firestore';
import { ToolCallExecution } from './types';

export interface StreamCallbacks {
  onToolCallStart: (toolCall: { id: string; name: string; args: Record<string, unknown> }) => void;
  onToolCallResult: (result: { id: string; name: string; success: boolean; result?: unknown; error?: string }) => void;
  onTextChunk: (text: string) => void;
  onError: (err: Error) => void;
}

const SYSTEM_INSTRUCTION = `You are Scriptorium's Project Supervisor Agent.
Your responsibility is to assist the supervisor in viewing, managing, and mutating the current Firestore project document.
When the user asks you to perform an action on the project (e.g. change status, rename, edit description, add or remove tags):
1. Immediately invoke the corresponding specific tool with precise parameters.
2. When the tool execution result is returned to you, explain clearly what was done and conclude with a concise message like "I'm done" or confirm the new project state.
3. If an action is invalid or fails, explain the exact error directly.`;

export async function runAgentConversation(
  projectId: string,
  userPrompt: string,
  callbacks: StreamCallbacks
): Promise<{ finalResponse: string; toolExecutions: ToolCallExecution[] }> {
  // Fail fast check
  if (!projectId || projectId.trim() === '') {
    throw new Error('[FAIL FAST] projectId cannot be empty in runAgentConversation.');
  }
  if (!userPrompt || userPrompt.trim() === '') {
    throw new Error('[FAIL FAST] userPrompt cannot be empty in runAgentConversation.');
  }

  // Verify project exists
  const currentProject = await getProject(projectId);
  if (!currentProject) {
    throw new Error(`[FAIL FAST] Project with ID "${projectId}" does not exist in Firestore.`);
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

  // Append latest user prompt
  contents.push({ role: 'user', parts: [{ text: userPrompt }] });

  // Persist user prompt immediately
  const userMsgId = `msg-user-${Date.now()}`;
  await persistMessage(projectId, {
    id: userMsgId,
    sender: 'user',
    content: userPrompt,
    timestamp: new Date().toISOString(),
  });

  const toolExecutions: ToolCallExecution[] = [];
  let finalResponseText = '';
  let maxTurns = 5;

  while (maxTurns > 0) {
    maxTurns--;

    const response = await ai.models.generateContent({
      model: serverConfig.modelName,
      contents,
      config: {
        systemInstruction: `${SYSTEM_INSTRUCTION}\n\nCURRENT PROJECT STATE:\n${JSON.stringify(currentProject, null, 2)}`,
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
  const agentMsgId = `msg-agent-${Date.now()}`;
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
