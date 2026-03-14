import { NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "./Sidebar.css";

export default function Sidebar() {
    const [isOpen, setIsOpen] = useState(window.innerWidth > 768);
    const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
    const navigate = useNavigate();
    const currentUser = localStorage.getItem("currentUser") || "Bilinmiyor";

    const handleLogout = () => {
        localStorage.removeItem("currentUser");
        navigate("/login");
    };

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 768) setIsOpen(false);
            else setIsOpen(true);
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const toggleSidebar = () => setIsOpen(!isOpen);

    const closeMobile = () => {
        if (window.innerWidth <= 768) setIsOpen(false);
    };

    return (
        <>
            <button
                className={`mobile-menu-btn ${isOpen ? 'hidden' : ''}`}
                onClick={() => setIsOpen(true)}
            >
                <i className="fa-solid fa-bars"></i>
            </button>

            {isOpen && <div className="sidebar-overlay" onClick={closeMobile}></div>}

            <aside className={`sidebar ${isOpen ? "open" : "closed"}`}>
                <div className="sidebar-header">
                    <NavLink to="/app/dashboard" className="logo-text" style={{ fontSize: isOpen ? '2rem' : '1rem', textDecoration: 'none' }} onClick={closeMobile}>
                        {isOpen ? "🐼" : "🐼"}
                    </NavLink>
                    <button className="toggle-btn" onClick={toggleSidebar}>
                        <i className={`fa-solid ${isOpen ? 'fa-chevron-left' : 'fa-bars'}`}></i>
                    </button>
                </div>

                <nav className="sidebar-nav">
                    <NavLink to="/app/dashboard" className="nav-item" onClick={closeMobile}>
                        <i className="fa-solid fa-house"></i>
                        <span className="nav-text">Ana Menü</span>
                    </NavLink>
                    <NavLink to="/app/todos" className="nav-item" onClick={closeMobile}>
                        <i className="fa-solid fa-list-check"></i>
                        <span className="nav-text">Yapılacaklar</span>
                    </NavLink>
                    <NavLink to="/app/canvas" className="nav-item" onClick={closeMobile}>
                        <i className="fa-solid fa-palette"></i>
                        <span className="nav-text">Kanvas</span>
                    </NavLink>
                    <NavLink to="/app/search-media" className="nav-item" onClick={closeMobile}>
                        <i className="fa-solid fa-film"></i>
                        <span className="nav-text">Film - Dizi Ara</span>
                    </NavLink>
                    <NavLink to="/app/pool" className="nav-item" onClick={closeMobile}>
                        <i className="fa-solid fa-fire"></i>
                        <span className="nav-text">Dizi-Film Tinder</span>
                    </NavLink>
                    <NavLink to="/app/movies" className="nav-item" onClick={closeMobile}>
                        <i className="fa-solid fa-film"></i>
                        <span className="nav-text">Filmler</span>
                    </NavLink>
                    <NavLink to="/app/series" className="nav-item" onClick={closeMobile}>
                        <i className="fa-solid fa-tv"></i>
                        <span className="nav-text">Diziler</span>
                    </NavLink>
                    <NavLink to="/app/gallery" className="nav-item" onClick={closeMobile}>
                        <i className="fa-solid fa-image"></i>
                        <span className="nav-text">Galeri</span>
                    </NavLink>
                    <NavLink to="/app/memory-map" className="nav-item" onClick={closeMobile}>
                        <i className="fa-solid fa-map-location-dot"></i>
                        <span className="nav-text">Anı Haritası</span>
                    </NavLink>
                    <NavLink to="/app/diary" className="nav-item" onClick={closeMobile}>
                        <i className="fa-solid fa-book-open"></i>
                        <span className="nav-text">Not Defteri</span>
                    </NavLink>
                    <NavLink to="/app/tales" className="nav-item" onClick={closeMobile}>
                        <i className="fa-solid fa-book-open-reader"></i>
                        <span className="nav-text">Masallar</span>
                    </NavLink>
                </nav>

                <div style={{ marginTop: "auto", padding: "0 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {!isOpen ? null : (
                        <div style={{ textAlign: "center", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                            Aktif Kullanıcı: <b style={{color: "var(--text-main)", textTransform: "capitalize"}}>{currentUser}</b>
                        </div>
                    )}
                    <button onClick={handleLogout} className="quit-btn" style={{ margin: "0", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}>
                        <i className="fa-solid fa-right-from-bracket"></i>
                        <span className="nav-text">Çıkış Yap</span>
                    </button>
                </div>
            </aside>
        </>
    );
}