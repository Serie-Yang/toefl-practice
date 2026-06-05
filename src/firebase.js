import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCses5trleoxayt4NntyAhOjyqxehoGybM",
  authDomain: "toefl-30c2e.firebaseapp.com",
  projectId: "toefl-30c2e",
  storageBucket: "toefl-30c2e.firebasestorage.app",
  messagingSenderId: "121060177820",
  appId: "1:121060177820:web:2ab17c36b583c27f327a59",
  measurementId: "G-0F1KJN549Y"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);