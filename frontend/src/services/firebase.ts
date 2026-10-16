import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import { config } from '../config';
import { ProjectDocument, ChatMessage, ProjectEmail } from '../types';

// Initialize Firebase client
const app = getApps().length === 0 ? initializeApp(config.firebase) : getApp();
export const db = getFirestore(app);

// Connect to Firestore Emulator if configured
if (config.useEmulator && config.firestoreEmulatorHost && config.firestoreEmulatorPort) {
  const globalAny = globalThis as unknown as { _firestoreEmulatorConnected?: boolean };
  if (!globalAny._firestoreEmulatorConnected) {
    try {
      connectFirestoreEmulator(db, config.firestoreEmulatorHost, config.firestoreEmulatorPort);
      globalAny._firestoreEmulatorConnected = true;
    } catch {
      // Ignore if already connected in hot reload / test runtime
    }
  }
}

/**
 * Real-time subscription to the project document in Firestore.
 */
export function subscribeToProject(
  projectId: string,
  onUpdate: (data: ProjectDocument | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  if (!projectId) {
    throw new Error('[FAIL FAST] Mandatory projectId missing in subscribeToProject.');
  }

  const docRef = doc(db, 'projects', projectId);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as ProjectDocument);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      onError(err);
    }
  );
}

/**
 * Real-time subscription to the project chat messages subcollection.
 */
export function subscribeToMessages(
  projectId: string,
  onUpdate: (messages: ChatMessage[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  if (!projectId) {
    throw new Error('[FAIL FAST] Mandatory projectId missing in subscribeToMessages.');
  }

  const messagesRef = collection(db, 'projects', projectId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages: ChatMessage[] = [];
      snapshot.forEach((d) => {
        messages.push(d.data() as ChatMessage);
      });
      onUpdate(messages);
    },
    (err) => {
      onError(err);
    }
  );
}

/**
 * One-off fetch of messages subcollection documents for a project.
 */
export async function fetchProjectMessages(projectId: string): Promise<ChatMessage[]> {
  if (!projectId) {
    throw new Error('[FAIL FAST] Mandatory projectId missing in fetchProjectMessages.');
  }

  const messagesRef = collection(db, 'projects', projectId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));
  const snapshot = await getDocs(q);

  const messages: ChatMessage[] = [];
  snapshot.forEach((d) => {
    messages.push(d.data() as ChatMessage);
  });
  return messages;
}

/**
 * Real-time subscription to unassigned inbox emails in Firestore.
 */
export function subscribeToInboxEmails(
  onUpdate: (emails: ProjectEmail[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const emailsRef = collection(db, 'emails');

  return onSnapshot(
    emailsRef,
    (snapshot) => {
      const emails: ProjectEmail[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (!data.projectId) {
          emails.push({
            id: d.id,
            resendId: data.resendId,
            direction: data.direction || 'inbound',
            from: data.from || '',
            to: data.to || '',
            subject: data.subject || '(No Subject)',
            body: data.body || data.content || '',
            timestamp: data.sentAt || data.createdAt || '',
            assignedAt: data.assignedAt,
            projectId: data.projectId,
          });
        }
      });
      // Sort newest first
      emails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(emails);
    },
    (err) => {
      onError(err);
    }
  );
}

/**
 * Real-time subscription to ALL emails in Firestore (for the Emails Hub).
 */
export function subscribeToAllEmails(
  onUpdate: (emails: ProjectEmail[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const emailsRef = collection(db, 'emails');

  return onSnapshot(
    emailsRef,
    (snapshot) => {
      const emails: ProjectEmail[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        emails.push({
          id: d.id,
          resendId: data.resendId,
          direction: data.direction || 'inbound',
          from: data.from || '',
          to: data.to || '',
          subject: data.subject || '(No Subject)',
          body: data.body || data.content || '',
          timestamp: data.sentAt || data.createdAt || '',
          assignedAt: data.assignedAt,
          projectId: data.projectId,
        });
      });
      // Sort newest first
      emails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(emails);
    },
    (err) => {
      onError(err);
    }
  );
}

/**
 * Fetch a list of recent projects from Firestore for project picker.
 */
export async function fetchRecentProjectsList(limitCount: number = 20): Promise<Array<{ id: string; title: string; status?: string }>> {
  try {
    const projectsRef = collection(db, 'projects');
    const q = query(projectsRef, limit(limitCount));
    const snapshot = await getDocs(q);
    const results: Array<{ id: string; title: string; status?: string }> = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      results.push({
        id: docSnap.id,
        title: data.title || docSnap.id,
        status: data.status,
      });
    });
    return results;
  } catch (err) {
    console.warn('Failed to fetch recent projects list:', err);
    return [];
  }
}


