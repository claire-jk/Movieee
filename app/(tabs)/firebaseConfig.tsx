// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDF1e3ixTCEeRdIVbRvFxoVCVMzDuLI2Q4",
  authDomain: "movie-2192d.firebaseapp.com",
  projectId: "movie-2192d",
  storageBucket: "movie-2192d.firebasestorage.app",
  messagingSenderId: "880317112721",
  appId: "1:880317112721:web:d2e4a28cdff4daced77a30",
  measurementId: "G-DERDWRXX45"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);