/**
 * PolyU BFF Agent API Client
 *
 * This service provides methods to interact with the PolyU BFF API
 * for agent discovery, agent details, and chat functionality.
 *
 * All requests include the Keycloak JWT token for authentication.
 */

import { POLYU_BFF_API_URL } from '@/envs/app';
import { polyuAuthHelpers } from '@/libs/oidc-provider/keycloak-jwt';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PolyuAgent {
  id: string;
  difyAppId: string;
  name: string;
  description: string;
  avatarUrl?: string;
  mode: 'chat' | 'completion' | 'workflow';
  visibility: 'private' | 'department' | 'public';
  reviewStatus: 'draft' | 'PendingReview' | 'Approved' | 'Rejected' | 'ChangesRequested';
  subjectTags: string[];
  courseCode?: string;
  deptCode?: string;
  creatorId: string;
  creatorName?: string;
  totalCalls: number;
  todayCalls: number;
  createdAt: string;
  updatedAt: string;
}

export interface PolyuAgentListParams {
  page?: number;
  pageSize?: number;
  visibility?: string;
  subjectTag?: string;
  deptCode?: string;
  keyword?: string;
}

export interface PolyuAgentListResponse {
  agents: PolyuAgent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PolyuChatMessage {
  query: string;
  conversationId?: string;
  files?: Array<{ type: string; url: string }>;
}

export interface PolyuChatEvent {
  event: 'message' | 'message_end' | 'error' | 'agent_thought' | 'agent_message';
  answer?: string;
  conversationId?: string;
  messageId?: string;
  metadata?: Record<string, unknown>;
}

export interface PolyuReference {
  id: string;
  knowledgeBaseId: string;
  documentName: string;
  content: string;
  score: number;
  sourceUrl?: string;
}

// ---------------------------------------------------------------------------
// Helper: Get auth headers
// ---------------------------------------------------------------------------

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await polyuAuthHelpers.getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ---------------------------------------------------------------------------
// Helper: Build BFF URL
// ---------------------------------------------------------------------------

function bffUrl(path: string): string {
  const base = POLYU_BFF_API_URL || '/api/bff';
  return `${base}${path}`;
}

// ---------------------------------------------------------------------------
// Agent API
// ---------------------------------------------------------------------------

class PolyuAgentService {
  /**
   * List approved public agents with pagination and filters
   */
  listAgents = async (params: PolyuAgentListParams = {}): Promise<PolyuAgentListResponse> => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params.visibility) searchParams.set('visibility', params.visibility);
    if (params.subjectTag) searchParams.set('subjectTag', params.subjectTag);
    if (params.deptCode) searchParams.set('deptCode', params.deptCode);
    if (params.keyword) searchParams.set('keyword', params.keyword);

    const qs = searchParams.toString();
    const url = bffUrl(`/agents${qs ? `?${qs}` : ''}`);
    const headers = await getAuthHeaders();

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Failed to list agents: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<PolyuAgentListResponse>;
  };

  /**
   * Get a single agent by ID
   */
  getAgent = async (agentId: string): Promise<PolyuAgent> => {
    const url = bffUrl(`/agents/${agentId}`);
    const headers = await getAuthHeaders();

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Failed to get agent ${agentId}: ${response.status}`);
    }

    return response.json() as Promise<PolyuAgent>;
  };

  /**
   * Start a chat with an agent (SSE streaming)
   *
   * Returns a ReadableStream of chat events.
   */
  chatWithAgent = async (
    agentId: string,
    message: PolyuChatMessage,
  ): Promise<ReadableStream<Uint8Array>> => {
    const url = bffUrl(`/chat/agents/${agentId}`);
    const headers = await getAuthHeaders();

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: message.query,
        conversation_id: message.conversationId,
        inputs: {},
        files: message.files || [],
        response_mode: 'streaming',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chat failed: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming chat');
    }

    return response.body;
  };

  /**
   * Parse SSE stream into structured events
   */
  parseSSEReader = (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onEvent: (event: PolyuChatEvent) => void,
    onError?: (error: Error) => void,
    onDone?: () => void,
  ): void => {
    const decoder = new TextDecoder();
    let buffer = '';

    const processChunk = (chunk: Uint8Array) => {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            onDone?.();
            return;
          }
          try {
            const event = JSON.parse(data) as PolyuChatEvent;
            onEvent(event);
          } catch {
            // Skip malformed JSON
          }
        } else if (trimmed.startsWith('event: ')) {
          // SSE event type - handled via data parsing
        }
      }
    };

    const read = async () => {
      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            onDone?.();
            break;
          }
          processChunk(value);
        }
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    };

    read();
  };

  /**
   * Get agent categories (subject tags) for filtering
   */
  getAgentCategories = async (): Promise<string[]> => {
    const url = bffUrl('/agents/categories');
    const headers = await getAuthHeaders();

    const response = await fetch(url, { headers });

    if (!response.ok) {
      // Fallback to default categories
      return [
        'APSS',
        'BRE',
        'CBS',
        'CC',
        'CPCE',
        'DES',
        'EIE',
        'FB',
        'FH',
        'FS',
        'HTI',
      ];
    }

    const data = await response.json() as { categories: string[] };
    return data.categories;
  };
}

export const polyuAgentService = new PolyuAgentService();
