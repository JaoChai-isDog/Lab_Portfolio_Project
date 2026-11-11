// นำเข้าฟังก์ชันของ Firebase จาก CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Config ของคุณ
const firebaseConfig = {
    apiKey: "AIzaSyBt91pvqrrH72tl9mkzn6B-5qcOG-BX3ag",
    authDomain: "lab-portfolio-32c73.firebaseapp.com",
    projectId: "lab-portfolio-32c73",
    storageBucket: "lab-portfolio-32c73.firebasestorage.app",
    messagingSenderId: "1019962071407",
    appId: "1:1019962071407:web:679dbb1c4bf2831cff709a",
    measurementId: "G-5QQ1FQ9WBQ"
};

// เริ่มต้นการเชื่อมต่อ
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ส่งออกตัวแปรและฟังก์ชันเพื่อนำไปใช้ใน app.js
export { auth, db, signInWithEmailAndPassword, onAuthStateChanged, signOut, collection, doc, setDoc, getDoc, getDocs };