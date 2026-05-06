import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

// ── Replace these values with your Firebase project config ────
// See README.md for step-by-step instructions.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || "",
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL       || "",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || "",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || "",
};

let _app: FirebaseApp | null = null;
let _db: Database | null = null;

export function getFirebaseDb(): Database {
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  if (!_db) {
    _db = getDatabase(_app);
  }
  return _db;
}

export function isFirebaseConfigured(): boolean {
  return !!(firebaseConfig.apiKey && firebaseConfig.databaseURL);
}
