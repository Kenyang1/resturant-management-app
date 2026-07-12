/**
 * Firebase initialization for email/password authentication only.
 * These keys identify your Firebase project in the client; protect data with Firebase rules and Supabase RLS.
 */
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDaLsvqMoZy3hgOx8ydjI0RrtrJkRW0fGE",
  authDomain: "cs360-mobile-project.firebaseapp.com",
  projectId: "cs360-mobile-project",
  storageBucket: "cs360-mobile-project.firebasestorage.app",
  messagingSenderId: "1044279383603",
  appId: "1:1044279383603:web:33d1a06566ae65408b3546",
  measurementId: "G-VL6GB0KYTH"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };
