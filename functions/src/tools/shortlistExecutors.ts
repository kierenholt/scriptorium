import { db } from '../firestore';
import { ShortlistStatus, ShortlistedTalent } from '../types';
import { generateEntityId, assertValidEntityId } from '../entityId';
import {
  ToolExecutionResult,
  ShortlistCandidateArgs,
  ListShortlistedTalentsArgs,
  UpdateShortlistedTalentStatusArgs,
  RemoveShortlistedTalentArgs,
} from './types';

export const VALID_SHORTLIST_STATUSES: ShortlistStatus[] = [
  'nominated',
  'contacted',
  'shortlisted',
  'rejected',
  'booked',
];

/**
 * Execute shortlistCandidateForProject tool (C in CRUD).
 * Associates a candidate or specialist with a project's shortlistedTalents subcollection.
 */
export async function executeShortlistCandidate(
  projectId: string,
  args: ShortlistCandidateArgs
): Promise<ToolExecutionResult> {
  const targetProjectId = (args.projectId || (projectId !== 'emails' ? projectId : undefined))?.trim();

  if (!targetProjectId) {
    return {
      success: false,
      error: 'Missing required projectId.',
      message: 'Failed to shortlist talent: target project ID (e.g. pr-xxxxxx) is required.',
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

  if (!args.name || typeof args.name !== 'string' || args.name.trim() === '') {
    return {
      success: false,
      error: 'Missing required parameter "name".',
      message: 'Failed to shortlist candidate: candidate name is required.',
    };
  }

  if (!args.role || typeof args.role !== 'string' || args.role.trim() === '') {
    return {
      success: false,
      error: 'Missing required parameter "role".',
      message: 'Failed to shortlist candidate: role or discipline is required.',
    };
  }

  const rawStatus = (args.status || 'shortlisted') as ShortlistStatus;
  if (!VALID_SHORTLIST_STATUSES.includes(rawStatus)) {
    return {
      success: false,
      error: `Invalid status "${args.status}". Allowed values: ${VALID_SHORTLIST_STATUSES.join(', ')}.`,
      message: `Shortlist status must be one of: ${VALID_SHORTLIST_STATUSES.join(', ')}.`,
    };
  }

  // Check project existence
  const projectRef = db.collection('projects').doc(targetProjectId);
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists) {
    return {
      success: false,
      error: `Project "${targetProjectId}" not found.`,
      message: `Cannot shortlist talent: project "${targetProjectId}" does not exist in Firestore.`,
    };
  }

  const shortlistId = generateEntityId('sl');
  const now = new Date().toISOString();

  const record: ShortlistedTalent = {
    id: shortlistId,
    name: args.name.trim(),
    role: args.role.trim(),
    status: rawStatus,
    ...(args.talentId && typeof args.talentId === 'string' ? { talentId: args.talentId.trim() } : {}),
    ...(args.notes && typeof args.notes === 'string' ? { notes: args.notes.trim() } : {}),
    ...(args.dayRate !== undefined && args.dayRate !== null ? { dayRate: args.dayRate } : {}),
    createdAt: now,
    updatedAt: now,
  };

  const shortlistRef = projectRef.collection('shortlistedTalents').doc(shortlistId);
  await shortlistRef.set(record);

  // Update project timestamp to trigger real-time reactive watchers
  await projectRef.update({ updatedAt: now });

  return {
    success: true,
    message: `Candidate "${record.name}" (${record.role}) successfully shortlisted for project "${targetProjectId}" with status "${record.status}". Shortlist ID: ${shortlistId}.`,
    data: record as unknown as Record<string, unknown>,
  };
}

/**
 * Execute listShortlistedTalentsForProject tool (R in CRUD).
 * Retrieves candidate profiles currently shortlisted under the project.
 */
export async function executeListShortlistedTalents(
  projectId: string,
  args: ListShortlistedTalentsArgs = {}
): Promise<ToolExecutionResult> {
  const targetProjectId = (args.projectId || (projectId !== 'emails' ? projectId : undefined))?.trim();

  if (!targetProjectId) {
    return {
      success: false,
      error: 'Missing required projectId.',
      message: 'Failed to list shortlisted talent: target project ID (e.g. pr-xxxxxx) is required.',
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

  const projectRef = db.collection('projects').doc(targetProjectId);
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists) {
    return {
      success: false,
      error: `Project "${targetProjectId}" not found.`,
      message: `Cannot list shortlisted talent: project "${targetProjectId}" does not exist.`,
    };
  }

  let queryRef: FirebaseFirestore.Query = projectRef.collection('shortlistedTalents');

  if (args.status) {
    const rawStatus = args.status as ShortlistStatus;
    if (!VALID_SHORTLIST_STATUSES.includes(rawStatus)) {
      return {
        success: false,
        error: `Invalid status filter "${args.status}". Allowed values: ${VALID_SHORTLIST_STATUSES.join(', ')}.`,
        message: `Status filter must be one of: ${VALID_SHORTLIST_STATUSES.join(', ')}.`,
      };
    }
    queryRef = queryRef.where('status', '==', rawStatus);
  }

  const limitCount = Math.min(Math.max(args.limit || 20, 1), 100);
  queryRef = queryRef.limit(limitCount);

  const snapshot = await queryRef.get();
  const talents: ShortlistedTalent[] = [];
  snapshot.forEach((docSnap) => {
    talents.push(docSnap.data() as ShortlistedTalent);
  });

  return {
    success: true,
    message: `Retrieved ${talents.length} shortlisted candidate(s) for project "${projectId}".`,
    data: {
      projectId,
      count: talents.length,
      shortlistedTalents: talents,
    },
  };
}

/**
 * Execute updateShortlistedTalentStatus tool (U in CRUD).
 * Modifies the lifecycle status, notes, or day rate for a shortlisted candidate.
 */
export async function executeUpdateShortlistedTalentStatus(
  projectId: string,
  args: UpdateShortlistedTalentStatusArgs
): Promise<ToolExecutionResult> {
  if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
    return {
      success: false,
      error: 'Missing required projectId.',
      message: 'Failed to update shortlisted talent: projectId is required.',
    };
  }

  if (!args.shortlistId || typeof args.shortlistId !== 'string' || args.shortlistId.trim() === '') {
    return {
      success: false,
      error: 'Missing required parameter "shortlistId".',
      message: 'Failed to update shortlisted candidate: shortlistId is required.',
    };
  }

  const shortlistId = args.shortlistId.trim();
  try {
    assertValidEntityId(shortlistId, 'sl');
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      message: `Invalid shortlist identifier "${shortlistId}". Expected format: "sl-xxxxxx".`,
    };
  }

  if (!args.status && !args.notes && args.dayRate === undefined) {
    return {
      success: false,
      error: 'At least one field ("status", "notes", or "dayRate") must be provided for update.',
      message: 'Failed to update shortlisted candidate: no update fields specified.',
    };
  }

  const projectRef = db.collection('projects').doc(projectId.trim());
  const shortlistRef = projectRef.collection('shortlistedTalents').doc(shortlistId);
  const shortlistSnap = await shortlistRef.get();

  if (!shortlistSnap.exists) {
    return {
      success: false,
      error: `Shortlisted candidate "${shortlistId}" not found in project "${projectId}".`,
      message: `No candidate shortlist record exists with ID "${shortlistId}" under project "${projectId}".`,
    };
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    updatedAt: now,
  };

  if (args.status) {
    const rawStatus = args.status as ShortlistStatus;
    if (!VALID_SHORTLIST_STATUSES.includes(rawStatus)) {
      return {
        success: false,
        error: `Invalid status "${args.status}". Allowed values: ${VALID_SHORTLIST_STATUSES.join(', ')}.`,
        message: `Status must be one of: ${VALID_SHORTLIST_STATUSES.join(', ')}.`,
      };
    }
    updates.status = rawStatus;
  }

  if (args.notes !== undefined && typeof args.notes === 'string') {
    updates.notes = args.notes.trim();
  }

  if (args.dayRate !== undefined && args.dayRate !== null) {
    updates.dayRate = args.dayRate;
  }

  await shortlistRef.update(updates);
  await projectRef.update({ updatedAt: now });

  const updatedRecord = {
    ...shortlistSnap.data(),
    ...updates,
  };

  return {
    success: true,
    message: `Shortlisted candidate "${shortlistId}" successfully updated in project "${projectId}".`,
    data: updatedRecord as Record<string, unknown>,
  };
}

/**
 * Execute removeShortlistedTalentFromProject tool (D in CRUD).
 * Removes a candidate from the project's shortlistedTalents subcollection.
 */
export async function executeRemoveShortlistedTalent(
  projectId: string,
  args: RemoveShortlistedTalentArgs
): Promise<ToolExecutionResult> {
  if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
    return {
      success: false,
      error: 'Missing required projectId.',
      message: 'Failed to remove shortlisted talent: projectId is required.',
    };
  }

  if (!args.shortlistId || typeof args.shortlistId !== 'string' || args.shortlistId.trim() === '') {
    return {
      success: false,
      error: 'Missing required parameter "shortlistId".',
      message: 'Failed to remove shortlisted candidate: shortlistId is required.',
    };
  }

  const shortlistId = args.shortlistId.trim();
  try {
    assertValidEntityId(shortlistId, 'sl');
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      message: `Invalid shortlist identifier "${shortlistId}". Expected format: "sl-xxxxxx".`,
    };
  }

  const projectRef = db.collection('projects').doc(projectId.trim());
  const shortlistRef = projectRef.collection('shortlistedTalents').doc(shortlistId);
  const shortlistSnap = await shortlistRef.get();

  if (!shortlistSnap.exists) {
    return {
      success: false,
      error: `Shortlisted candidate "${shortlistId}" not found in project "${projectId}".`,
      message: `Cannot remove candidate: shortlist record "${shortlistId}" does not exist in project "${projectId}".`,
    };
  }

  const candidateData = shortlistSnap.data() as ShortlistedTalent;
  const now = new Date().toISOString();

  await shortlistRef.delete();
  await projectRef.update({ updatedAt: now });

  return {
    success: true,
    message: `Candidate "${candidateData.name}" (${shortlistId}) successfully removed from shortlist in project "${projectId}".`,
    data: {
      projectId,
      shortlistId,
      removedCandidateName: candidateData.name,
    },
  };
}
