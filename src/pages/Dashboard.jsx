import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import "./Dashboard.css";

export default function Dashboard() {
    const navigate = useNavigate();
    const currentUser = localStorage.getItem("currentUser") || "Bilinmiyor";

    const [notes, setNotes] = useState([]);
    const [countdowns, setCountdowns] = useState([]);

    const [currentTime, setCurrentTime] = useState(Date.now());

    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [editingNote, setEditingNote] = useState(null);
    const [noteContent, setNoteContent] = useState("");
    const [noteColor, setNoteColor] = useState("#fef08a");

    const [isCountdownModalOpen, setIsCountdownModalOpen] = useState(false);
    const [editingCountdown, setEditingCountdown] = useState(null);
    const [cdTitle, setCdTitle] = useState("");

    const [cdDate, setCdDate] = useState("");
    const [cdTime, setCdTime] = useState("00:00");

    const [itemToDelete, setItemToDelete] = useState(null);

    const todayString = new Date().toISOString().split("T")[0];

    const [canvasPixels, setCanvasPixels] = useState(Array(576).fill(""));

    useEffect(() => {
        const unsubNotes = onSnapshot(collection(db, "notes"), (snapshot) => {
            setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        const unsubCountdowns = onSnapshot(collection(db, "countdowns"), (snapshot) => {
            setCountdowns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubCanvas = onSnapshot(doc(db, "canvas", "shared"), (docSnap) => {
            if (docSnap.exists()) {
                setCanvasPixels(docSnap.data().pixels);
            }
        });
        
        const timer = setInterval(() => setCurrentTime(Date.now()), 1000);

        return () => {
            unsubNotes();
            unsubCountdowns();
            unsubCanvas();
            clearInterval(timer);
        };
    }, []);

    const getTimeLeft = (targetDate) => {
        const target = new Date(targetDate).getTime();
        const diff = target - currentTime;

        if (diff <= 0) return { passed: true, days: 0, hours: 0, minutes: 0, seconds: 0 };

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);

        return { passed: false, days, hours, minutes, seconds };
    };

    const handleSaveNote = async (e) => {
        e.preventDefault();
        if (!noteContent.trim()) return;
        try {
            if (editingNote) {
                await updateDoc(doc(db, "notes", editingNote.id), { content: noteContent, color: noteColor });
            } else {
                await addDoc(collection(db, "notes"), { content: noteContent, color: noteColor, addedBy: currentUser, createdAt: Date.now() });
            }
            closeNoteModal();
        } catch (error) { console.error("Not kaydedilemedi:", error); }
    };

    const openNoteModal = (note = null) => {
        if (note) {
            setEditingNote(note); setNoteContent(note.content); setNoteColor(note.color);
        } else {
            setEditingNote(null); setNoteContent(""); setNoteColor("#fef08a");
        }
        setIsNoteModalOpen(true);
    };

    const closeNoteModal = () => { setIsNoteModalOpen(false); setEditingNote(null); setNoteContent(""); };

    const handleSaveCountdown = async (e) => {
        e.preventDefault();
        if (!cdTitle.trim() || !cdDate) return;
        try {
            const combinedDateTime = `${cdDate}T${cdTime}`;
            if (editingCountdown) {
                await updateDoc(doc(db, "countdowns", editingCountdown.id), { title: cdTitle, date: combinedDateTime });
            } else {
                await addDoc(collection(db, "countdowns"), { title: cdTitle, date: combinedDateTime, addedBy: currentUser, createdAt: Date.now() });
            }
            closeCountdownModal();
        } catch (error) { console.error("Geri sayım kaydedilemedi:", error); }
    };

    const openCountdownModal = (cd = null) => {
        if (cd) {
            setEditingCountdown(cd);
            setCdTitle(cd.title);
            if(cd.date && cd.date.includes("T")) {
                setCdDate(cd.date.split("T")[0]);
                setCdTime(cd.date.split("T")[1]);
            } else {
                setCdDate(cd.date);
                setCdTime("00:00");
            }
        } else {
            setEditingCountdown(null);
            setCdTitle("");
            setCdDate("");
            setCdTime("00:00");
        }
        setIsCountdownModalOpen(true);
    };

    const closeCountdownModal = () => { setIsCountdownModalOpen(false); setEditingCountdown(null); setCdTitle(""); setCdDate(""); setCdTime("00:00"); };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await deleteDoc(doc(db, itemToDelete.collection, itemToDelete.id));
            setItemToDelete(null);
        } catch (error) { console.error("Silinemedi:", error); }
    };

    const menuItems = [
        { title: "Yapılacaklar", path: "/app/todos", icon: "fa-list-check", desc: "Ortak planları yönet.", color: "#8b5cf6" },
        { title: "Dizi-Film Ara", path: "/app/search-media", icon: "fa-magnifying-glass", desc: "İstediğin dizi-filmi listeye veya dizi-film tinderına ekle.", color: "#3b82f6" },
        { title: "Galeri", path: "/app/gallery", icon: "fa-images", desc: "Resimler ve videolar.", color: "#ec4899" },
        { title: "Dizi-Film Tinder", path: "/app/pool", icon: "fa-fire", desc: "Listeye eklemeyi onayla yada reddet.", color: "#ef4444" },
        { title: "Filmler", path: "/app/movies", icon: "fa-film", desc: "İzlenecek ve izlenmiş filmler.", color: "#10b981" },
        { title: "Diziler", path: "/app/series", icon: "fa-tv", desc: "Takip edilen diziler.", color: "#f59e0b" },
        { title: "Anı Haritası", path: "/app/memory-map", icon: "fa-map-location-dot", desc: "Gittiğimiz yerleri işaretle.", color: "#14b8a6" },
        { title: "Not Defteri", path: "/app/diary", icon: "fa-book-open", desc: "Notlar.", color: "#8badf9" },
        { title: "Masallar", path: "/app/tales", icon: "fa-book-open-reader", desc: "Masallar.", color: "#72fa12" }
    ];

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h1>👋 Hoş Geldin, <span style={{ textTransform: "capitalize", color: "var(--accent-color)" }}>{currentUser}</span>!</h1>
            </div>

            <div className="dashboard-section">
                <div className="section-title-bar">
                    <h3>📌 Post-It Notları</h3>
                    <button className="add-mini-btn" onClick={() => openNoteModal()}><i className="fa-solid fa-plus"></i> Not Bırak</button>
                </div>
                <div className="notes-grid">
                    {notes.length === 0 ? <p className="empty-text">Henüz hiç not bırakılmamış...</p> : notes.map(note => (
                        <div key={note.id} className="sticky-note" style={{ backgroundColor: note.color }}>
                            <div className="pin"></div>
                            <p className="note-content">{note.content}</p>
                            <div className="note-footer">
                                <span className="note-author">- {note.addedBy}</span>
                                <div className="note-actions">
                                    <button onClick={() => openNoteModal(note)}><i className="fa-solid fa-pen"></i></button>
                                    <button onClick={() => setItemToDelete({ collection: 'notes', id: note.id })}><i className="fa-solid fa-trash-can"></i></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* YENİ: MİNİ KANVAS WIDGET'I */}
            <div className="dashboard-section mini-canvas-section" onClick={() => navigate("/app/canvas")}>
                <div className="section-title-bar">
                    <h3>🎨 Piksel Tablosu</h3>
                    <button className="add-mini-btn"><i className="fa-solid fa-arrow-up-right-from-square"></i> Çizime Git</button>
                </div>
                <div className="mini-canvas-wrapper">
                    <div className="mini-canvas-board">
                        {canvasPixels.map((color, index) => (
                            <div
                                key={index}
                                className="mini-pixel"
                                style={{ backgroundColor: color || "transparent" }}
                            />
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="dashboard-section">
                <div className="section-title-bar">
                    <h3>⏳ Geri Sayımlar</h3>
                    <button className="add-mini-btn" onClick={() => openCountdownModal()}><i className="fa-solid fa-plus"></i> Ekle</button>
                </div>
                <div className="countdown-grid">
                    {countdowns.length === 0 ? <p className="empty-text">Beklenen bir özel gün yok...</p> : countdowns.map(cd => {
                        const timeLeft = getTimeLeft(cd.date);
                        const formattedDate = new Date(cd.date).toLocaleString('tr-TR', {
                            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        });

                        return (
                            <div key={cd.id} className={`countdown-card ${timeLeft.passed ? 'passed' : ''}`}>
                                <div className="cd-info">
                                    <h4 className="cd-title">{cd.title}</h4>
                                    <span className="cd-date"><i className="fa-regular fa-calendar"></i> {formattedDate}</span>
                                </div>
                                <div className="cd-days">
                                    {timeLeft.passed ? (
                                        <span className="cd-passed">Zamanı Geldi / Geçti 🎉</span>
                                    ) : (
                                        <div className="cd-timer">
                                            {timeLeft.days > 0 && (
                                                <div className="cd-time-box">
                                                    <span className="cd-number">{timeLeft.days}</span>
                                                    <span className="cd-label">Gün</span>
                                                </div>
                                            )}
                                            <div className="cd-time-box">
                                                <span className="cd-number">{timeLeft.hours}</span>
                                                <span className="cd-label">Saat</span>
                                            </div>
                                            <div className="cd-time-box">
                                                <span className="cd-number">{timeLeft.minutes}</span>
                                                <span className="cd-label">Dk</span>
                                            </div>
                                            <div className="cd-time-box">
                                                <span className="cd-number">{timeLeft.seconds}</span>
                                                <span className="cd-label">Sn</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="cd-actions">
                                    <button onClick={() => openCountdownModal(cd)}><i className="fa-solid fa-pen"></i></button>
                                    <button onClick={() => setItemToDelete({ collection: 'countdowns', id: cd.id })}><i className="fa-solid fa-trash-can"></i></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="dashboard-section" style={{marginTop: "40px"}}>
                <h3 style={{marginBottom: "15px", color: "var(--text-main)"}}>Hızlı Menü</h3>
                <div className="dashboard-grid">
                    {menuItems.map((item, index) => (
                        <div key={index} className="dashboard-card" onClick={() => navigate(item.path)}>
                            <div className="dashboard-icon" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                                <i className={`fa-solid ${item.icon}`}></i>
                            </div>
                            <h3>{item.title}</h3>
                            <p>{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {isNoteModalOpen && (
                <div className="modal-overlay" onClick={closeNoteModal}>
                    <div className="add-todo-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="close-modal-btn" onClick={closeNoteModal}><i className="fa-solid fa-xmark"></i></button>
                        <div className="add-todo-header"><h3>{editingNote ? "Notu Düzenle" : "Yeni Not Bırak"}</h3></div>
                        <form onSubmit={handleSaveNote} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <textarea className="add-todo-input add-todo-textarea" placeholder="Mesajın..." value={noteContent} onChange={(e) => setNoteContent(e.target.value)} required />
                            <div>
                                <label style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Kağıt Rengi</label>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                                    {[
                                        '#fef08a', // soft yellow
                                        '#fbcfe8', // pink
                                        '#bfdbfe', // light blue
                                        '#bbf7d0', // mint green
                                        '#fecaca', // soft red
                                        '#fde68a', // warm yellow
                                        '#ddd6fe', // lavender
                                        '#c7d2fe', // periwinkle
                                        '#cffafe', // cyan pastel
                                        '#e9d5ff'  // light purple
                                    ].map(color => (
                                        <div key={color} onClick={() => setNoteColor(color)} style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: color, border: noteColor === color ? '3px solid var(--text-main)' : '2px solid transparent', cursor: 'pointer' }}></div>
                                    ))}
                                </div>
                            </div>
                            <button type="submit" className="add-todo-submit"><i className="fa-solid fa-check"></i> Kaydet</button>
                        </form>
                    </div>
                </div>
            )}

            {isCountdownModalOpen && (
                <div className="modal-overlay" onClick={closeCountdownModal}>
                    <div className="add-todo-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="close-modal-btn" onClick={closeCountdownModal}><i className="fa-solid fa-xmark"></i></button>
                        <div className="add-todo-header"><h3>{editingCountdown ? "Geri Sayımı Düzenle" : "Yeni Geri Sayım"}</h3></div>
                        <form onSubmit={handleSaveCountdown} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input type="text" className="add-todo-input" placeholder="Etkinlik Adı (Örn: Uçuşumuz)" value={cdTitle} onChange={(e) => setCdTitle(e.target.value)} required />

                            <div className="add-todo-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div>
                                    <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "block", marginBottom: "5px" }}>Tarih</label>
                                    <input
                                        type="date"
                                        className="add-todo-input"
                                        value={cdDate}
                                        min={todayString}
                                        onChange={(e) => setCdDate(e.target.value)}
                                        required
                                        style={{width: "100%", boxSizing: "border-box", margin: 0}}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "block", marginBottom: "5px" }}>Saat (Manuel)</label>
                                    <input
                                        type="text" /* YENİ: type="time" yerine text yaptık, manuel giriş */
                                        className="add-todo-input"
                                        placeholder="15:30"
                                        maxLength="5" /* 5 karakter sınırı (HH:MM) */
                                        value={cdTime}
                                        onChange={(e) => {
                                            // Sadece rakam ve iki nokta işaretine izin ver
                                            const val = e.target.value.replace(/[^0-9:]/g, '');
                                            setCdTime(val);
                                        }}
                                        required
                                        style={{width: "100%", boxSizing: "border-box", margin: 0}}
                                    />
                                </div>
                            </div>

                            <button type="submit" className="add-todo-submit" style={{marginTop: "5px"}}><i className="fa-solid fa-check"></i> Kaydet</button>
                        </form>
                    </div>
                </div>
            )}

            {itemToDelete && (
                <div className="confirm-overlay" onClick={() => setItemToDelete(null)}>
                    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
                        <h3>Emin misin?</h3>
                        <p>Bu öğeyi kalıcı olarak silmek istediğine emin misin?</p>
                        <div className="confirm-actions">
                            <button className="confirm-btn confirm-cancel" onClick={() => setItemToDelete(null)}>İptal</button>
                            <button className="confirm-btn confirm-delete" onClick={confirmDelete}>Evet, Sil</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}