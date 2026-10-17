import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ProjectDocument, ChatMessageRecord } from './types';
import { serverConfig } from './config';
import { assertValidEntityId } from './entityId';

// Ensure Firebase Admin is initialized once
if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

/**
 * Fetch a project document from Firestore.
 * Throws explicit error if projectId is missing or violates the pr- entity ID convention.
 */
export async function getProject(projectId: string): Promise<ProjectDocument | null> {
  if (!projectId || projectId.trim() === '') {
    throw new Error('[FAIL FAST] Mandatory parameter "projectId" is missing from getProject lookup.');
  }

  assertValidEntityId(projectId, 'pr');

  const docSnap = await db.collection('projects').doc(projectId).get();
  if (!docSnap.exists) {
    return null;
  }
  return docSnap.data() as ProjectDocument;
}

/**
 * Seed or reset the default project document.
 */
export async function seedDefaultProject(projectId: string = serverConfig.defaultProjectId): Promise<ProjectDocument> {
  assertValidEntityId(projectId, 'pr');

  const now = new Date().toISOString();
  const defaultData: ProjectDocument = {
    id: projectId,
    title: 'Scriptorium Initial Project',
    description: 'This is the initial project record for the Scriptorium supervisor MVP.',
    status: 'draft',
    tags: ['mvp', 'supervisor', 'starter'],
    artifacts: [],
    emails: [],
    createdAt: now,
    updatedAt: now,
    metadata: {
      environment: 'development',
      managedBy: 'Gemini 3.8 Flash Agent',
    },
  };

  await db.collection('projects').doc(projectId).set(defaultData);
  return defaultData;
}

/**
 * Persist a message to the project's messages subcollection or system_chats/emails/messages.
 */
export async function persistMessage(projectId: string, message: ChatMessageRecord): Promise<void> {
  if (!projectId) {
    throw new Error('[FAIL FAST] Mandatory parameter "projectId" is missing from persistMessage.');
  }

  assertValidEntityId(message.id, 'ms');

  if (projectId === 'emails') {
    await db
      .collection('system_chats')
      .doc('emails')
      .collection('messages')
      .doc(message.id)
      .set({
        ...message,
        createdAtServer: FieldValue.serverTimestamp(),
      });
    return;
  }

  assertValidEntityId(projectId, 'pr');

  await db
    .collection('projects')
    .doc(projectId)
    .collection('messages')
    .doc(message.id)
    .set({
      ...message,
      createdAtServer: FieldValue.serverTimestamp(),
    });
}

/**
 * Fetch recent chat history for context.
 */
export async function getRecentMessages(projectId: string, limitCount: number = 10): Promise<ChatMessageRecord[]> {
  if (!projectId) {
    throw new Error('[FAIL FAST] Mandatory parameter "projectId" is missing from getRecentMessages.');
  }

  if (projectId === 'emails') {
    const snapshot = await db
      .collection('system_chats')
      .doc('emails')
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .limitToLast(limitCount)
      .get();

    return snapshot.docs.map((doc) => doc.data() as ChatMessageRecord);
  }

  assertValidEntityId(projectId, 'pr');

  const snapshot = await db
    .collection('projects')
    .doc(projectId)
    .collection('messages')
    .orderBy('timestamp', 'asc')
    .limitToLast(limitCount)
    .get();

  return snapshot.docs.map((doc) => doc.data() as ChatMessageRecord);
}

