import { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import "./Diary.css";

export default function Diary() {
    const [notes, setNotes] = useState([]);
    const [galleryPhotos, setGalleryPhotos] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modallar
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [selectedNote, setSelectedNote] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);

    // YENİ: Link Ekleme Modalı State'leri
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState("");
    const [linkName, setLinkName] = useState("");

    // Form Stateleri
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [tag, setTag] = useState("Genel");
    const [imageUrl, setImageUrl] = useState("");
    const [attachments, setAttachments] = useState([]);

    // Fotoğraf/Kapak Seçici Stateleri
    const [uploadFile, setUploadFile] = useState(null);
    const [showGalleryPicker, setShowGalleryPicker] = useState(false);
    const [galleryTarget, setGalleryTarget] = useState("cover");
    const [isUploading, setIsUploading] = useState(false);

    const currentUser = localStorage.getItem("currentUser") || "Bilinmiyor";

    useEffect(() => {
        const q = query(collection(db, "diary"), orderBy("createdAt", "desc"));
        const unsubDiary = onSnapshot(q, (snapshot) => {
            setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });

        const unsubGallery = onSnapshot(collection(db, "gallery"), (snapshot) => {
            const photos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(p => p.type !== "video");
            setGalleryPhotos(photos);
        });

        return () => { unsubDiary(); unsubGallery(); };
    }, []);

    const openFormModal = (note = null) => {
        if (note) {
            setSelectedNote(note);
            setTitle(note.title || "");
            setContent(note.content || "");
            setTag(note.tag || "Genel");
            setImageUrl(note.imageUrl || "");
            setAttachments(note.attachments || []);
        } else {
            setSelectedNote(null);
            setTitle(""); setContent(""); setTag("Genel"); setImageUrl(""); setAttachments([]);
        }
        setUploadFile(null);
        setShowGalleryPicker(false);
        setIsFormOpen(true);
        setIsViewOpen(false);
    };

    const closeFormModal = () => {
        setIsFormOpen(false);
        setSelectedNote(null);
    };

    const openViewModal = (note) => {
        setSelectedNote(note);
        setIsViewOpen(true);
    };

    // --- EKLER (ATTACHMENTS) İÇİN YARDIMCI FONKSİYONLAR ---

    // YENİ: Tarayıcı alert'i yerine şık modalı açar
    const openLinkModal = () => {
        setLinkUrl("");
        setLinkName("");
        setIsLinkModalOpen(true);
    };

    // YENİ: Link modalından gelen veriyi kaydeder
    const confirmAddLink = (e) => {
        e.preventDefault();
        if (!linkUrl.trim()) return;

        setAttachments(prev => [...prev, {
            id: Date.now().toString(),
            type: 'link',
            url: linkUrl,
            name: linkName.trim() || "İnternet Bağlantısı"
        }]);
        setIsLinkModalOpen(false);
    };

    const handleFileAttachmentChange = (e) => {
        const files = Array.from(e.target.files);
        const newAttachments = files.map(f => ({
            id: Date.now().toString() + Math.random().toString(),
            type: f.type.startsWith('image/') ? 'image' : 'file',
            name: f.name,
            fileObj: f
        }));
        setAttachments(prev => [...prev, ...newAttachments]);
        e.target.value = null;
    };

    const removeAttachment = (idToRemove) => {
        setAttachments(prev => prev.filter(att => att.id !== idToRemove));
    };

    // --- KAYDETME İŞLEMİ (EKLERİ YÜKLEME DAHİL) ---
    const handleSaveNote = async (e) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) return;

        setIsUploading(true);
        try {
            let finalImageUrl = imageUrl;
            if (uploadFile) {
                const uniqueFileName = `${Date.now()}_cover_${uploadFile.name}`;
                const storageRef = ref(storage, `diary/${uniqueFileName}`);
                const uploadTask = await uploadBytesResumable(storageRef, uploadFile);
                finalImageUrl = await getDownloadURL(uploadTask.ref);
            }

            const processedAttachments = await Promise.all(attachments.map(async (att) => {
                if (att.fileObj) {
                    const uniqueAttName = `${Date.now()}_att_${att.fileObj.name}`;
                    const attRef = ref(storage, `diary_attachments/${uniqueAttName}`);
                    const uploadTask = await uploadBytesResumable(attRef, att.fileObj);
                    const downloadUrl = await getDownloadURL(uploadTask.ref);

                    return { id: att.id, type: att.type, name: att.name, url: downloadUrl };
                }
                return att;
            }));

            const noteData = {
                title, content, tag,
                imageUrl: finalImageUrl,
                attachments: processedAttachments,
                updatedAt: Date.now()
            };

            if (selectedNote) {
                await updateDoc(doc(db, "diary", selectedNote.id), noteData);
            } else {
                await addDoc(collection(db, "diary"), {
                    ...noteData,
                    addedBy: currentUser,
                    createdAt: Date.now()
                });
            }
            closeFormModal();
        } catch (error) {
            console.error("Not kaydedilemedi:", error);
        } finally {
            setIsUploading(false);
        }
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await deleteDoc(doc(db, "diary", itemToDelete));
            setItemToDelete(null);
            setIsViewOpen(false);
        } catch (error) { console.error("Silinemedi:", error); }
    };

    const getTagIcon = (t) => {
        switch(t) {
            case "Seyahat": return "fa-plane";
            case "Tarif": return "fa-utensils";
            case "Anı": return "fa-heart";
            case "Plan": return "fa-calendar-check";
            default: return "fa-bookmark";
        }
    };

    return (
        <div className="diary-container">
            <div className="todo-header">
                <h2>📓 Not Defteri</h2>
                <p>Her şeyin not edilebileceği ve ek ekleyebileceğin bir bölüm...</p>
            </div>

            {loading ? (
                <div style={{ textAlign: "center", padding: "50px", color: "var(--accent-color)" }}><i className="fa-solid fa-spinner fa-spin fa-2x"></i></div>
            ) : notes.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>
                    <i className="fa-solid fa-book-open" style={{ fontSize: "3rem", marginBottom: "15px", opacity: 0.5 }}></i>
                    <p>İlk sayfayı yazma zamanı geldi!</p>
                </div>
            ) : (
                <div className="diary-grid">
                    {notes.map(note => (
                        <div key={note.id} className="diary-card" onClick={() => openViewModal(note)}>
                            {note.imageUrl && (
                                <div className="diary-card-cover">
                                    <img src={note.imageUrl} alt={note.title} />
                                </div>
                            )}
                            <div className="diary-card-content">
                                <div className="diary-card-tag"><i className={`fa-solid ${getTagIcon(note.tag)}`}></i> {note.tag}</div>
                                <h3>{note.title}</h3>
                                <p className="diary-card-snippet">{note.content}</p>
                                <div className="diary-card-footer">
                                    <div style={{display: 'flex', gap: '8px'}}>
                                        <span>{new Date(note.createdAt).toLocaleDateString('tr-TR')}</span>
                                        {note.attachments && note.attachments.length > 0 && (
                                            <span style={{color: 'var(--accent-color)'}}><i className="fa-solid fa-paperclip"></i> {note.attachments.length}</span>
                                        )}
                                    </div>
                                    <span style={{textTransform: 'capitalize'}}>{note.addedBy}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <button className="fab-add-btn" onClick={() => openFormModal()} title="Yeni Not Ekle"><i className="fa-solid fa-pen"></i></button>

            {/* NOT OKUMA EKRANI (VIEW MODAL) */}
            {isViewOpen && selectedNote && (
                <div className="modal-overlay" onClick={() => setIsViewOpen(false)}>
                    <div className="diary-view-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="close-modal-btn" onClick={() => setIsViewOpen(false)}><i className="fa-solid fa-xmark"></i></button>

                        {selectedNote.imageUrl && (
                            <img src={selectedNote.imageUrl} alt={selectedNote.title} className="diary-view-cover" />
                        )}

                        <div className="diary-view-body">
                            <div className="diary-view-meta">
                                <span className="diary-card-tag"><i className={`fa-solid ${getTagIcon(selectedNote.tag)}`}></i> {selectedNote.tag}</span>
                                <span className="diary-view-date"><i className="fa-regular fa-calendar"></i> {new Date(selectedNote.createdAt).toLocaleDateString('tr-TR')} - <b>{selectedNote.addedBy}</b> yazdı</span>
                            </div>

                            <h2 className="diary-view-title">{selectedNote.title}</h2>

                            <div className="diary-view-text">
                                {selectedNote.content.split('\n').map((paragraph, idx) => (
                                    <p key={idx}>{paragraph}</p>
                                ))}
                            </div>

                            {selectedNote.attachments && selectedNote.attachments.length > 0 && (
                                <div className="diary-view-attachments-section">
                                    <h4 className="attachments-title"><i className="fa-solid fa-paperclip"></i> Ekler</h4>
                                    <div className="attachments-display-grid">
                                        {selectedNote.attachments.map(att => (
                                            <a key={att.id} href={att.url || '#'} target="_blank" rel="noopener noreferrer" className={`attachment-display-card ${att.type}`}>
                                                <div className="att-display-icon">
                                                    {att.type === 'link' ? <i className="fa-solid fa-link"></i> :
                                                        att.type === 'image' ? <i className="fa-solid fa-image"></i> :
                                                            <i className="fa-solid fa-file-lines"></i>}
                                                </div>
                                                <div className="att-display-info">
                                                    <span className="att-display-name">{att.name}</span>
                                                    <span className="att-display-type">
                                                        {att.type === 'link' ? 'Bağlantıya Git' : att.type === 'image' ? 'Görseli Büyüt' : 'Dosyayı İndir'}
                                                    </span>
                                                </div>
                                                <i className="fa-solid fa-arrow-up-right-from-square external-icon"></i>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="diary-view-actions">
                                <button className="edit-btn" onClick={() => openFormModal(selectedNote)}>
                                    <i className="fa-solid fa-pen"></i> Düzenle
                                </button>
                                <button className="delete-btn" onClick={() => setItemToDelete(selectedNote.id)}>
                                    <i className="fa-solid fa-trash-can"></i> Sil
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* NOT EKLEME / DÜZENLEME EKRANI */}
            {isFormOpen && (
                <div className="modal-overlay" onClick={() => !isUploading && closeFormModal()}>
                    <div className="add-todo-modal diary-form-modal" onClick={(e) => e.stopPropagation()}>
                        {!isUploading && <button className="close-modal-btn" onClick={closeFormModal}><i className="fa-solid fa-xmark"></i></button>}
                        <div className="add-todo-header"><h3>{selectedNote ? "Notu Düzenle" : "Yeni Bir Sayfa Aç"}</h3></div>

                        <form onSubmit={handleSaveNote} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div className="add-todo-grid" style={{ gridTemplateColumns: '1fr 3fr' }}>
                                <div>
                                    <select className="todo-select" value={tag} onChange={(e) => setTag(e.target.value)} disabled={isUploading} style={{height: '100%'}}>
                                        <option value="Genel">📝 Genel</option>
                                        <option value="Seyahat">✈️ Seyahat</option>
                                        <option value="Tarif">🍳 Tarif</option>
                                        <option value="Anı">💖 Anı</option>
                                        <option value="Plan">📅 Plan</option>
                                    </select>
                                </div>
                                <div>
                                    <input type="text" className="add-todo-input" placeholder="Başlık *" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={isUploading} style={{width: '100%', boxSizing: 'border-box'}} />
                                </div>
                            </div>

                            <textarea
                                className="add-todo-input add-todo-textarea"
                                placeholder="Dilediğin gibi yaz..."
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                required
                                disabled={isUploading}
                                style={{ minHeight: '150px' }}
                            />

                            {/* EKLER BÖLÜMÜ YÖNETİMİ */}
                            <div className="attachments-manager">
                                <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>
                                    <i className="fa-solid fa-paperclip"></i> Eklenen Dosyalar ve Bağlantılar
                                </label>

                                {attachments.length > 0 && (
                                    <div className="attachments-list">
                                        {attachments.map(att => (
                                            <div key={att.id} className="attachment-item">
                                                <div className="att-icon">
                                                    {att.type === 'link' ? <i className="fa-solid fa-link" style={{color: '#3b82f6'}}></i> :
                                                        att.type === 'image' ? <i className="fa-solid fa-image" style={{color: '#10b981'}}></i> :
                                                            <i className="fa-solid fa-file-lines" style={{color: '#f59e0b'}}></i>}
                                                </div>
                                                <div className="att-name">{att.name}</div>
                                                <button type="button" className="att-remove" onClick={() => removeAttachment(att.id)} disabled={isUploading}>
                                                    <i className="fa-solid fa-xmark"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="attachments-actions">
                                    <button type="button" className="add-mini-btn" onClick={openLinkModal} disabled={isUploading}>
                                        <i className="fa-solid fa-link"></i> Link Ekle
                                    </button>
                                    <label className="add-mini-btn" style={{ cursor: 'pointer', margin: 0 }}>
                                        <i className="fa-solid fa-file-arrow-up"></i> Dosya / Fotoğraf Yükle
                                        <input type="file" multiple style={{ display: "none" }} onChange={handleFileAttachmentChange} disabled={isUploading} />
                                    </label>
                                    <button type="button" className="add-mini-btn" onClick={() => {setGalleryTarget("attachment"); setShowGalleryPicker(true);}} disabled={isUploading}>
                                        <i className="fa-solid fa-images"></i> Galeriden Seç
                                    </button>
                                </div>
                            </div>

                            {/* KAPAK FOTOĞRAFI SEÇİMİ */}
                            <div className="image-selection-area" style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '15px' }}>
                                <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "block", marginBottom: "5px" }}>
                                    Kapak Fotoğrafı (İsteğe bağlı)
                                </label>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <input type="url" className="add-todo-input" placeholder="Görsel Linki..." value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setUploadFile(null); }} style={{ flex: 1, minWidth: '130px', margin: 0 }} disabled={isUploading || uploadFile !== null} />
                                    <button type="button" className="add-mini-btn" onClick={() => {setGalleryTarget("cover"); setShowGalleryPicker(true);}} disabled={isUploading}>
                                        <i className="fa-solid fa-images"></i> Galeriden
                                    </button>
                                    <label className="add-mini-btn" style={{ cursor: 'pointer', margin: 0 }}>
                                        <i className="fa-solid fa-upload"></i> Cihazdan
                                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { if(e.target.files[0]) { setUploadFile(e.target.files[0]); setImageUrl(""); setShowGalleryPicker(false); } }} disabled={isUploading} />
                                    </label>
                                </div>

                                {uploadFile && (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span><i className="fa-solid fa-file-image"></i> {uploadFile.name}</span>
                                        <button type="button" onClick={() => setUploadFile(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}><i className="fa-solid fa-xmark"></i></button>
                                    </div>
                                )}
                            </div>

                            {/* GALERİ SEÇİCİ KUTUSU */}
                            {showGalleryPicker && (
                                <div className="gallery-picker-container" style={{ marginTop: '0' }}>
                                    <div className="gallery-picker-grid">
                                        {galleryPhotos.map(photo => (
                                            <div key={photo.id} className="gallery-picker-item" onClick={() => {
                                                if (galleryTarget === "cover") {
                                                    setImageUrl(photo.url);
                                                } else {
                                                    setAttachments(prev => [...prev, { id: Date.now().toString(), type: 'image', url: photo.url, name: 'Galeriden Görsel' }]);
                                                }
                                                setShowGalleryPicker(false);
                                            }}>
                                                <img src={photo.url} alt="Galeri" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button type="submit" className="add-todo-submit" disabled={isUploading}>
                                {isUploading ? <><i className="fa-solid fa-spinner fa-spin"></i> Ekler Yükleniyor ve Kaydediliyor...</> : <><i className="fa-solid fa-check"></i> Sayfayı Kaydet</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* YENİ: LINK EKLEME MODALI */}
            {isLinkModalOpen && (
                <div className="modal-overlay" onClick={() => setIsLinkModalOpen(false)} style={{ zIndex: 9999 }}>
                    <div className="add-todo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <button className="close-modal-btn" onClick={() => setIsLinkModalOpen(false)}>
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                        <div className="add-todo-header"><h3>🔗 Bağlantı Ekle</h3><p>Eklemek istediğiniz URL'yi girin.</p></div>

                        <form onSubmit={confirmAddLink} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "5px", display: "block" }}>Bağlantı URL'si *</label>
                                <input
                                    type="url"
                                    className="add-todo-input"
                                    placeholder="https://..."
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    required
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "5px", display: "block" }}>Bağlantı Başlığı (İsteğe Bağlı)</label>
                                <input
                                    type="text"
                                    className="add-todo-input"
                                    placeholder="Örn: Gideceğimiz Otel"
                                    value={linkName}
                                    onChange={(e) => setLinkName(e.target.value)}
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                            </div>
                            <button type="submit" className="add-todo-submit"><i className="fa-solid fa-plus"></i> Eklere İlave Et</button>
                        </form>
                    </div>
                </div>
            )}

            {/* SİLME ONAY MODALI */}
            {itemToDelete && (
                <div className="confirm-overlay" onClick={() => setItemToDelete(null)}>
                    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
                        <h3>Emin misin?</h3>
                        <p>Bu notu kalıcı olarak silmek istediğine emin misin?</p>
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