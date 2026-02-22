import { useState, useEffect } from "react";
import {collection, getDocs, doc, updateDoc, deleteDoc, onSnapshot} from "firebase/firestore";
import { db } from "../firebase";
import ContentCard from "../components/ContentCard";
import "./Movies.css"; // Filmlerle aynı stili kullanıyoruz

export default function Series() {
    const [series, setSeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("watchlist");
    const [selectedSeries, setSelectedSeries] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "series"), (snapshot) => {
            const seriesList = snapshot.docs.map(doc => ({
                ...doc.data(),
                firebaseId: doc.id // ✨ İŞTE ATLANAN VE HER ŞEYİ ÇÖZECEK OLAN SATIR!
            }));

            setSeries(seriesList); // Kendi state ismin neyse onu kullan (örn: setSeriesList)
            setLoading(false);
        }, (error) => {
            console.error("Diziler çekilirken hata oluştu: ", error);
            setLoading(false);
        });

        return () => unsub();
    }, []);

    // 2. İZLENME DURUMUNU GÜNCELLEME
    const toggleWatchedStatus = async (firebaseId) => {
        const seriesToUpdate = series.find(s => s.firebaseId === firebaseId); // id yerine firebaseId
        if(!seriesToUpdate) return;

        const newWatchedStatus = !seriesToUpdate.isWatched;

        try {
            const seriesRef = doc(db, "series", firebaseId); // id yerine firebaseId
            await updateDoc(seriesRef, { isWatched: newWatchedStatus });
        } catch (error) {
            console.error("Güncellenirken hata:", error);
        }
    };

    const handleDeleteClick = (id) => {
        setItemToDelete(id);
    };

    // 3. BULUTTAN DİZİYİ SİLME
    const confirmDelete = async () => {
        const idToDelete = itemToDelete; // Bu artık firebaseId'yi tutuyor

        setItemToDelete(null);
        setSelectedSeries(null); // Kendi modal state ismin neyse o

        try {
            await deleteDoc(doc(db, "series", idToDelete)); // id yerine idToDelete (firebaseId)
        } catch (error) {
            console.error("Silinirken hata:", error);
        }
    };

    const displayedSeries = series.filter(item => {
        if (activeTab === "watchlist") return !item.isWatched;
        if (activeTab === "watched") return item.isWatched;
        return true;
    });

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

            {loading ? (
                <div style={{ textAlign: "center", padding: "50px", color: "var(--accent-color)" }}>
                    <i className="fa-solid fa-spinner fa-spin fa-2x"></i>
                    <p>Diziler buluttan getiriliyor...</p>
                </div>
            ) : displayedSeries.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>Bu listede hiç dizi yok...</p>
            ) : (
                <div style={styles.gridContainer}>
                    {displayedSeries.map((show) => (
                        <ContentCard
                            key={show.firebaseId} // ✨ Artık hatasız çalışacak
                            data={show}
                            onClick={setSelectedSeries}
                            onToggleWatched={() => toggleWatchedStatus(show.firebaseId)}
                            isWatched={show.isWatched}
                        />
                    ))}
                </div>
            )}

            {selectedSeries && (
                <div className="modal-overlay" onClick={() => setSelectedSeries(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="close-modal-btn" onClick={() => setSelectedSeries(null)}>
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                        <div className="modal-left">
                            <img src={selectedSeries.poster} alt={selectedSeries.title} className="modal-poster" />
                        </div>
                        <div className="modal-right">
                            <h2 className="modal-title">{selectedSeries.title} <span>({selectedSeries.year})</span></h2>
                            <div className="modal-meta">
                                <span><i className="fa-solid fa-star" style={{color: "#facc15"}}></i> {selectedSeries.rating.toFixed(1)} Puan</span>
                                <span>📺 {selectedSeries.seasons} Sezon / {selectedSeries.episodes} Bölüm</span>
                                <span>⏱️ {selectedSeries.episodeDuration}</span>
                                {selectedSeries.addedBy && (
                                    <span style={{color: "var(--text-muted)", textTransform: "capitalize"}}>
                                        <i className="fa-solid fa-user-pen"></i> {selectedSeries.addedBy} ekledi
                                    </span>
                                )}
                            </div>
                            <p className="modal-desc">{selectedSeries.overview}</p>
                            <div className="modal-actions">
                                <button
                                    className={`watched-toggle-btn ${selectedSeries.isWatched ? 'is-watched' : ''}`}
                                    onClick={() => {
                                        toggleWatchedStatus(selectedSeries.id);
                                        setSelectedSeries({...selectedSeries, isWatched: !selectedSeries.isWatched});
                                    }}
                                >
                                    <i className={`fa-solid ${selectedSeries.isWatched ? 'fa-rotate-left' : 'fa-check'}`}></i>
                                    {selectedSeries.isWatched ? "Geri Al" : "İzledim"}
                                </button>
                                <button className="delete-btn" onClick={() => handleDeleteClick(selectedSeries.id)}>
                                    <i className="fa-solid fa-trash-can"></i> Listeden Sil
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {itemToDelete && (
                <div className="confirm-overlay" onClick={() => setItemToDelete(null)}>
                    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
                        <h3>Emin misin?</h3>
                        <p>Bu diziyi listeden tamamen silmek istediğine emin misin?</p>
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

const styles = { gridContainer: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "24px", paddingBottom: "40px" }};