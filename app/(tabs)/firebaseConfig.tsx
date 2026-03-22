// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDF1e3ixTCEeRdIVbRvFxoVCVMzDuLI2Q4",
  authDomain: "movie-2192d.firebaseapp.com",
  projectId: "movie-2192d",
  storageBucket: "movie-2192d.firebasestorage.app",
  messagingSenderId: "880317112721",
  appId: "1:880317112721:web:d2e4a28cdff4daced77a30",
  measurementId: "G-DERDWRXX45"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);