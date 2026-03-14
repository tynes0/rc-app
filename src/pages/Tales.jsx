import { useState, useEffect, useRef } from "react";
// DÜZELTME: updateDoc eklendi
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc, query, orderBy } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import Modal from "../components/Modal";
import CustomVideoPlayer from "../components/CustomVideoPlayer";
import "./Tales.css";

// --- WHATSAPP TARZI SES OYNATICISI ---
const CustomAudioPlayer = ({ src }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState("0:00");
    const [duration, setDuration] = useState("0:00");

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const togglePlay = (e) => {
        e.stopPropagation();
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play().then(() => setIsPlaying(true)).catch(e => console.warn("Ses oynatılamadı:", e));
        }
    };

    const handleTimeUpdate = () => {
        const cur = audioRef.current.currentTime;
        const dur = audioRef.current.duration;
        if (dur > 0) setProgress((cur / dur) * 100);
        setCurrentTime(formatTime(cur));
    };

    const handleLoadedData = () => {
        setDuration(formatTime(audioRef.current.duration));
    };

    const handleProgressClick = (e) => {
        e.stopPropagation();
        const bar = e.currentTarget;
        const clickPos = (e.nativeEvent.offsetX) / bar.offsetWidth;
        audioRef.current.currentTime = clickPos * audioRef.current.duration;
    };

    const waveBars = Array.from({ length: 30 }).map((_, i) => Math.floor(Math.random() * 60) + 20);

    return (
        <div className="whatsapp-audio-player" onClick={(e) => e.stopPropagation()}>
            <audio
                ref={audioRef}
                src={src}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedData}
                onEnded={() => setIsPlaying(false)}
                preload="metadata"
            />

            <button className="audio-play-btn" onClick={togglePlay}>
                <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
            </button>

            <div className="audio-wave-container" onClick={handleProgressClick}>
                <div className={`audio-wave-bars ${isPlaying ? 'playing' : ''}`}>
                    {waveBars.map((h, i) => (
                        <div key={i} className="wave-bar" style={{ height: `${h}%` }}></div>
                    ))}
                </div>
                <div className="audio-progress-bar">
                    <div className="audio-progress-fill" style={{ width: `${progress}%` }}>
                        <div className="audio-progress-knob"></div>
                    </div>
                </div>
            </div>

            <div className="audio-time-info">
                <span>{isPlaying ? currentTime : duration}</span>
            </div>
        </div>
    );
};

export default function Tales() {
    const [tales, setTales] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedTale, setSelectedTale] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);

    // YENİ: Düzenleme modu state'i
    const [editingTale, setEditingTale] = useState(null);

    const [title, setTitle] = useState("");
    const [type, setType] = useState("text");
    const [content, setContent] = useState("");
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const currentUser = localStorage.getItem("currentUser") || "Bilinmiyor";

    useEffect(() => {
        const q = query(collection(db, "tales"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snapshot) => {
            setTales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleSaveTale = async (e) => {
        e.preventDefault();
        setIsUploading(true);

        try {
            // YENİ: Eğer bir masalı düzenliyorsak sadece updateDoc çalışır
            if (editingTale) {
                await updateDoc(doc(db, "tales", editingTale.id), {
                    title,
                    content
                });
                closeForm();
                return; // Düzenleme bitince fonksiyondan çık
            }

            // Yeni ekleme işlemleri
            setUploadProgress(1);
            let fileUrl = "";
            if (file && (type === "audio" || type === "video")) {
                const storageRef = ref(storage, `tales/${Date.now()}_${file.name}`);
                const uploadTask = uploadBytesResumable(storageRef, file);

                await new Promise((resolve, reject) => {
                    uploadTask.on("state_changed",
                        (snapshot) => setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
                        (error) => reject(error),
                        async () => {
                            fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
                            resolve();
                        }
                    );
                });
            }

            await addDoc(collection(db, "tales"), {
                title,
                type,
                content: type === "text" ? content : "",
                fileUrl: fileUrl || "",
                addedBy: currentUser,
                createdAt: Date.now()
            });

            closeForm();
        } catch (error) {
            console.error("Masal kaydedilemedi:", error);
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    // YENİ: Düzenleme formunu açan fonksiyon
    const openEditForm = (e, tale) => {
        e.stopPropagation();
        setEditingTale(tale);
        setTitle(tale.title);
        setType("text"); // Sadece text düzenlenmesine izin veriyoruz
        setContent(tale.content);
        setIsFormOpen(true);
    };

    const closeForm = () => {
        setIsFormOpen(false);
        setEditingTale(null);
        setTitle(""); setContent(""); setType("text"); setFile(null);
    };

    const confirmDelete = async () => {
        if (itemToDelete) {
            try {
                await deleteDoc(doc(db, "tales", itemToDelete));
                setItemToDelete(null);
                setSelectedTale(null);
            } catch (error) { console.error("Silinemedi:", error); }
        }
    };

    return (
        <div className="tales-container">
            <div className="todo-header">
                <h2>📖 Masallar</h2>
                <p>Sesli, yazılı ve videolu masallar...</p>
            </div>

            {loading ? (
                <div style={{ textAlign: "center", padding: "50px", color: "var(--accent-color)" }}>
                    <i className="fa-solid fa-spinner fa-spin fa-2x"></i>
                </div>
            ) : tales.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>
                    <i className="fa-solid fa-book-open-reader" style={{ fontSize: "3rem", marginBottom: "15px", opacity: 0.5 }}></i>
                    <p>Burada henüz bir masal yok. İlk hikayeyi sen anlat!</p>
                </div>
            ) : (
                <div className="tales-grid">
                    {tales.map(tale => (
                        <div key={tale.id} className={`tale-card cute-${tale.type}`} onClick={() => setSelectedTale(tale)}>
                            {/* Yan kısımdaki tatlı renk şeridi CSS'ten gelecek */}
                            <div className="tale-card-inner">
                                <div className={`tale-icon ${tale.type}`}>
                                    {tale.type === "text" ? <i className="fa-solid fa-pen-fancy"></i> :
                                        tale.type === "audio" ? <i className="fa-solid fa-microphone-lines"></i> :
                                            <i className="fa-solid fa-clapperboard"></i>}
                                </div>
                                <div className="tale-card-info">
                                    <h3>{tale.title}</h3>
                                    <div className="tale-card-meta">
                                        <span><i className="fa-regular fa-calendar-check"></i> {new Date(tale.createdAt).toLocaleDateString('tr-TR')}</span>
                                        <span style={{textTransform: 'capitalize'}}><i className="fa-solid fa-feather-pointed"></i> {tale.addedBy}</span>
                                    </div>
                                </div>
                            </div>

                            {/* YENİ: Butonları bir kapsayıcıya aldık, artık taşma yapmaz */}
                            <div className="tale-card-actions">
                                {tale.type === "text" && (
                                    <button className="tale-action-btn edit-btn" onClick={(e) => openEditForm(e, tale)} title="Düzenle">
                                        <i className="fa-solid fa-pen"></i>
                                    </button>
                                )}
                                <button className="tale-action-btn delete-btn" onClick={(e) => { e.stopPropagation(); setItemToDelete(tale.id); }} title="Sil">
                                    <i className="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <button className="fab-add-btn" onClick={() => setIsFormOpen(true)} title="Yeni Masal Ekle"><i className="fa-solid fa-plus"></i></button>

            {selectedTale && (
                <div className="modal-overlay" onClick={() => setSelectedTale(null)}>
                    <div className="tale-view-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="close-modal-btn" onClick={() => setSelectedTale(null)}><i className="fa-solid fa-xmark"></i></button>

                        <div className="tale-view-header">
                            <span className={`tale-badge ${selectedTale.type}`}>
                                {selectedTale.type === "text" ? "Yazılı Masal" : selectedTale.type === "audio" ? "Sesli Anlatı" : "Video Masal"}
                            </span>
                            <h2>{selectedTale.title}</h2>
                            <p className="tale-author">- {selectedTale.addedBy} tarafından eklendi</p>
                        </div>

                        <div className="tale-content-area">
                            {selectedTale.type === "text" && (
                                <div className="tale-text-content">
                                    {selectedTale.content.split('\n').map((p, i) => <p key={i}>{p}</p>)}
                                </div>
                            )}

                            {selectedTale.type === "audio" && (
                                <div className="tale-audio-container">
                                    <img src="/logo.png" alt="Plak" className="tale-audio-vinyl" />
                                    <CustomAudioPlayer src={selectedTale.fileUrl} />
                                </div>
                            )}

                            {selectedTale.type === "video" && (
                                <div className="tale-video-container">
                                    <CustomVideoPlayer src={selectedTale.fileUrl} className="tale-video-player" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isFormOpen && (
                <div className="modal-overlay" onClick={() => !isUploading && closeForm()}>
                    <div className="add-todo-modal" onClick={(e) => e.stopPropagation()}>
                        {!isUploading && <button className="close-modal-btn" onClick={closeForm}><i className="fa-solid fa-xmark"></i></button>}
                        <div className="add-todo-header">
                            <h3>{editingTale ? "Masalı Düzenle" : "Bir Masal Anlat"}</h3>
                            <p>{editingTale ? "Hikayende değişiklik yap." : "Yazarak, sesini kaydederek veya bir video ile..."}</p>
                        </div>

                        <form onSubmit={handleSaveTale} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input type="text" className="add-todo-input" placeholder="Masalın Başlığı *" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={isUploading} />

                            {/* Düzenleme modunda tür değiştirmeyi gizliyoruz */}
                            {!editingTale && (
                                <div className="tale-type-selector">
                                    <button type="button" className={type === "text" ? "active text" : ""} onClick={() => {setType("text"); setFile(null);}} disabled={isUploading}>
                                        <i className="fa-solid fa-pen-fancy"></i> Yazı
                                    </button>
                                    <button type="button" className={type === "audio" ? "active audio" : ""} onClick={() => setType("audio")} disabled={isUploading}>
                                        <i className="fa-solid fa-microphone-lines"></i> Ses
                                    </button>
                                    <button type="button" className={type === "video" ? "active video" : ""} onClick={() => setType("video")} disabled={isUploading}>
                                        <i className="fa-solid fa-video"></i> Video
                                    </button>
                                </div>
                            )}

                            {type === "text" ? (
                                <textarea className="add-todo-input add-todo-textarea" placeholder="Bir varmış, bir yokmuş..." value={content} onChange={(e) => setContent(e.target.value)} required disabled={isUploading} style={{minHeight: "150px"}} />
                            ) : (
                                <label className="tale-upload-box">
                                    <input
                                        type="file"
                                        accept={type === "audio" ? "audio/*,video/mp4" : "video/*"}
                                        style={{ display: "none" }}
                                        onChange={(e) => setFile(e.target.files[0])}
                                        required
                                        disabled={isUploading}
                                    />
                                    {file ? (
                                        <div className="file-selected">
                                            <i className={`fa-solid ${type === 'audio' ? 'fa-file-audio' : 'fa-file-video'}`}></i>
                                            <span>{file.name}</span>
                                        </div>
                                    ) : (
                                        <div className="file-placeholder">
                                            <i className="fa-solid fa-cloud-arrow-up"></i>
                                            <span>{type === "audio" ? "Ses (veya WhatsApp MP4) dosyasını" : "Video dosyasını"} seçmek için tıkla</span>
                                        </div>
                                    )}
                                </label>
                            )}

                            {isUploading ? (
                                <div style={{ textAlign: "center", color: "var(--text-main)", marginTop: "10px" }}>
                                    {!editingTale && (
                                        <div style={{ background: "var(--bg-color)", height: "8px", borderRadius: "4px", overflow: "hidden", marginBottom: "10px" }}>
                                            <div style={{ background: "var(--accent-color)", height: "100%", width: `${uploadProgress}%`, transition: "width 0.2s" }}></div>
                                        </div>
                                    )}
                                    <i className="fa-solid fa-spinner fa-spin"></i> Kaydediliyor... {(!editingTale && type !== "text") && `%${Math.round(uploadProgress)}`}
                                </div>
                            ) : (
                                <button type="submit" className="add-todo-submit" style={{marginTop: "5px"}}>
                                    <i className="fa-solid fa-wand-magic-sparkles"></i> {editingTale ? "Değişiklikleri Kaydet" : "Masalı Kaydet"}
                                </button>
                            )}
                        </form>
                    </div>
                </div>
            )}

            <Modal
                isOpen={!!itemToDelete}
                title="Masalı Sil"
                message="Bu masalı kalıcı olarak silmek istediğine emin misin?"
                onConfirm={confirmDelete}
                onCancel={() => setItemToDelete(null)}
            />
        </div>
    );
}