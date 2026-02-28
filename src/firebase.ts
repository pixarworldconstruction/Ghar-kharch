import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBnK92_DGWWQpV3qmxyBIoCPe8cmr-oTF0",
  authDomain: "gharkharch-2a492.firebaseapp.com",
  databaseURL: "https://gharkharch-2a492-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "gharkharch-2a492",
  storageBucket: "gharkharch-2a492.firebasestorage.app",
  messagingSenderId: "1047200163173",
  appId: "1:1047200163173:web:afbf4f82220e63a668ed8c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
export const db = getDatabase(app);
export const auth = getAuth(app);
