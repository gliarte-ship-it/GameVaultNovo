import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp,
  FieldValue,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface GameFirebase {
  id: string;
  ownerId: string;
  title: string;
  platform: string;
  status: 'Jogando' | 'Pendente' | 'Zerado' | 'Abandonado';
  rating: number;
  image?: string;
  description?: string;
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}

const COLLECTION_NAME = 'games';

export const firebaseService = {
  async getGames() {
    if (!auth.currentUser) throw new Error("User must be authenticated");
    
    const path = COLLECTION_NAME;
    try {
      const q = query(
        collection(db, path), 
        where('ownerId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as GameFirebase[];
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return []; // Never reached due to throw
    }
  },

  subscribeToGames(callback: (games: GameFirebase[]) => void) {
    if (!auth.currentUser) return () => {};
    
    const path = COLLECTION_NAME;
    const q = query(
      collection(db, path), 
      where('ownerId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const games = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as GameFirebase[];
      callback(games);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  async addGame(game: Omit<GameFirebase, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!auth.currentUser) throw new Error("User must be authenticated");
    
    const path = COLLECTION_NAME;
    try {
      const docRef = await addDoc(collection(db, path), {
        ...game,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      return ""; // Never reached
    }
  },

  async updateGame(id: string, updates: Partial<GameFirebase>) {
    const path = `${COLLECTION_NAME}/${id}`;
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteGame(id: string) {
    const path = `${COLLECTION_NAME}/${id}`;
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
};
