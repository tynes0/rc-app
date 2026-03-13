import { useState } from "react";
import "./Login.css";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useEffect } from "react";
export default function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    useEffect(() => {
        const savedTheme = localStorage.getItem("theme") || "dark";

        if (savedTheme === "dark") {
            document.body.classList.remove("light-theme");
        } else {
            document.body.classList.add("light-theme");
        }

        if (!localStorage.getItem("theme")) {
            localStorage.setItem("theme", "dark");
        }
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();

        const cleanUsername = username.toLowerCase().trim();

        const dummyEmail = `${cleanUsername}@app.com`;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, dummyEmail, password);

            localStorage.setItem("currentUser", cleanUsername);

            window.location.href = "/app/movies";
        } catch (error) {
            console.error("Giriş hatası:", error.code);
            alert("Kullanıcı adı veya şifre hatalı!");
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h1>❤️ RC</h1>
                <p>Devam etmek için giriş yapmalısın.</p>

                <form className="login-form" onSubmit={handleLogin}>
                    <input
                        type="text"
                        placeholder="Kullanıcı Adı"
                        className="login-input"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Şifre"
                        className="login-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <button type="submit" className="login-btn">Giriş Yap</button>
                </form>
            </div>
        </div>
    );
}