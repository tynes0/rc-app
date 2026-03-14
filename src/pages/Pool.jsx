import { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import "./Pool.css";

export default function Pool() {
    const [poolQueue, setPoolQueue] = useState([]);
    const [myPoolItems, setMyPoolItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [animationClass, setAnimationClass] = useState("");

    // YENİ: Silinecek öğe için state
    const [itemToDelete, setItemToDelete] = useState(null);

    const currentUser = localStorage.getItem("currentUser") || "Bilinmiyor";

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "pool"), (snapshot) => {
            const poolItems = snapshot.docs.map(doc => ({
                ...doc.data(),
                firebaseId: doc.id
            }));

            // Partnerin ekledikleri (Senin Oylayacakların)
            const othersItems = poolItems.filter(item => item.addedBy !== currentUser);
            // Senin eklediklerin (Partnerinin Oylayacakları)
            const myItems = poolItems.filter(item => item.addedBy === currentUser);

            setPoolQueue(othersItems);
            setMyPoolItems(myItems);
            setLoading(false);
        }, (error) => {
            console.error("Havuz dinlenirken hata:", error);
            setLoading(false);
        });

        return () => unsub();
    }, [currentUser]);

    // YENİ: Modal açıkken arka planın kaymasını engelle (Diğer sayfalardaki gibi)
    useEffect(() => {
        if (itemToDelete) {
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
    }, [itemToDelete]);

    // YENİ: Sadece state'i güncelliyoruz, silme işlemini onay butonuna bırakıyoruz
    const handleDeleteMyItem = (firebaseId) => {
        setItemToDelete(firebaseId);
    };

    // YENİ: Gerçek silme işlemini yapan fonksiyon
    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await deleteDoc(doc(db, "pool", itemToDelete));
            setItemToDelete(null); // Başarılı olursa pop-up'ı kapat
        } catch (error) {
            console.error("Silinirken hata:", error);
        }
    };

    const handleSelectUpcoming = (firebaseId) => {
        setPoolQueue(prevQueue => {
            const selectedIndex = prevQueue.findIndex(item => item.firebaseId === firebaseId);
            if (selectedIndex <= 0) return prevQueue;

            const newQueue = [...prevQueue];
            const selectedItem = newQueue.splice(selectedIndex, 1)[0];
            newQueue.unshift(selectedItem);
            return newQueue;
        });
    };

    const handleSwipe = async (direction) => {
        if (animationClass !== "" || poolQueue.length === 0) return;

        const currentCard = poolQueue[0];
        setAnimationClass(direction === "right" ? "swipe-out-right" : "swipe-out-left");

        setTimeout(async () => {
            try {
                if (direction === "right") {
                    const targetCollection = currentCard.mediaType === "tv" ? "series" : "movies";
                    const { firebaseId, ...cardDataToSave } = currentCard;
                    const newItem = {
                        ...cardDataToSave,
                        isWatched: false,
                        listType: "liste",
                        approvedBy: currentUser
                    };
                    await addDoc(collection(db, targetCollection), newItem);
                }
                await deleteDoc(doc(db, "pool", currentCard.firebaseId));
            } catch (error) {
                console.error("İşlem sırasında hata:", error);
            }
            setAnimationClass("");
        }, 400);
    };

    if (loading) {
        return (
            <div className="pool-container">
                <i className="fa-solid fa-spinner fa-spin fa-3x" style={{color: "var(--accent-color)"}}></i>
            </div>
        );
    }

    return (
        <div className="pool-container">
            <div className="pool-header">
                <h2>🤝 Dizi-Film Tinder</h2>
                <p>Listeye eklemeye emin olamadığı dizi-filmleri buraya gönderdi. Listeye ekle veya sil.</p>
            </div>

            {poolQueue.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", margin: "40px 0" }}>
                    <i className="fa-solid fa-ghost" style={{ fontSize: "4rem", marginBottom: "20px" }}></i>
                    <h2>Seçilecek Bir Şey Yok!</h2>
                    <p>Sevgilin henüz yeni bir şey önermemiş veya her şeyi oyladın.</p>
                </div>
            ) : (
                <>
                    <div className="card-stack">
                        {poolQueue.slice(0, 3).reverse().map((card, idx) => {
                            const queueLength = Math.min(poolQueue.length, 3);
                            const isTop = idx === queueLength - 1;
                            const offset = queueLength - 1 - idx;

                            return (
                                <div
                                    key={card.firebaseId}
                                    className={`swipe-card ${isTop ? animationClass : ''}`}
                                    style={{
                                        transform: isTop ? '' : `scale(${1 - offset * 0.05}) translateY(${offset * 20}px)`,
                                        zIndex: 10 - offset,
                                        opacity: isTop ? 1 : 1 - offset * 0.3,
                                        boxShadow: isTop ? 'var(--card-shadow)' : '0 10px 20px rgba(0,0,0,0.4)',
                                        pointerEvents: isTop ? 'auto' : 'none'
                                    }}
                                >
                                    <img src={card.poster} alt={card.title} />
                                    <div className="pool-badge" style={{ backgroundColor: card.mediaType === 'movie' ? 'var(--accent-color)' : '#3b82f6' }}>
                                        {card.mediaType === "movie" ? "🎬 Film" : "📺 Dizi"}
                                    </div>

                                    <div className="swipe-info">
                                        <h3 style={{ textTransform: "capitalize", fontSize: "0.9rem", color: "#fbbf24", marginBottom: "5px" }}>
                                            {card.addedBy} Önerdi
                                        </h3>
                                        <h3>{card.title} ({card.year})</h3>
                                        <p style={{ marginBottom: "8px" }}>
                                            <i className="fa-solid fa-star" style={{color: "#facc15"}}></i>
                                            {" "}{card.rating ? card.rating.toFixed(1) : "-"} Puan
                                        </p>
                                        <p style={{ fontSize: "0.85rem", opacity: 0.9, fontWeight: "500", borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: "8px" }}>
                                            ⏱️ Süre: {card.duration || "Bilinmiyor"}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="swipe-actions">
                        <button className="action-btn btn-nope" onClick={() => handleSwipe("left")} title="İzlemek İstemiyorum">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                        <button className="action-btn btn-like" onClick={() => handleSwipe("right")} title="Listeye Ekle">
                            <i className="fa-solid fa-heart"></i>
                        </button>
                    </div>

                    {poolQueue.length > 1 && (
                        <div style={{ marginTop: '40px', padding: '15px', background: 'var(--sidebar-bg)', borderRadius: '15px', border: '1px solid var(--border-color)', width: '100%', maxWidth: '600px' }}>
                            <h4 style={{ marginBottom: '15px', color: 'var(--text-main)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fa-solid fa-layer-group"></i> Sıradaki Öneriler ({poolQueue.length - 1})
                            </h4>
                            <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }} className="custom-scrollbar">
                                {poolQueue.slice(1).map(item => (
                                    <div
                                        key={item.firebaseId}
                                        className="upcoming-item"
                                        onClick={() => handleSelectUpcoming(item.firebaseId)}
                                        title={`${item.title} (Öne Al)`}
                                    >
                                        <img src={item.poster} alt={item.title} />
                                        <div className="upcoming-title">{item.title}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* SENİN EKLERİN: GERİ ÇEKME ÖZELLİĞİ */}
            {myPoolItems.length > 0 && (
                <div className="my-pool-items-wrapper">
                    <h3 style={{ marginBottom: '10px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <i className="fa-solid fa-paper-plane" style={{color: 'var(--accent-color)'}}></i> Havuza Gönderdiklerim
                    </h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px' }}>Sevgilinin oylamasını bekleyen kendi önerilerin.</p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '15px' }}>
                        {myPoolItems.map(item => (
                            <div key={item.firebaseId} style={{ background: 'var(--sidebar-bg)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                                <img src={item.poster} alt={item.title} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                                <div style={{ padding: '12px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <h4 style={{ fontSize: '0.85rem', marginBottom: '15px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'var(--text-main)' }}>{item.title}</h4>
                                    <button
                                        onClick={() => handleDeleteMyItem(item.firebaseId)}
                                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '8px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', width: '100%', fontWeight: 'bold' }}
                                    >
                                        <i className="fa-solid fa-trash-can"></i> Geri Çek
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* YENİ: SİLME ONAY MODALI (Sitenin diğer yerleriyle uyumlu) */}
            {itemToDelete && (
                <div className="confirm-overlay" onClick={() => setItemToDelete(null)}>
                    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
                        <h3>Emin misin?</h3>
                        <p>Bu yapımı ortak havuzdan tamamen çekmek istediğine emin misin?</p>
                        <div className="confirm-actions">
                            <button className="confirm-btn confirm-cancel" onClick={() => setItemToDelete(null)}>İptal</button>
                            <button className="confirm-btn confirm-delete" onClick={confirmDelete}>Evet, Çek</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}