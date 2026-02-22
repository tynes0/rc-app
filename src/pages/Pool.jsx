import { useState, useEffect } from "react";
// YENİ: onSnapshot (Canlı veri), addDoc (Rastgele ID) ve deleteDoc eklendi
import { collection, onSnapshot, addDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import "./Pool.css";

export default function Pool() {
    const [poolQueue, setPoolQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [animationClass, setAnimationClass] = useState("");
    const currentUser = localStorage.getItem("currentUser") || "Bilinmiyor";

    // 1. BULUTTAN HAVUZU CANLI DİNLE (onSnapshot)
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "pool"), (snapshot) => {
            // Firebase'in eşsiz ID'sini doc.id olarak objeye gömüyoruz
            const poolItems = snapshot.docs.map(doc => ({
                ...doc.data(),
                firebaseId: doc.id // Silme işlemi için gerçek Firebase ID'si
            }));

            // Benim eklemediklerimi al
            const filteredItems = poolItems.filter(item => item.addedBy !== currentUser);
            setPoolQueue(filteredItems);
            setLoading(false);
        }, (error) => {
            console.error("Havuz dinlenirken hata:", error);
            setLoading(false);
        });

        // Bileşen ekrandan gidince dinlemeyi bırak
        return () => unsub();
    }, [currentUser]);

    if (loading) {
        return (
            <div className="pool-container">
                <i className="fa-solid fa-spinner fa-spin fa-3x" style={{color: "var(--accent-color)"}}></i>
            </div>
        );
    }

    if (poolQueue.length === 0) {
        return (
            <div className="pool-container">
                <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    <i className="fa-solid fa-ghost" style={{ fontSize: "4rem", marginBottom: "20px" }}></i>
                    <h2>Havuz Boş!</h2>
                    <p>Partnerin henüz yeni bir şey önermemiş veya her şeyi oyladın.</p>
                </div>
            </div>
        );
    }

    const currentCard = poolQueue[0];

    // 2. KAYDIRMA İŞLEMİ VE VERİTABANI GÜNCELLEMESİ
    const handleSwipe = async (direction) => {
        // Zaten animasyon ve arka plan işlemi devam ediyorsa tekrar tıklanmasını engelle
        if (animationClass !== "") return;

        setAnimationClass(direction === "right" ? "swipe-out-right" : "swipe-out-left");

        setTimeout(async () => {
            try {
                // EĞER ONAYLANDIYSA (Sağa Kaydırma)
                if (direction === "right") {
                    // Film mi dizi mi kontrol et ve ilgili koleksiyona ekle
                    // Firebase'in ID ataması için addDoc kullanıyoruz
                    const targetCollection = currentCard.mediaType === "tv" ? "series" : "movies";

                    // firebaseId'yi kopyalamamak için ayıklıyoruz
                    const { firebaseId, ...cardDataToSave } = currentCard;

                    const newItem = {
                        ...cardDataToSave,
                        isWatched: false,
                        listType: "liste", // Havuzdan listeye geçti
                        approvedBy: currentUser // Kimin onayladığını da tutabiliriz
                    };

                    await addDoc(collection(db, targetCollection), newItem);
                    console.log(`✅ ${currentCard.title} listeye eklendi!`);
                }

                // HER HALÜKARDA HAVUZDAN SİL (Gerçek Firebase ID'si ile)
                await deleteDoc(doc(db, "pool", currentCard.firebaseId));

            } catch (error) {
                console.error("İşlem sırasında hata:", error);
            }

            setAnimationClass("");
        }, 400); // Animasyon süresi (0.4s)
    };

    return (
        <div className="pool-container">
            <div className="pool-header">
                <h2>🤝 Ortak Havuz</h2>
                <p>Partnerinin önerilerini oyla</p>
            </div>

            <div className="card-stack">
                <div className={`swipe-card ${animationClass}`}>
                    <img src={currentCard.poster} alt={currentCard.title} />

                    <div className="pool-badge" style={{ backgroundColor: currentCard.mediaType === 'movie' ? 'var(--accent-color)' : '#3b82f6' }}>
                        {currentCard.mediaType === "movie" ? "🎬 Film" : "📺 Dizi"}
                    </div>

                    <div className="swipe-info">
                        <h3 style={{ textTransform: "capitalize", fontSize: "0.9rem", color: "#fbbf24", marginBottom: "5px" }}>
                            {currentCard.addedBy} Önerdi
                        </h3>
                        <h3>{currentCard.title} ({currentCard.year})</h3>
                        <p style={{ marginBottom: "8px" }}>
                            <i className="fa-solid fa-star" style={{color: "#facc15"}}></i>
                            {" "}{currentCard.rating ? currentCard.rating.toFixed(1) : "-"} Puan
                        </p>

                        <p style={{ fontSize: "0.85rem", opacity: 0.9, fontWeight: "500", borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: "8px" }}>
                            ⏱️ Süre: {currentCard.duration || "Bilinmiyor"}
                        </p>
                    </div>
                </div>
            </div>

            <div className="swipe-actions">
                <button className="action-btn btn-nope" onClick={() => handleSwipe("left")} title="İzlemek İstemiyorum">
                    <i className="fa-solid fa-xmark"></i>
                </button>
                <button className="action-btn btn-like" onClick={() => handleSwipe("right")} title="Listeye Ekle">
                    <i className="fa-solid fa-heart"></i>
                </button>
            </div>
        </div>
    );
}