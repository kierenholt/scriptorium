import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GoogleAuth } from 'google-auth-library';
import { serverConfig } from './config';

async function getAccessToken(): Promise<string> {
  const credPath = path.join(os.homedir(), '.config/gcloud/application_default_credentials.json');
  if (fs.existsSync(credPath)) {
    try {
      const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      if (creds.client_id && creds.refresh_token) {
        const body = new URLSearchParams({
          client_id: creds.client_id,
          client_secret: creds.client_secret,
          refresh_token: creds.refresh_token,
          grant_type: 'refresh_token',
        });
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data.access_token) {
            return data.access_token;
          }
        }
      }
    } catch {
      // Fall through to GoogleAuth
    }
  }

  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) {
    throw new Error('[FAIL FAST] Failed to obtain Google Cloud OAuth access token for Vertex AI Search.');
  }
  return tokenResponse.token;
}

export interface SearchTalentParams {
  query: string;
  filter?: string;
  pageSize?: number;
}

export interface VertexSearchDocument {
  id: string;
  name?: string;
  role?: string;
  skills?: string;
  location?: string;
  years_experience?: number;
  email?: string;
  vetted?: boolean;
  searchable?: boolean;
  documentLink?: string;
  score?: number;
  [key: string]: unknown;
}

export interface SearchTalentResponse {
  success: boolean;
  query: string;
  filter?: string;
  totalSize?: number;
  results: VertexSearchDocument[];
}

/**
 * Executes a semantic search query against the GCP Discovery Engine (Vertex AI Search) datastore.
 * 
 * @param params Query parameters including semantic query text, optional metadata filter, and pageSize.
 * @returns Formatted search results with extracted document metadata.
 */
export async function searchVertexAI(params: SearchTalentParams): Promise<SearchTalentResponse> {
  if (!params.query || typeof params.query !== 'string' || params.query.trim() === '') {
    throw new Error('[FAIL FAST] Mandatory search parameter "query" must be a non-empty string.');
  }

  const token = await getAccessToken();

  const location = serverConfig.vertexSearchLocation;
  const projectNumber = serverConfig.vertexSearchProjectNumber;
  const datastoreId = serverConfig.vertexSearchDatastoreId;
  const projectId = serverConfig.projectId;

  const hostname = `${location}-discoveryengine.googleapis.com`;
  const searchUrl = `https://${hostname}/v1/projects/${projectNumber}/locations/${location}/collections/default_collection/dataStores/${datastoreId}/servingConfigs/default_search:search`;

  const payload: { query: string; pageSize: number; filter?: string } = {
    query: params.query.trim(),
    pageSize: params.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 10,
  };

  if (params.filter && params.filter.trim()) {
    payload.filter = params.filter.trim();
  }

  const response = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-goog-user-project': projectId,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorDetails = '';
    try {
      const errJson = await response.json() as any;
      errorDetails = errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      errorDetails = await response.text();
    }
    throw new Error(`[Vertex AI Search Error] HTTP ${response.status}: ${errorDetails}`);
  }

  const data = (await response.json()) as any;
  const rawResults: any[] = data.results || [];

  const results: VertexSearchDocument[] = rawResults.map((item: any) => {
    const doc = item.document || {};
    const docId = doc.id || (doc.name ? doc.name.split('/').pop() : 'unknown');

    let parsedJson: Record<string, unknown> = {};
    if (doc.jsonData) {
      try {
        parsedJson = typeof doc.jsonData === 'string' ? JSON.parse(doc.jsonData) : doc.jsonData;
      } catch {
        parsedJson = {};
      }
    }

    const structData = (doc.structData || {}) as Record<string, unknown>;
    const derivedStructData = (doc.derivedStructData || {}) as Record<string, unknown>;

    return {
      id: docId,
      name: (parsedJson.name || structData.name) as string | undefined,
      role: (parsedJson.role || structData.role) as string | undefined,
      skills: (parsedJson.skills || structData.skills) as string | undefined,
      location: (parsedJson.location || structData.location) as string | undefined,
      years_experience: (parsedJson.years_experience ?? structData.years_experience) as number | undefined,
      email: (parsedJson.email || structData.email) as string | undefined,
      vetted: (parsedJson.vetted ?? structData.vetted) as boolean | undefined,
      searchable: (parsedJson.searchable ?? structData.searchable) as boolean | undefined,
      documentLink: (derivedStructData.link || doc.content?.uri) as string | undefined,
      score: item.rankSignals?.semanticSimilarityScore as number | undefined,
      ...structData,
      ...parsedJson,
    };
  });

  return {
    success: true,
    query: params.query.trim(),
    filter: params.filter?.trim(),
    totalSize: typeof data.totalSize === 'number' ? data.totalSize : results.length,
    results,
  };
}

export interface IndexTalentCvParams {
  documentId?: string;
  name: string;
  role: string;
  skills: string;
  location?: string;
  yearsExperience?: number;
  summary?: string;
}

export interface IndexTalentCvResponse {
  success: boolean;
  documentId: string;
  message: string;
}

/**
 * Indexes a candidate CV or talent profile into the GCP Discovery Engine (Vertex AI Search) datastore.
 * 
 * @param params Candidate data including name, role, skills, location, yearsExperience, summary.
 * @returns Index confirmation with document ID.
 */
export async function indexVertexDocument(params: IndexTalentCvParams): Promise<IndexTalentCvResponse> {
  if (!params.name || typeof params.name !== 'string' || params.name.trim() === '') {
    throw new Error('[FAIL FAST] Mandatory candidate parameter "name" must be a non-empty string.');
  }
  if (!params.role || typeof params.role !== 'string' || params.role.trim() === '') {
    throw new Error('[FAIL FAST] Mandatory candidate parameter "role" must be a non-empty string.');
  }
  if (!params.skills || typeof params.skills !== 'string' || params.skills.trim() === '') {
    throw new Error('[FAIL FAST] Mandatory candidate parameter "skills" must be a non-empty string.');
  }

  const token = await getAccessToken();

  const location = serverConfig.vertexSearchLocation;
  const projectNumber = serverConfig.vertexSearchProjectNumber;
  const datastoreId = serverConfig.vertexSearchDatastoreId;
  const projectId = serverConfig.projectId;

  const sanitizedSlug = params.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 24);
  const documentId = params.documentId && params.documentId.trim() !== ''
    ? params.documentId.trim()
    : `talent_${sanitizedSlug}_${Date.now()}`;

  const hostname = `${location}-discoveryengine.googleapis.com`;
  const docUrl = `https://${hostname}/v1/projects/${projectNumber}/locations/${location}/collections/default_collection/dataStores/${datastoreId}/branches/0/documents?documentId=${encodeURIComponent(documentId)}`;

  const payload = {
    id: documentId,
    jsonData: JSON.stringify({
      name: params.name.trim(),
      role: params.role.trim(),
      skills: params.skills.trim(),
      location: params.location?.trim() || undefined,
      years_experience: params.yearsExperience !== undefined ? Number(params.yearsExperience) : undefined,
      summary: params.summary?.trim() || undefined,
      searchable: true,
      vetted: true,
    }),
  };

  const response = await fetch(docUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-goog-user-project': projectId,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorDetails = '';
    try {
      const errJson = (await response.json()) as any;
      errorDetails = errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      errorDetails = await response.text();
    }
    throw new Error(`[Vertex AI Document Index Error] HTTP ${response.status}: ${errorDetails}`);
  }

  return {
    success: true,
    documentId,
    message: `Candidate "${params.name.trim()}" successfully indexed into Vertex AI datastore with ID "${documentId}". Indexing propagation may take 1-2 minutes to be searchable.`,
  };
}

