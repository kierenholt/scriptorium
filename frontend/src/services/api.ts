import { config } from '../config';

export interface ChatStreamCallbacks {
  onToolCallStart?: (tool: { id: string; name: string; args: Record<string, unknown> }) => void;
  onToolCallResult?: (result: { id: string; name: string; success: boolean; result?: unknown; error?: string }) => void;
  onTextChunk?: (chunk: string) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

/**
 * Stream a supervisor chat message to the Cloud Function backend via SSE.
 */
export async function sendChatMessage(
  projectId: string,
  message: string,
  callbacks: ChatStreamCallbacks
): Promise<void> {
  const url = `${config.apiBaseUrl}/chat`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ projectId, message }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP Error ${response.status}: ${errText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null, cannot stream SSE.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const block of lines) {
        if (!block.trim()) continue;

        let eventType = 'message';
        let dataStr = '';

        for (const line of block.split('\n')) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            dataStr = line.slice(6).trim();
          }
        }

        if (!dataStr) continue;

        try {
          const parsed = JSON.parse(dataStr);

          switch (eventType) {
            case 'tool_call_start':
              callbacks.onToolCallStart?.(parsed);
              break;
            case 'tool_call_result':
              callbacks.onToolCallResult?.(parsed);
              break;
            case 'agent_text':
              if (parsed.token) {
                callbacks.onTextChunk?.(parsed.token);
              }
              break;
            case 'done':
              callbacks.onDone?.();
              break;
            case 'error':
              callbacks.onError?.(new Error(parsed.message || 'Server reported error'));
              break;
          }
        } catch (jsonErr) {
          console.warn('Failed to parse SSE JSON payload:', dataStr);
        }
      }
    }

    callbacks.onDone?.();
  } catch (error: any) {
    callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Seed or reset the default project in Firestore via the backend endpoint.
 */
export async function seedProject(projectId: string = config.projectId): Promise<void> {
  const url = `${config.apiBaseUrl}/seed?projectId=${encodeURIComponent(projectId)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to seed project (${response.status}): ${errorText}`);
  }
}
