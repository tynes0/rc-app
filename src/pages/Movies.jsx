import { useState, useEffect } from "react";
// YENİ: onSnapshot Eklendi
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

    // 1. BULUTTAN VERİLERİ CANLI CANLI ÇEKME (onSnapshot)
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "movies"), (snapshot) => {
            const moviesList = snapshot.docs.map(doc => ({
                ...doc.data(),
                firebaseId: doc.id // Silme ve Güncelleme işlemleri için gerçek ID
            }));

            // İstersen sadece "movie" olanları filtreleyebilirsin, 
            // ama dizi sayfan yoksa hepsi burada durabilir.
            const onlyMovies = moviesList.filter(m => m.mediaType !== 'tv');

            setMovies(onlyMovies.length > 0 ? onlyMovies : moviesList); // Şimdilik esneklik için
            setLoading(false);
        }, (error) => {
            console.error("Filmler çekilirken hata oluştu: ", error);
            setLoading(false);
        });

        return () => unsub();
    }, []);

    // 2. BULUTTA İZLENME DURUMUNU GÜNCELLEME (Gerçek Firebase ID ile)
    const toggleWatchedStatus = async (firebaseId) => {
        const movieToUpdate = movies.find(m => m.firebaseId === firebaseId);
        if(!movieToUpdate) return;

        const newWatchedStatus = !movieToUpdate.isWatched;

        try {
            const movieRef = doc(db, "movies", firebaseId);
            await updateDoc(movieRef, { isWatched: newWatchedStatus });
            // onSnapshot sayesinde ekran otomatik güncellenecek, setMovies yapmaya gerek kalmadı!
        } catch (error) {
            console.error("Güncellenirken hata oluştu:", error);
        }
    };

    const handleDeleteClick = (firebaseId) => {
        setItemToDelete(firebaseId);
    };

    // 3. BULUTTAN FİLMİ TAMAMEN SİLME (Gerçek Firebase ID ile)
    const confirmDelete = async () => {
        const idToDelete = itemToDelete;

        // Pencereleri kapat
        setItemToDelete(null);
        setSelectedMovie(null);

        // Firebase'den sil
        try {
            await deleteDoc(doc(db, "movies", idToDelete));
            // onSnapshot sayesinde liste anında kendi kendini güncelleyecek
        } catch (error) {
            console.error("Silinirken hata oluştu:", error);
        }
    };

    const displayedMovies = movies.filter(movie => {
        if (activeTab === "watchlist") return !movie.isWatched;
        if (activeTab === "watched") return movie.isWatched;
        return true;
    });

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10); // Varsayılan 10 film göster

    // Sekme veya sayfa boyutu değiştiğinde 1. sayfaya dön
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, itemsPerPage]);

    // O anki sayfada gösterilecek filmleri hesapla
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = displayedMovies.slice(indexOfFirstItem, indexOfLastItem);

    const totalPages = Math.ceil(displayedMovies.length / itemsPerPage);

    // Sayfa değiştirme fonksiyonları
    const paginate = (pageNumber) => setCurrentPage(pageNumber);
    const nextPage = () => setCurrentPage(prev => (prev < totalPages ? prev + 1 : prev));
    const prevPage = () => setCurrentPage(prev => (prev > 1 ? prev - 1 : prev));

    return (
        <div>
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
                    {/* DİKKAT: displayedMovies yerine artık currentItems map ediyoruz */}
                    <div style={styles.gridContainer}>
                        {currentItems.map((movie) => (
                            <ContentCard
                                key={movie.firebaseId}
                                data={movie}
                                onClick={setSelectedMovie}
                                onToggleWatched={() => toggleWatchedStatus(movie.firebaseId)}
                                isWatched={movie.isWatched}
                            />
                        ))}
                    </div>

                    {/* YENİ: SAYFALAMA BUTONLARI (Sadece 1'den fazla sayfa varsa göster) */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '30px', paddingBottom: '20px' }}>
                            <button onClick={prevPage} disabled={currentPage === 1} style={{ padding: '8px 15px', borderRadius: '8px', border: 'none', background: currentPage === 1 ? 'var(--sidebar-bg)' : 'var(--accent-color)', color: 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>
                                <i className="fa-solid fa-chevron-left"></i> Önceki
                            </button>

                            <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>
                                Sayfa {currentPage} / {totalPages}
                            </span>

                            <button onClick={nextPage} disabled={currentPage === totalPages} style={{ padding: '8px 15px', borderRadius: '8px', border: 'none', background: currentPage === totalPages ? 'var(--sidebar-bg)' : 'var(--accent-color)', color: 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}>
                                Sonraki <i className="fa-solid fa-chevron-right"></i>
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* FİLM DETAY PENCERESİ */}
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
                                <button
                                    className={`watched-toggle-btn ${selectedMovie.isWatched ? 'is-watched' : ''}`}
                                    onClick={() => {
                                        toggleWatchedStatus(selectedMovie.firebaseId);
                                        setSelectedMovie({...selectedMovie, isWatched: !selectedMovie.isWatched});
                                    }}
                                >
                                    <i className={`fa-solid ${selectedMovie.isWatched ? 'fa-rotate-left' : 'fa-check'}`}></i>
                                    {selectedMovie.isWatched ? "Geri Al" : "İzledim"}
                                </button>
                                <button className="delete-btn" onClick={() => handleDeleteClick(selectedMovie.firebaseId)}>
                                    <i className="fa-solid fa-trash-can"></i> Listeden Sil
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ÖZEL ONAY PENCERESİ */}
            {itemToDelete && (
                <div className="confirm-overlay" onClick={() => setItemToDelete(null)}>
                    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-icon">
                            <i className="fa-solid fa-triangle-exclamation"></i>
                        </div>
                        <h3>Emin misin?</h3>
                        <p>Bu filmi listeden tamamen silmek istediğine emin misin? Bu işlem geri alınamaz.</p>
                        <div className="confirm-actions">
                            <button className="confirm-btn confirm-cancel" onClick={() => setItemToDelete(null)}>
                                İptal
                            </button>
                            <button className="confirm-btn confirm-delete" onClick={confirmDelete}>
                                Evet, Sil
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = { gridContainer: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "24px", paddingBottom: "40px" }};