import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const {
  VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID,
} = import.meta.env;

/**
 * Firebase é opcional — quando as variáveis de ambiente não estão configuradas
 * (ex.: deploy no GitHub Pages sem .env), a aplicação funciona sem autenticação.
 */
export const isFirebaseConfigured =
  !!VITE_FIREBASE_API_KEY &&
  !!VITE_FIREBASE_PROJECT_ID &&
  !!VITE_FIREBASE_APP_ID;

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;

if (isFirebaseConfigured) {
  app = initializeApp({
    apiKey:            VITE_FIREBASE_API_KEY,
    authDomain:        VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         VITE_FIREBASE_PROJECT_ID,
    storageBucket:     VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             VITE_FIREBASE_APP_ID,
  });
  authInstance = getAuth(app);
}

export const auth = authInstance;
