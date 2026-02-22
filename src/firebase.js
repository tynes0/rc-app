import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBPnoMHvWhl2_ODfN6WkwwW3UoxPvHDobg",
    authDomain: "rc-app-rc.firebaseapp.com",
    projectId: "rc-app-rc",
    storageBucket: "rc-app-rc.firebasestorage.app",
    messagingSenderId: "825665643392",
    appId: "1:825665643392:web:aaac36da3214c97c3ed765",
    measurementId: "G-6VRLS5974Y"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const storage = getStorage(app);
export const db = getFirestore(app);
export const auth = getAuth(app);