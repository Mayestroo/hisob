/**
 * Firebase Configuration
 * Phase 0 — Foundation
 *
 * Yangi Firebase project yaratilgandan keyin .env.local ga
 * quyidagi o'zgaruvchilarni qo'ying:
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_AUTH_DOMAIN
 *   VITE_FIREBASE_DATABASE_URL
 *   VITE_FIREBASE_PROJECT_ID
 *   VITE_FIREBASE_STORAGE_BUCKET
 *   VITE_FIREBASE_MESSAGING_SENDER_ID
 *   VITE_FIREBASE_APP_ID
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: (env.VITE_FIREBASE_API_KEY as string) || '',
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN as string) || '',
  databaseURL: (env.VITE_FIREBASE_DATABASE_URL as string) || '',
  projectId: (env.VITE_FIREBASE_PROJECT_ID as string) || '',
  storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET as string) || '',
  messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || '',
  appId: (env.VITE_FIREBASE_APP_ID as string) || ''
};

export const IS_FIREBASE_CONFIGURED = Boolean(
  firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId
);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Database | null = null;

function getApp(): FirebaseApp | null {
  if (!IS_FIREBASE_CONFIGURED) {
    return null;
  }
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
  } else {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth(): Auth | null {
  if (authInstance) return authInstance;
  const a = getApp();
  if (!a) return null;
  authInstance = getAuth(a);
  return authInstance;
}

export function getFirebaseDB(): Database | null {
  if (dbInstance) return dbInstance;
  const a = getApp();
  if (!a) return null;
  dbInstance = getDatabase(a);
  return dbInstance;
}

export const APP_VERSION =
  (env.VITE_APP_VERSION as string) || '1.5.0';

export const ENABLE_FIREBASE_SYNC =
  (env.VITE_ENABLE_FIREBASE_SYNC as string) === 'true' && IS_FIREBASE_CONFIGURED;
