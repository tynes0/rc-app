import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import ContentCard from "../components/ContentCard";
import "./Movies.css";

export default function Movies() {
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("watchlist");
    const [selectedMovie, setSelectedMovie] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);

    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [shuffleItem, setShuffleItem] = useState(null);
    const [winnerItem, setWinnerItem] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "movies"), (snapshot) => {
            const moviesList = snapshot.docs.map(doc => ({
                ...doc.data(),
                firebaseId: doc.id
            }));
            const onlyMovies = moviesList.filter(m => m.mediaType !== 'tv');
            setMovies(onlyMovies.length > 0 ? onlyMovies : moviesList);
            setLoading(false);
        }, (error) => {
            console.error("Filmler çekilirken hata oluştu: ", error);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const toggleWatchedStatus = async (firebaseId) => {
        const movieToUpdate = movies.find(m => m.firebaseId === firebaseId);
        if(!movieToUpdate) return;
        try {
            await updateDoc(doc(db, "movies", firebaseId), { isWatched: !movieToUpdate.isWatched });
        } catch (error) { console.error("Güncellenirken hata oluştu:", error); }
    };

    const confirmDelete = async () => {
        const targetId = selectedMovie.firebaseId;
        setItemToDelete(false);
        setSelectedMovie(null);
        if (!targetId) return;
        try {
            await deleteDoc(doc(db, "movies", targetId.toString()));
        } catch (error) { console.error("Silinirken hata oluştu:", error); }
    };

    const fireEmojiExplosion = () => {
        const container = document.createElement("div");
        container.className = "confetti-container";
        container.style.zIndex = "999999";
        document.body.appendChild(container);

        const emojiler = ["🎬", "🍿", "🎲", "✨", "💖", "🥳", "🎥", "⭐️"];

        for (let i = 0; i < 50; i++) { 
            const particle = document.createElement("div");
            particle.className = "confetti-particle";
            particle.innerText = emojiler[Math.floor(Math.random() * emojiler.length)];
            particle.style.left = Math.random() * 100 + "vw";
            particle.style.animationDuration = (Math.random() * 1.5 + 1) + "s";
            particle.style.animationDelay = (Math.random() * 0.2) + "s";
            particle.style.fontSize = (Math.random() * 20 + 20) + "px"; // 20px - 40px arası
            container.appendChild(particle);
        }

        // 3 saniye sonra temizle
        setTimeout(() => {
            if (document.body.contains(container)) {
                document.body.removeChild(container);
            }
        }, 3000);
    };

    // YENİ: Kart Karma Animasyonu Mantığı
    const startRandomPicker = () => {
        const unwatched = movies.filter(m => !m.isWatched);
        if (unwatched.length === 0) {
            alert("İzlenecek film kalmamış! Arama sayfasından yeni bir şeyler eklemelisin.");
            return;
        }

        setIsPickerOpen(true);
        setWinnerItem(null);

        let counter = 0;
        const maxShuffles = 25; // Kartlar 25 kez değişecek (Yaklaşık 2.5 saniye)
        const intervalTime = 100;

        const interval = setInterval(() => {
            // Rastgele bir poster göster
            const randomPick = unwatched[Math.floor(Math.random() * unwatched.length)];
            setShuffleItem(randomPick);
            counter++;

            if (counter >= maxShuffles) {
                clearInterval(interval);
                const finalWinner = unwatched[Math.floor(Math.random() * unwatched.length)];
                setShuffleItem(null);

                fireEmojiExplosion();

                setWinnerItem(finalWinner);
            }
        }, intervalTime);
    };

    const displayedMovies = movies.filter(movie => {
        if (activeTab === "watchlist") return !movie.isWatched;
        if (activeTab === "watched") return movie.isWatched;
        return true;
    });

    useEffect(() => { setCurrentPage(1); }, [activeTab, itemsPerPage]);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = displayedMovies.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(displayedMovies.length / itemsPerPage);

    const nextPage = () => setCurrentPage(prev => (prev < totalPages ? prev + 1 : prev));
    const prevPage = () => setCurrentPage(prev => (prev > 1 ? prev - 1 : prev));

    return (
        <div>
            {/* Sekmelerden eski kötü butonu sildik */}
            <div className="tabs-container">
                <button className={`tab-btn ${activeTab === "watchlist" ? "active" : ""}`} onClick={() => setActiveTab("watchlist")}>
                    <i className="fa-solid fa-list"></i> İzlenecekler
                </button>
                <button className={`tab-btn ${activeTab === "watched" ? "active" : ""}`} onClick={() => setActiveTab("watched")}>
                    <i className="fa-solid fa-check-double"></i> İzlenenler
                </button>
            </div>

            {!loading && displayedMovies.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px', padding: '0 10px' }}>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-layer-group"></i> Sayfada Göster:
                        <select
                            value={itemsPerPage}
                            onChange={(e) => setItemsPerPage(Number(e.target.value))}
                            style={{ background: 'var(--sidebar-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '5px', padding: '5px' }}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </label>
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: "center", padding: "50px", color: "var(--accent-color)" }}>
                    <i className="fa-solid fa-spinner fa-spin fa-2x"></i>
                    <p>Veriler buluttan getiriliyor...</p>
                </div>
            ) : displayedMovies.length === 0 ? (
                <p style={{ color: "var(--text-muted)", textAlign: "center", marginTop: "40px" }}>Bu listede hiç film yok...</p>
            ) : (
                <>
                    <div style={styles.gridContainer}>
                        {currentItems.map((movie) => (
                            <ContentCard key={movie.firebaseId} data={movie} onClick={setSelectedMovie} onToggleWatched={() => toggleWatchedStatus(movie.firebaseId)} isWatched={movie.isWatched} />
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '30px', paddingBottom: '20px' }}>
                            <button onClick={prevPage} disabled={currentPage === 1} style={{ padding: '8px 15px', borderRadius: '8px', border: 'none', background: currentPage === 1 ? 'var(--sidebar-bg)' : 'var(--accent-color)', color: 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>
                                <i className="fa-solid fa-chevron-left"></i> Önceki
                            </button>
                            <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>Sayfa {currentPage} / {totalPages}</span>
                            <button onClick={nextPage} disabled={currentPage === totalPages} style={{ padding: '8px 15px', borderRadius: '8px', border: 'none', background: currentPage === totalPages ? 'var(--sidebar-bg)' : 'var(--accent-color)', color: 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}>
                                Sonraki <i className="fa-solid fa-chevron-right"></i>
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* FİLM DETAY PENCERESİ (Mevcut) */}
            {selectedMovie && (
                <div className="modal-overlay" onClick={() => setSelectedMovie(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="close-modal-btn" onClick={() => setSelectedMovie(null)}>
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                        <div className="modal-left">
                            <img src={selectedMovie.poster} alt={selectedMovie.title} className="modal-poster" />
                        </div>
                        <div className="modal-right">
                            <h2 className="modal-title">{selectedMovie.title} <span>({selectedMovie.year})</span></h2>
                            <div className="modal-meta">
                                <span><i className="fa-solid fa-star" style={{color: "#facc15"}}></i> {selectedMovie.rating ? selectedMovie.rating.toFixed(1) : "-"} Puan</span>
                                <span><i className="fa-solid fa-clock"></i> {selectedMovie.duration || "Bilinmiyor"}</span>
                                {selectedMovie.addedBy && (
                                    <span style={{color: "var(--text-muted)", textTransform: "capitalize"}}>
                                        <i className="fa-solid fa-user-pen"></i> {selectedMovie.addedBy} ekledi
                                    </span>
                                )}
                            </div>
                            <p className="modal-desc">{selectedMovie.overview || "Bu film için özet bulunmuyor."}</p>
                            <div className="modal-actions">
                                <button className={`watched-toggle-btn ${selectedMovie.isWatched ? 'is-watched' : ''}`} onClick={() => { toggleWatchedStatus(selectedMovie.firebaseId); setSelectedMovie({...selectedMovie, isWatched: !selectedMovie.isWatched}); }}>
                                    <i className={`fa-solid ${selectedMovie.isWatched ? 'fa-rotate-left' : 'fa-check'}`}></i>
                                    {selectedMovie.isWatched ? "Geri Al" : "İzledim"}
                                </button>
                                <button className="delete-btn" onClick={() => setItemToDelete(true)}>
                                    <i className="fa-solid fa-trash-can"></i> Listeden Sil
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SİLME ONAYI PENCERESİ */}
            {itemToDelete && (
                <div className="confirm-overlay" onClick={() => setItemToDelete(null)}>
                    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
                        <h3>Emin misin?</h3>
                        <p>Bu filmi listeden tamamen silmek istediğine emin misin? Bu işlem geri alınamaz.</p>
                        <div className="confirm-actions">
                            <button className="confirm-btn confirm-cancel" onClick={() => setItemToDelete(null)}>İptal</button>
                            <button className="confirm-btn confirm-delete" onClick={confirmDelete}>Evet, Sil</button>
                        </div>
                    </div>
                </div>
            )}

            {/* YENİ: YÜZEN ZAR BUTONU (FAB) */}
            <button className="random-picker-fab" onClick={startRandomPicker} title="Ne İzlesek?">
                <i className="fa-solid fa-dice"></i>
            </button>

            {/* YENİ: KART KARMA VE KAZANAN EKRANI MODALI */}
            {isPickerOpen && (
                <div className="lightbox-overlay" onClick={() => !shuffleItem && setIsPickerOpen(false)} style={{ zIndex: 99999 }}>
                    <div className="picker-content-wrapper" onClick={(e) => e.stopPropagation()}>

                        {/* 1. Aşama: Karıştırma Animasyonu */}
                        {shuffleItem && (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
                                <h3 style={{ color: "var(--text-muted)", fontSize: "1.5rem" }}>Seçiliyor...</h3>
                                <img src={shuffleItem.poster} alt="shuffling" className="shuffling-poster" />
                            </div>
                        )}

                        {/* 2. Aşama: Kazananın Fırlaması */}
                        {winnerItem && (
                            <div className="winner-container">
                                <h2 className="winner-title">Bu Akşamın Seçimi! 🍿</h2>
                                <img src={winnerItem.poster} alt={winnerItem.title} className="winner-poster" />
                                <h3 className="winner-movie-name">{winnerItem.title}</h3>
                                <div className="winner-actions">
                                    <button className="winner-btn view" onClick={() => { setIsPickerOpen(false); setSelectedMovie(winnerItem); }}>
                                        <i className="fa-solid fa-circle-info"></i> Detayları Gör
                                    </button>
                                    <button className="winner-btn retry" onClick={startRandomPicker}>
                                        <i className="fa-solid fa-rotate-right"></i> Tekrar Çek
                                    </button>
                                </div>
                                <button
                                    onClick={() => setIsPickerOpen(false)}
                                    style={{ marginTop: "15px", background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", textDecoration: "underline" }}
                                >
                                    Vazgeç ve Kapat
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = { gridContainer: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "24px", paddingBottom: "40px" }};