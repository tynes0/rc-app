import { useState, useEffect, useRef } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase";
import "./Gallery.css";
import "./Movies.css";

const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export default function Gallery() {
    const [photos, setPhotos] = useState([]);
    const [albumsMeta, setAlbumsMeta] = useState([]);

    const [activeView, setActiveView] = useState("Tümü");
    const [selectedAlbumView, setSelectedAlbumView] = useState(null);

    const [viewMode, setViewMode] = useState("grid");
    const [sliderIndex, setSliderIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [selectedAlbumForm, setSelectedAlbumForm] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [editingAlbum, setEditingAlbum] = useState({});

    const [photoNote, setPhotoNote] = useState("");
    const [photoDate, setPhotoDate] = useState("");
    const [newAlbumName, setNewAlbumName] = useState("");

    // YENİ: Artık resim objesini değil, index'ini (sırasını) tutuyoruz
    const [lightboxIndex, setLightboxIndex] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);

    const currentUser = localStorage.getItem("currentUser") || "Bilinmiyor";

    const touchStartX = useRef(0);
    const touchEndX = useRef(0);

    const CustomVideoPlayer = ({ src, className }) => {
        const wrapperRef = useRef(null); // YENİ: Kutuyu tam ekran yapmak için referans
        const videoRef = useRef(null);

        const [isPlaying, setIsPlaying] = useState(false);
        const [progress, setProgress] = useState(0);
        const [currentTime, setCurrentTime] = useState("0:00");
        const [duration, setDuration] = useState("0:00");
        const [volume, setVolume] = useState(1);
        const [isMuted, setIsMuted] = useState(false);

        const [isFullscreen, setIsFullscreen] = useState(false); // YENİ: Tam ekran state'i

        // ESC tuşu ile çıkılırsa ikonun değişmesi için tarayıcıyı dinliyoruz
        useEffect(() => {
            const handleFullscreenChange = () => {
                setIsFullscreen(!!document.fullscreenElement);
            };
            document.addEventListener('fullscreenchange', handleFullscreenChange);
            return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
        }, []);

        useEffect(() => {
            if (videoRef.current) {
                videoRef.current.volume = volume;
                videoRef.current.muted = isMuted;
            }
        }, [volume, isMuted]);

        const togglePlay = (e) => {
            e.stopPropagation();
            if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); }
            else { videoRef.current.pause(); setIsPlaying(false); }
        };

        const toggleMute = (e) => { e.stopPropagation(); setIsMuted(!isMuted); };

        const handleVolumeChange = (e) => {
            e.stopPropagation(); const newVolume = parseFloat(e.target.value);
            setVolume(newVolume); setIsMuted(newVolume === 0);
        };

        const handleTimeUpdate = () => {
            const current = videoRef.current.currentTime; const dur = videoRef.current.duration;
            if (dur > 0) setProgress((current / dur) * 100);
            setCurrentTime(formatDuration(current));
        };

        const handleLoadedData = () => {
            setDuration(formatDuration(videoRef.current.duration));
            if (videoRef.current.autoplay) setIsPlaying(true);
        };

        const handleProgressClick = (e) => {
            e.stopPropagation(); const bar = e.currentTarget;
            const clickPos = (e.pageX - bar.getBoundingClientRect().left) / bar.offsetWidth;
            videoRef.current.currentTime = clickPos * videoRef.current.duration;
        };

        const toggleFullscreen = async (e) => {
            e.stopPropagation();
            if (!document.fullscreenElement) {
                // Tam ekrana geç
                if (wrapperRef.current.requestFullscreen) {
                    await wrapperRef.current.requestFullscreen();
                } else if (wrapperRef.current.webkitRequestFullscreen) { // Safari desteği
                    await wrapperRef.current.webkitRequestFullscreen();
                }
            } else {
                // Tam ekrandan çık
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if (document.webkitExitFullscreen) { // Safari desteği
                    await document.webkitExitFullscreen();
                }
            }
        };

        return (
            <div ref={wrapperRef} className={`custom-video-wrapper ${className}`} onClick={togglePlay}>
                <video ref={videoRef} src={src} className="custom-video" onTimeUpdate={handleTimeUpdate} onLoadedData={handleLoadedData} onEnded={() => setIsPlaying(false)} playsInline />
                {!isPlaying && <div className="video-overlay-play"><i className="fa-solid fa-play"></i></div>}

                <div className="custom-video-controls" onClick={(e) => e.stopPropagation()}>
                    <button onClick={togglePlay}><i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i></button>

                    <div className="video-volume-container">
                        <button onClick={toggleMute}><i className={`fa-solid ${isMuted || volume === 0 ? 'fa-volume-xmark' : volume < 0.5 ? 'fa-volume-low' : 'fa-volume-high'}`}></i></button>
                        <div className="video-volume-slider">
                            <input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={handleVolumeChange} className="volume-range" orient="vertical" />
                        </div>
                    </div>

                    <span className="video-time">{currentTime}</span>
                    <div className="video-progress-bar" onClick={handleProgressClick}>
                        <div className="video-progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                    <span className="video-time">{duration}</span>

                    {/* YENİ: TAM EKRAN BUTONU */}
                    <button onClick={toggleFullscreen} title={isFullscreen ? "Küçült" : "Tam Ekran"} style={{ marginLeft: "5px" }}>
                        <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
                    </button>
                </div>
            </div>
        );
    };

    useEffect(() => {
        const qPhotos = query(collection(db, "gallery"), orderBy("createdAt", "desc"));
        const unsubPhotos = onSnapshot(qPhotos, (snapshot) => { setPhotos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLoading(false); });
        const qAlbums = query(collection(db, "albums"), orderBy("createdAt", "desc"));
        const unsubAlbums = onSnapshot(qAlbums, (snapshot) => { setAlbumsMeta(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); });
        return () => { unsubPhotos(); unsubAlbums(); };
    }, []);

    useEffect(() => {
        if (isUploadModalOpen || isSettingsModalOpen || itemToDelete || lightboxIndex !== null) {
            document.documentElement.style.overflow = "hidden";
            document.body.style.overflow = "hidden";
            document.body.style.touchAction = "none";
        } else {
            document.documentElement.style.overflow = "auto";
            document.body.style.overflow = "auto";
            document.body.style.touchAction = "auto";
        }

        return () => {
            document.documentElement.style.overflow = "auto";
            document.body.style.overflow = "auto";
            document.body.style.touchAction = "auto";
        };
    }, [isUploadModalOpen, isSettingsModalOpen, itemToDelete, lightboxIndex]);
    
    const derivedAlbums = [...new Set(photos.map(p => p.album))];
    const allAlbumNames = [...new Set([...derivedAlbums, ...albumsMeta.map(a => a.name)])];

    useEffect(() => {
        if (isUploadModalOpen && allAlbumNames.length > 0 && !selectedAlbumForm) setSelectedAlbumForm(activeView === "AlbumDetail" ? selectedAlbumView : allAlbumNames[0]);
        else if (isUploadModalOpen && allAlbumNames.length === 0) setSelectedAlbumForm("Yeni");
    }, [isUploadModalOpen, allAlbumNames, selectedAlbumForm, activeView, selectedAlbumView]);

    const displayedPhotos = activeView === "Tümü" ? photos : (activeView === "AlbumDetail" ? photos.filter(p => p.album === selectedAlbumView) : []);
    const currentAlbumDetails = activeView === "AlbumDetail" ? albumsMeta.find(a => a.name === selectedAlbumView) : null;

    // --- KLAVYE İLE TAM EKRAN (LIGHTBOX) NAVİGASYONU ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (lightboxIndex !== null) {
                if (e.key === "ArrowRight") nextLightbox();
                else if (e.key === "ArrowLeft") prevLightbox();
                else if (e.key === "Escape") setLightboxIndex(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [lightboxIndex, displayedPhotos.length]);

    // TAM EKRAN (LIGHTBOX) KONTROLLERİ
    const nextLightbox = () => setLightboxIndex((prev) => (prev === displayedPhotos.length - 1 ? 0 : prev + 1));
    const prevLightbox = () => setLightboxIndex((prev) => (prev === 0 ? displayedPhotos.length - 1 : prev - 1));

    // SLAYT (SLIDER) KONTROLLERİ
    const nextSlide = () => setSliderIndex((prev) => (prev === displayedPhotos.length - 1 ? 0 : prev + 1));
    const prevSlide = () => setSliderIndex((prev) => (prev === 0 ? displayedPhotos.length - 1 : prev - 1));
    useEffect(() => { setSliderIndex(0); }, [activeView, selectedAlbumView]);

    // ORTAK KAYDIRMA (SWIPE) MANTIĞI
    const handleTouchStart = (e) => { touchStartX.current = e.changedTouches ? e.changedTouches[0].screenX : e.screenX; };
    const handleTouchEnd = (e, isLightbox = false) => {
        touchEndX.current = e.changedTouches ? e.changedTouches[0].screenX : e.screenX;
        if (touchStartX.current - touchEndX.current > 75) isLightbox ? nextLightbox() : nextSlide();
        if (touchEndX.current - touchStartX.current > 75) isLightbox ? prevLightbox() : prevSlide();
    };

    const getVideoDuration = (file) => {
        return new Promise((resolve) => {
            const video = document.createElement("video"); video.preload = "metadata";
            video.onloadedmetadata = () => { window.URL.revokeObjectURL(video.src); resolve(video.duration); };
            video.onerror = () => resolve(0); video.src = window.URL.createObjectURL(file);
        });
    };

    const handleUpload = async (e) => {
        e.preventDefault(); if (!selectedFiles || selectedFiles.length === 0) return;
        setIsUploading(true);
        const targetAlbum = selectedAlbumForm === "Yeni" ? newAlbumName.trim() : selectedAlbumForm;

        if (selectedAlbumForm === "Yeni" && targetAlbum !== "") {
            const exists = albumsMeta.find(a => a.name.toLowerCase() === targetAlbum.toLowerCase());
            if (!exists) await addDoc(collection(db, "albums"), { name: targetAlbum, createdBy: currentUser, createdAt: Date.now() });
        }

        const totalFiles = selectedFiles.length; let filesCompleted = 0;
        const uploadPromises = selectedFiles.map(async (file) => {
            const isVideo = file.type.startsWith("video/");
            let duration = null; if (isVideo) duration = await getVideoDuration(file);

            const uniqueFileName = `${Date.now()}_${file.name}`;
            const storageRef = ref(storage, `gallery/${uniqueFileName}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            return new Promise((resolve, reject) => {
                uploadTask.on("state_changed",
                    (snapshot) => { setUploadProgress(((filesCompleted + (snapshot.bytesTransferred / snapshot.totalBytes)) / totalFiles) * 100); },
                    (error) => reject(error),
                    async () => {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        await addDoc(collection(db, "gallery"), {
                            url: downloadURL, storagePath: `gallery/${uniqueFileName}`, album: targetAlbum, note: photoNote, date: photoDate, type: isVideo ? "video" : "image", duration: duration, addedBy: currentUser, createdAt: Date.now()
                        });
                        filesCompleted++; resolve();
                    }
                );
            });
        });

        try {
            await Promise.all(uploadPromises);
            setIsUploading(false); setIsUploadModalOpen(false); setSelectedFiles([]); setUploadProgress(0); setNewAlbumName(""); setPhotoNote(""); setPhotoDate("");
        } catch (error) { console.error("Hata:", error); setIsUploading(false); }
    };

    const openSettingsModal = () => {
        const details = albumsMeta.find(a => a.name === selectedAlbumView) || {};
        setEditingAlbum({ id: details.id, originalName: selectedAlbumView, name: details.name || selectedAlbumView, note: details.note || "", date: details.date || "", coverImage: details.coverImage || "" });
        setIsSettingsModalOpen(true);
    };

    const saveAlbumSettings = async (e) => {
        e.preventDefault(); setIsUploading(true);
        try {
            if (editingAlbum.name !== editingAlbum.originalName) {
                const photosToUpdate = photos.filter(p => p.album === editingAlbum.originalName);
                for (let p of photosToUpdate) await updateDoc(doc(db, "gallery", p.id), { album: editingAlbum.name });
            }
            const albumData = { name: editingAlbum.name, note: editingAlbum.note, date: editingAlbum.date, coverImage: editingAlbum.coverImage };
            if (editingAlbum.id) await updateDoc(doc(db, "albums", editingAlbum.id), albumData);
            else await addDoc(collection(db, "albums"), { ...albumData, createdBy: currentUser, createdAt: Date.now() });
            setSelectedAlbumView(editingAlbum.name); setIsSettingsModalOpen(false);
        } catch (error) { console.error("Hata:", error); }
        setIsUploading(false);
    };

    const confirmDelete = async () => {
        try {
            if (itemToDelete.type === 'photo') {
                const photo = photos.find(p => p.id === itemToDelete.id);
                if (photo) { await deleteObject(ref(storage, photo.storagePath)); await deleteDoc(doc(db, "gallery", photo.id)); }
            }
            else if (itemToDelete.type === 'album') {
                const photosInAlbum = photos.filter(p => p.album === itemToDelete.name);
                for (let p of photosInAlbum) { await deleteObject(ref(storage, p.storagePath)); await deleteDoc(doc(db, "gallery", p.id)); }
                const albumDoc = albumsMeta.find(a => a.name === itemToDelete.name);
                if (albumDoc) await deleteDoc(doc(db, "albums", albumDoc.id));
                setActiveView("Albümler"); setIsSettingsModalOpen(false);
            }
            setItemToDelete(null);

            // Eğer tam ekrandan siliyorsa kapat
            setLightboxIndex(null);

            if (viewMode === 'slider' && sliderIndex >= displayedPhotos.length - 1) setSliderIndex(Math.max(0, displayedPhotos.length - 2));
        } catch (error) { console.error("Silinirken hata:", error); }
    };

    const renderPhotos = () => {
        if (displayedPhotos.length === 0) {
            return (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "50px 0" }}>
                    <i className="fa-regular fa-images" style={{ fontSize: "4rem", opacity: 0.5, marginBottom: "15px" }}></i>
                    <p>Hadi ilk anıyı ekleyelim!</p>
                </div>
            );
        }

        return (
            <>
                {viewMode === "grid" ? (
                    <div className="photo-grid">
                        {displayedPhotos.map((photo, index) => (
                            <div key={photo.id} className="photo-card">
                                {/* TIKLANDIĞINDA ARTIK İNDEX DEĞERİNİ GÖNDERİYORUZ */}
                                <div className="photo-img-wrapper" onClick={() => setLightboxIndex(index)}>
                                    {photo.type === "video" ? (
                                        <>
                                            <video src={photo.url} className="photo-img" muted preload="metadata" />
                                            <div className="video-duration-badge"><i className="fa-solid fa-play"></i> {formatDuration(photo.duration)}</div>
                                        </>
                                    ) : <img src={photo.url} alt="Anı" className="photo-img" />}

                                    <button className="photo-delete-btn" onClick={(e) => { e.stopPropagation(); setItemToDelete({ type: 'photo', id: photo.id }); }}>
                                        <i className="fa-solid fa-trash-can"></i>
                                    </button>
                                </div>
                                <div className="photo-details-grid">
                                    {photo.note ? <p title={photo.note}>{photo.note}</p> : <p style={{opacity:0.5}}>Not eklenmemiş</p>}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span>{photo.date ? new Date(photo.date).toLocaleDateString('tr-TR') : ""}</span>
                                        <span style={{textTransform: "capitalize"}}><i className="fa-solid fa-user-pen"></i> {photo.addedBy}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="slider-container">
                        <div className="slider-touch-area" onMouseDown={handleTouchStart} onMouseUp={(e) => handleTouchEnd(e, false)} onTouchStart={handleTouchStart} onTouchEnd={(e) => handleTouchEnd(e, false)}>
                            {displayedPhotos[sliderIndex].type === "video" ? (
                                <CustomVideoPlayer src={displayedPhotos[sliderIndex].url} className="slider-video" />
                            ) : (
                                <img src={displayedPhotos[sliderIndex].url} alt="Slider Anı" className="slider-img" onClick={() => setLightboxIndex(sliderIndex)} style={{cursor:"pointer"}}/>
                            )}
                        </div>
                        <div className="slider-controls">
                            <button className="slider-arrow" onClick={(e) => { e.stopPropagation(); prevSlide(); }}><i className="fa-solid fa-chevron-left"></i></button>
                            <button className="slider-arrow" onClick={(e) => { e.stopPropagation(); nextSlide(); }}><i className="fa-solid fa-chevron-right"></i></button>
                        </div>
                        <div className="slider-info">
                            <h4>{displayedPhotos[sliderIndex].note || "Not Eklenmemiş"}</h4>
                            <div style={{ display: "flex", gap: "15px", justifyContent: "center", alignItems: "center" }}>
                                {displayedPhotos[sliderIndex].date && <p><i className="fa-regular fa-calendar"></i> {new Date(displayedPhotos[sliderIndex].date).toLocaleDateString('tr-TR')}</p>}
                                <p style={{textTransform: "capitalize"}}><i className="fa-solid fa-user-pen"></i> {displayedPhotos[sliderIndex].addedBy}</p>
                                <button className="delete-btn" style={{padding: "4px 10px", fontSize: "0.8rem", marginLeft: "10px"}} onClick={() => setItemToDelete({ type: 'photo', id: displayedPhotos[sliderIndex].id })}>
                                    <i className="fa-solid fa-trash-can"></i> Sil
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    };

    return (
        <div className="gallery-container">
            <div className="todo-header">
                <h2>📸 Ortak Galeri</h2>
                <p>Anılar, videolar ve özel günler...</p>
            </div>

            {/* YENİ DÜZEN: SEKMELER MERKEZDE, İKONLAR SAĞDA */}
            <div className="gallery-main-tabs-wrapper">
                {/* Merkez: Sekmeler */}
                <div className="gallery-main-tabs">
                    <button className={`main-tab ${activeView === "Tümü" ? "active" : ""}`} onClick={() => setActiveView("Tümü")}>
                        <i className="fa-solid fa-images"></i> Tüm Medyalar
                    </button>
                    <button className={`main-tab ${activeView === "Albümler" || activeView === "AlbumDetail" ? "active" : ""}`} onClick={() => setActiveView("Albümler")}>
                        <i className="fa-solid fa-folder-open"></i> Albümler
                    </button>
                </div>

                {/* Sağ Taraf: Görünüm İkonları (Sadece Tümü veya Albüm Detayındayken ve Fotoğraf Varsa Çıkar) */}
                {(activeView === "Tümü" || activeView === "AlbumDetail") && displayedPhotos.length > 0 && (
                    <div className="view-toggles-container">
                        <div className="view-toggles">
                            <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title="Izgara Görünümü">
                                <i className="fa-solid fa-border-all"></i>
                            </button>
                            <button className={`view-btn ${viewMode === 'slider' ? 'active' : ''}`} onClick={() => setViewMode('slider')} title="Slayt Görünümü">
                                <i className="fa-solid fa-images"></i>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <div style={{ textAlign: "center", padding: "50px", color: "var(--accent-color)" }}><i className="fa-solid fa-spinner fa-spin fa-2x"></i></div>
            ) : (
                <>
                    {activeView === "Tümü" && renderPhotos()}

                    {activeView === "Albümler" && (
                        <div className="album-grid">
                            {allAlbumNames.length === 0 ? (
                                <p style={{ color: "var(--text-muted)", gridColumn: "1 / -1", textAlign: "center" }}>Henüz hiç albüm yok.</p>
                            ) : (
                                allAlbumNames.map(albumName => {
                                    const meta = albumsMeta.find(a => a.name === albumName);
                                    const albumPhotos = photos.filter(p => p.album === albumName);
                                    const imagePhotos = albumPhotos.filter(p => p.type !== "video");
                                    const fallbackImage = imagePhotos.length > 0 ? imagePhotos[0].url : 'https://placehold.co/400x300/1e293b/c084fc?text=Video+Albumu';
                                    const coverImage = meta?.coverImage || fallbackImage;

                                    return (
                                        <div key={albumName} className="album-card" onClick={() => { setSelectedAlbumView(albumName); setActiveView("AlbumDetail"); }}>
                                            <img src={coverImage} alt={albumName} className="album-card-img" />
                                            <div className="album-card-info">
                                                <h4 className="album-card-title">{albumName}</h4>
                                                <div className="album-card-meta">{albumPhotos.length} medya</div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}

                    {activeView === "AlbumDetail" && selectedAlbumView && (
                        <>
                            <div className="album-header-box">
                                {/* 1. SATIR: Sadece Butonlar (Biri sağda, biri solda) */}
                                <div className="album-header-actions">
                                    <button className="back-btn" onClick={() => setActiveView("Albümler")}>
                                        <i className="fa-solid fa-arrow-left"></i> Geri
                                    </button>
                                    <button className="album-settings-btn" onClick={openSettingsModal}>
                                        <i className="fa-solid fa-gear"></i> Ayarlar
                                    </button>
                                </div>

                                {/* 2. SATIR: Başlık ve Notlar (Tam genişlikte, dilediği kadar uzayabilir) */}
                                <div className="album-header-info">
                                    <h3 className="album-title">{currentAlbumDetails?.name || selectedAlbumView}</h3>
                                    {currentAlbumDetails?.note && <p className="album-note">{currentAlbumDetails.note}</p>}
                                    {currentAlbumDetails?.date && <span className="album-meta-date"><i className="fa-regular fa-calendar"></i> {new Date(currentAlbumDetails.date).toLocaleDateString('tr-TR')}</span>}
                                </div>
                            </div>
                            {renderPhotos()}
                        </>
                    )}
                </>
            )}

            <button className="fab-add-btn" onClick={() => setIsUploadModalOpen(true)} title="Medya Ekle"><i className="fa-solid fa-plus"></i></button>

            {/* ALBÜM AYARLARI MODAL'I */}
            {isSettingsModalOpen && (
                <div className="modal-overlay" onClick={() => !isUploading && setIsSettingsModalOpen(false)}>
                    <div className="add-todo-modal" onClick={(e) => e.stopPropagation()}>
                        {!isUploading && <button className="close-modal-btn" onClick={() => setIsSettingsModalOpen(false)}><i className="fa-solid fa-xmark"></i></button>}
                        <div className="add-todo-header"><h3>Albüm Ayarları</h3><p>Albüm detaylarını düzenle veya kapak fotoğrafı seç.</p></div>
                        <form onSubmit={saveAlbumSettings} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input type="text" className="add-todo-input" placeholder="Albüm Adı *" value={editingAlbum.name} onChange={(e) => setEditingAlbum({...editingAlbum, name: e.target.value})} required disabled={isUploading} />
                            <input type="text" className="add-todo-input" placeholder="Albüm Açıklaması / Not" value={editingAlbum.note} onChange={(e) => setEditingAlbum({...editingAlbum, note: e.target.value})} disabled={isUploading} />
                            <input type="date" className="add-todo-input" value={editingAlbum.date} onChange={(e) => setEditingAlbum({...editingAlbum, date: e.target.value})} disabled={isUploading} />
                            <div>
                                <label style={{fontSize:"0.85rem", color:"var(--text-muted)", marginBottom:"5px", display:"block"}}>Kapak Fotoğrafı Seç</label>
                                <div className="cover-selector-container">
                                    {photos.filter(p => p.album === editingAlbum.originalName && p.type !== "video").map((photo, idx) => (
                                        <img key={idx} src={photo.url} alt="Kapak Adayı" className={`cover-option ${editingAlbum.coverImage === photo.url ? 'selected' : ''}`} onClick={() => setEditingAlbum({...editingAlbum, coverImage: photo.url})} />
                                    ))}
                                    {photos.filter(p => p.album === editingAlbum.originalName && p.type !== "video").length === 0 && (
                                        <p style={{color: "var(--text-muted)", fontSize: "0.85rem"}}>Bu albümde kapak yapılabilecek fotoğraf yok.</p>
                                    )}
                                </div>
                            </div>
                            {isUploading ? ( <div style={{ textAlign: "center", color: "var(--text-main)", padding: "10px" }}>Kaydediliyor...</div> ) : (
                                <button type="submit" className="add-todo-submit"><i className="fa-solid fa-check"></i> Değişiklikleri Kaydet</button>
                            )}
                        </form>
                        <div style={{borderTop: "1px solid var(--border-color)", paddingTop: "20px", marginTop: "10px", textAlign: "right"}}>
                            <button className="delete-btn" onClick={() => setItemToDelete({ type: 'album', name: editingAlbum.originalName })}><i className="fa-solid fa-trash-can"></i> Tüm Albümü Sil</button>
                        </div>
                    </div>
                </div>
            )}

            {/* YÜKLEME MODALI */}
            {isUploadModalOpen && (
                <div className="modal-overlay" onClick={() => !isUploading && setIsUploadModalOpen(false)}>
                    <div className="add-todo-modal" onClick={(e) => e.stopPropagation()}>
                        {!isUploading && <button className="close-modal-btn" onClick={() => setIsUploadModalOpen(false)}><i className="fa-solid fa-xmark"></i></button>}
                        <div className="add-todo-header"><h3>Fotoğraf ve Video Yükle</h3><p>Çoklu seçim yapabilirsiniz.</p></div>
                        <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <label className="upload-area">
                                <input type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={(e) => setSelectedFiles(Array.from(e.target.files))} disabled={isUploading} />
                                {selectedFiles.length > 0 ? (
                                    <div style={{ color: "var(--accent-color)", fontWeight: "bold" }}>
                                        <i className="fa-solid fa-photo-film" style={{fontSize: "2rem", marginBottom: "10px"}}></i><br/>{selectedFiles.length} dosya seçildi
                                        <div className="selected-files-list">{selectedFiles.map((f, i) => <div key={i}>{f.name}</div>)}</div>
                                    </div>
                                ) : (
                                    <div style={{ color: "var(--text-muted)" }}><i className="fa-solid fa-arrow-up-from-bracket" style={{fontSize: "2rem", marginBottom: "10px"}}></i><br/>Medyaları seçmek için tıkla</div>
                                )}
                            </label>
                            <div className="add-todo-grid">
                                <div>
                                    <label style={{fontSize:"0.85rem", color:"var(--text-muted)", marginBottom:"5px", display:"block"}}>Hangi Albüme?</label>
                                    <select className="add-todo-input" style={{width:"100%"}} value={selectedAlbumForm} onChange={(e) => setSelectedAlbumForm(e.target.value)} disabled={isUploading}>
                                        {allAlbumNames.map((album, idx) => <option key={idx} value={album}>{album}</option>)}
                                        <option value="Yeni">+ Yeni Albüm Oluştur</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{fontSize:"0.85rem", color:"var(--text-muted)", marginBottom:"5px", display:"block"}}>Ortak Tarih</label>
                                    <input type="date" className="add-todo-input" style={{width:"100%"}} value={photoDate} onChange={(e) => setPhotoDate(e.target.value)} disabled={isUploading} />
                                </div>
                            </div>
                            <div>
                                <label style={{fontSize:"0.85rem", color:"var(--text-muted)", marginBottom:"5px", display:"block"}}>Ortak Not (İsteğe bağlı)</label>
                                <input type="text" className="add-todo-input" placeholder="Bu anılarda ne oldu?..." value={photoNote} onChange={(e) => setPhotoNote(e.target.value)} disabled={isUploading} style={{width:"100%"}}/>
                            </div>
                            {selectedAlbumForm === "Yeni" && ( <input type="text" className="add-todo-input" placeholder="Yeni Albüm Adı *" value={newAlbumName} onChange={(e) => setNewAlbumName(e.target.value)} required disabled={isUploading} style={{width:"100%"}}/> )}
                            {isUploading ? (
                                <div style={{ textAlign: "center", color: "var(--text-main)" }}>
                                    <div style={{ background: "var(--bg-color)", height: "8px", borderRadius: "4px", overflow: "hidden", marginBottom: "10px" }}>
                                        <div style={{ background: "var(--accent-color)", height: "100%", width: `${uploadProgress}%`, transition: "width 0.2s" }}></div>
                                    </div>
                                    {selectedFiles.length} dosya yükleniyor... %{Math.round(uploadProgress)}
                                </div>
                            ) : (
                                <button type="submit" className="add-todo-submit" disabled={selectedFiles.length === 0}><i className="fa-solid fa-check"></i> Kaydet ve Yükle</button>
                            )}
                        </form>
                    </div>
                </div>
            )}

            {/* YENİ: KAYDIRILABİLİR TAM EKRAN (LIGHTBOX) */}
            {lightboxIndex !== null && displayedPhotos[lightboxIndex] && (
                <div className="lightbox-overlay" onClick={() => setLightboxIndex(null)}>
                    <button className="lightbox-close" onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}><i className="fa-solid fa-xmark"></i></button>

                    {/* Oklar */}
                    <button className="lightbox-arrow left" onClick={(e) => { e.stopPropagation(); prevLightbox(); }}><i className="fa-solid fa-chevron-left"></i></button>
                    <button className="lightbox-arrow right" onClick={(e) => { e.stopPropagation(); nextLightbox(); }}><i className="fa-solid fa-chevron-right"></i></button>

                    {/* İçerik ve Kaydırma Alanı */}
                    <div
                        className="lightbox-content-wrapper"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={handleTouchStart}
                        onMouseUp={(e) => handleTouchEnd(e, true)}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={(e) => handleTouchEnd(e, true)}
                    >
                        {displayedPhotos[lightboxIndex].type === "video" ? (
                            <CustomVideoPlayer src={displayedPhotos[lightboxIndex].url} className="lightbox-video-wrapper" />
                        ) : (
                            <img src={displayedPhotos[lightboxIndex].url} alt="Büyütülmüş Anı" className="lightbox-img" />
                        )}
                    </div>
                </div>
            )}

            {/* SİLME ONAY PENCERESİ */}
            {itemToDelete && (
                <div className="confirm-overlay" onClick={() => setItemToDelete(null)}>
                    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
                        <h3>Emin misin?</h3>
                        {itemToDelete.type === 'album' ? (
                            <p><b>{itemToDelete.name}</b> albümünü ve içindeki <b style={{color: '#ef4444'}}>TÜM MEDYAYI</b> tamamen silmek istediğine emin misin?</p>
                        ) : ( <p>Bu medyayı galeriden tamamen silmek istediğine emin misin?</p> )}
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