import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import { collection, addDoc, onSnapshot, deleteDoc, doc } from "firebase/firestore";
// YENİ: Firebase Storage importları
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase"; // storage eklendi
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./MemoryMap.css";

const customIcon = new L.divIcon({
    html: `<div style="color: var(--accent-color); font-size: 2.5rem; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.4)); line-height: 1; text-align: center;"><i class="fa-solid fa-location-dot"></i></div>`,
    className: "custom-leaflet-icon",
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

export default function MemoryMap() {
    const [memories, setMemories] = useState([]);

    // Galerideki fotoğrafları tutacak state
    const [galleryPhotos, setGalleryPhotos] = useState([]);
    const [showGalleryPicker, setShowGalleryPicker] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);

    const [title, setTitle] = useState("");
    const [note, setNote] = useState("");
    const [date, setDate] = useState("");
    const [imageUrl, setImageUrl] = useState("");

    // YENİ: Dosya Yükleme (Upload) State'leri
    const [uploadFile, setUploadFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const currentUser = localStorage.getItem("currentUser") || "Bilinmiyor";

    useEffect(() => {
        const unsubMemories = onSnapshot(collection(db, "memories"), (snapshot) => {
            setMemories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubGallery = onSnapshot(collection(db, "gallery"), (snapshot) => {
            const photos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(p => p.type !== "video");
            setGalleryPhotos(photos);
        });

        return () => { unsubMemories(); unsubGallery(); };
    }, []);

    const LocationPicker = () => {
        useMapEvents({
            click(e) {
                setSelectedLocation(e.latlng);
                setIsModalOpen(true);
            },
        });
        return null;
    };

    const handleSaveMemory = async (e) => {
        e.preventDefault();
        if (!selectedLocation || !title.trim()) return;

        setIsUploading(true); // Yükleme başladı

        try {
            let finalImageUrl = imageUrl;

            // YENİ: Eğer cihazdan bir dosya seçilmişse önce onu Firebase Storage'a yükle
            if (uploadFile) {
                const uniqueFileName = `${Date.now()}_${uploadFile.name}`;
                const storageRef = ref(storage, `memory_map/${uniqueFileName}`);

                const uploadTask = await uploadBytesResumable(storageRef, uploadFile);
                finalImageUrl = await getDownloadURL(uploadTask.ref); // Yüklenen dosyanın linkini al
            }

            // Anıyı Firestore'a kaydet
            await addDoc(collection(db, "memories"), {
                lat: selectedLocation.lat,
                lng: selectedLocation.lng,
                title: title,
                note: note,
                date: date,
                imageUrl: finalImageUrl, // İster link, ister galeriden, ister yeni yüklenen
                addedBy: currentUser,
                createdAt: Date.now()
            });

            closeModal();
        } catch (error) {
            console.error("Anı kaydedilemedi:", error);
        } finally {
            setIsUploading(false); // İşlem bitince yükleme durumunu kapat
        }
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await deleteDoc(doc(db, "memories", itemToDelete));
            setItemToDelete(null);
        } catch (error) { console.error("Silinemedi:", error); }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedLocation(null);
        setTitle(""); setNote(""); setDate(""); setImageUrl("");
        setShowGalleryPicker(false);
        setUploadFile(null); // Dosya seçimini de sıfırla
    };

    return (
        <div className="memory-map-container">
            <div className="todo-header">
                <h2>🗺️ Anı Haritası</h2>
                <p>Gittiğimiz yerler. Haritada boş bir yere tıklayarak yeni bir anı ekle! (Tüm dünyada bir yerlerden bir şeyler eklenir umarım)</p>
            </div>

            <div className="map-wrapper">
                <MapContainer center={[39.0, 35.0]} zoom={6} className="leaflet-map" scrollWheelZoom={true}>
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
                    />
                    <LocationPicker />

                    {memories.map(memory => (
                        <Marker key={memory.id} position={[memory.lat, memory.lng]} icon={customIcon}>
                            <Popup className="custom-popup">
                                <div className="memory-popup-content">
                                    {memory.imageUrl && <img src={memory.imageUrl} alt={memory.title} className="popup-img" />}
                                    <h3>{memory.title}</h3>
                                    {memory.date && <p className="popup-date"><i className="fa-regular fa-calendar"></i> {new Date(memory.date).toLocaleDateString('tr-TR')}</p>}
                                    {memory.note && <p className="popup-note">{memory.note}</p>}
                                    <div className="popup-footer">
                                        <span>- {memory.addedBy}</span>
                                        <button className="popup-delete-btn" onClick={() => setItemToDelete(memory.id)}>
                                            <i className="fa-solid fa-trash-can"></i> Sil
                                        </button>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>

            {isModalOpen && (
                <div className="modal-overlay" onClick={() => !isUploading && closeModal()}>
                    <div className="add-todo-modal" onClick={(e) => e.stopPropagation()}>
                        {!isUploading && (
                            <button className="close-modal-btn" onClick={closeModal}>
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        )}
                        <div className="add-todo-header"><h3>📍 Yeni Anı İşaretle</h3></div>

                        <form onSubmit={handleSaveMemory} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input type="text" className="add-todo-input" placeholder="Mekan Adı veya Başlık *" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={isUploading} />
                            <textarea className="add-todo-input add-todo-textarea" placeholder="Burada neler oldu?..." value={note} onChange={(e) => setNote(e.target.value)} disabled={isUploading} />
                            <input type="date" className="add-todo-input" value={date} onChange={(e) => setDate(e.target.value)} disabled={isUploading} />

                            {/* FOTOĞRAF SEÇİM ALANI */}
                            <div className="image-selection-area">
                                <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "5px", display: "block" }}>
                                    Fotoğraf Ekle
                                </label>

                                {/* 3 Seçenek Yanyana */}
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <input
                                        type="url"
                                        className="add-todo-input"
                                        placeholder="Görsel Linki..."
                                        value={imageUrl}
                                        onChange={(e) => {
                                            setImageUrl(e.target.value);
                                            setUploadFile(null); // Link girilirse dosyayı iptal et
                                        }}
                                        style={{ flex: 1, minWidth: '130px', margin: 0 }}
                                        disabled={isUploading || uploadFile !== null}
                                    />

                                    <button
                                        type="button"
                                        className="add-mini-btn"
                                        onClick={() => setShowGalleryPicker(!showGalleryPicker)}
                                        style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}
                                        disabled={isUploading}
                                    >
                                        <i className="fa-solid fa-images"></i> Galeriden
                                    </button>

                                    {/* YENİ: Doğrudan Cihazdan Yükleme Butonu */}
                                    <label className="add-mini-btn" style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', margin: 0 }}>
                                        <i className="fa-solid fa-upload"></i> Cihazdan
                                        <input
                                            type="file"
                                            accept="image/*"
                                            style={{ display: "none" }}
                                            onChange={(e) => {
                                                if(e.target.files[0]) {
                                                    setUploadFile(e.target.files[0]);
                                                    setImageUrl(""); // Dosya seçilirse linki temizle
                                                    setShowGalleryPicker(false);
                                                }
                                            }}
                                            disabled={isUploading}
                                        />
                                    </label>
                                </div>

                                {/* Eğer cihazdan bir dosya seçildiyse ufak bir bilgi göster */}
                                {uploadFile && (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span><i className="fa-solid fa-file-image"></i> Seçilen: {uploadFile.name}</span>
                                        <button type="button" onClick={() => setUploadFile(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}>
                                            <i className="fa-solid fa-xmark"></i> İptal
                                        </button>
                                    </div>
                                )}

                                {/* GALERİ SEÇİCİ KUTUSU */}
                                {showGalleryPicker && !uploadFile && (
                                    <div className="gallery-picker-container">
                                        {galleryPhotos.length === 0 ? (
                                            <p style={{color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "10px"}}>Ortak galerinizde henüz fotoğraf yok.</p>
                                        ) : (
                                            <div className="gallery-picker-grid">
                                                {galleryPhotos.map(photo => (
                                                    <div
                                                        key={photo.id}
                                                        className={`gallery-picker-item ${imageUrl === photo.url ? 'selected' : ''}`}
                                                        onClick={() => {
                                                            setImageUrl(photo.url);
                                                            setShowGalleryPicker(false);
                                                        }}
                                                    >
                                                        <img src={photo.url} alt="Galeri" />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <button type="submit" className="add-todo-submit" style={{marginTop: "5px"}} disabled={isUploading}>
                                {isUploading ? (
                                    <><i className="fa-solid fa-spinner fa-spin"></i> Yükleniyor ve Kaydediliyor...</>
                                ) : (
                                    <><i className="fa-solid fa-location-dot"></i> Haritaya İğnele</>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {itemToDelete && (
                <div className="confirm-overlay" onClick={() => setItemToDelete(null)}>
                    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
                        <h3>Emin misin?</h3>
                        <p>Bu anıyı haritadan tamamen silmek istediğine emin misin?</p>
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