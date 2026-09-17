/**
 * Firebase Authentication Service
 * Phase 4 — Auth & User Management
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User,
  UserCredential
} from 'firebase/auth';
import { ENABLE_ANONYMOUS_FIREBASE_AUTH, getFirebaseAuth, IS_FIREBASE_CONFIGURED } from '../config/firebase';

export function isAuthAvailable(): boolean {
  return IS_FIREBASE_CONFIGURED && getFirebaseAuth() !== null;
}

export async function ensureAnonymousAuth(): Promise<User | null> {
  if (!ENABLE_ANONYMOUS_FIREBASE_AUTH) return null;

  const auth = getFirebaseAuth();
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;

  try {
    const cred = await signInAnonymously(auth);
    console.log('[FirebaseAuth] Development anonymous session enabled:', cred.user.uid);
    return cred.user;
  } catch (err) {
    console.warn('[FirebaseAuth] Development anonymous sign-in failed:', err);
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase Auth sozlanmagan. Iltimos, .env.local parametrlarini tekshiring.');
  }
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function signUp(email: string, password: string, displayName: string): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase Auth sozlanmagan.');
  }
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  return cred.user;
}

export async function signOutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
}

export function subscribeAuthState(callback: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  const auth = getFirebaseAuth();
  return auth ? auth.currentUser : null;
}
