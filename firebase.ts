import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const hasRequiredConfig = Object.values(firebaseConfig).every(Boolean);

const app = hasRequiredConfig
  ? firebase.apps.length > 0
    ? firebase.app()
    : firebase.initializeApp(firebaseConfig)
  : null;

const auth = app ? firebase.auth() : null;
const db = app ? firebase.firestore() : null;

export { app, auth, db, firebaseConfig, hasRequiredConfig };