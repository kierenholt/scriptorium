import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  collection,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { config } from '../config';
import { ProjectDocument, ChatMessage } from '../types';

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
