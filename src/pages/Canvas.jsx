import { useState, useEffect, useRef } from "react";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import Modal from "../components/Modal";
import "./Canvas.css";

const GRID_SIZE = 24; // 24x24 = 576 Piksel (Hem detaylı hem performanslı)
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE;

// Hızlı Seçim Renk Paleti
const PALETTE = [
    "#f5f5f5", // Beyaz
    "#fb7185", // Temamızın Pembesi
    "#ef4444", // Kırmızı
    "#f59e0b", // Turuncu/Sarı
    "#10b981", // Yeşil
    "#3b82f6", // Mavi
    "#8b5cf6", // Mor
    "eraser"   // Silgi (Şeffaf)
];

export default function Canvas() {
    const [pixels, setPixels] = useState(Array(TOTAL_PIXELS).fill(""));
    const [selectedColor, setSelectedColor] = useState(PALETTE[1]); // Varsayılan pembe
    const [isDrawing, setIsDrawing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Sürükleme esnasında gereksiz render'ları önlemek için yerel kopya
    const localPixels = useRef(Array(TOTAL_PIXELS).fill(""));

    const currentUser = localStorage.getItem("currentUser") || "Bilinmiyor";

    // Firebase'den ortak kanvası dinle
    useEffect(() => {
        const canvasRef = doc(db, "canvas", "shared");

        const unsub = onSnapshot(canvasRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPixels(data.pixels);
                localPixels.current = [...data.pixels];
            } else {
                // Eğer veritabanında henüz kanvas yoksa, boş bir tane oluştur
                setDoc(canvasRef, {
                    pixels: Array(TOTAL_PIXELS).fill(""),
                    lastUpdatedBy: "Sistem",
                    lastUpdatedAt: Date.now()
                });
            }
            setLoading(false);
        });

        return () => unsub();
    }, []);

    // Firebase'e kaydetme (Sadece fareyi/parmağı kaldırdığımızda tetiklenir)
    const saveToFirebase = async () => {
        try {
            const canvasRef = doc(db, "canvas", "shared");
            await updateDoc(canvasRef, {
                pixels: localPixels.current,
                lastUpdatedBy: currentUser,
                lastUpdatedAt: Date.now()
            });
        } catch (error) {
            console.error("Kanvas kaydedilemedi:", error);
        }
    };

    // --- ÇİZİM MANTIĞI ---
    const paintPixel = (index) => {
        if (localPixels.current[index] === selectedColor) return; // Zaten aynı renkse yorma

        const newColor = selectedColor === "eraser" ? "" : selectedColor;

        // Önce yerel referansı güncelle
        localPixels.current[index] = newColor;

        // Ekranda anında görünmesi için state'i güncelle
        setPixels([...localPixels.current]);
    };

    // PC: Fare İşlemleri
    const handleMouseDown = (index) => {
        setIsDrawing(true);
        paintPixel(index);
    };

    const handleMouseEnter = (index) => {
        if (isDrawing) paintPixel(index);
    };

    const handleMouseUp = () => {
        if (isDrawing) {
            setIsDrawing(false);
            saveToFirebase();
        }
    };

    // Mobil: Dokunmatik (Touch) İşlemleri
    const handleTouchStart = (e) => {
        setIsDrawing(true);
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (target && target.dataset.index) {
            paintPixel(Number(target.dataset.index));
        }
    };

    const handleTouchMove = (e) => {
        if (!isDrawing) return;
        const touch = e.touches[0];
        // Parmağın altındaki elementi bul (Mobil sürükleme için hayati önem taşır)
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (target && target.dataset.index) {
            paintPixel(Number(target.dataset.index));
        }
    };

    const handleTouchEnd = () => {
        if (isDrawing) {
            setIsDrawing(false);
            saveToFirebase();
        }
    };

    // Tümünü Temizle
    // Butona tıklandığında sadece modalı açar
    const handleClearClick = () => {
        setIsModalOpen(true);
    };

// Modalda "Evet" dendiğinde asıl silme işlemini yapar
    const confirmClear = () => {
        const empty = Array(TOTAL_PIXELS).fill("");
        localPixels.current = empty;
        setPixels(empty);
        saveToFirebase();
        setIsModalOpen(false); // Modalı kapat
    };

    return (
        <div className="canvas-container" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <div className="todo-header">
                <h2>🎨 Kanvas</h2>
                <p>Resim çiziyoruz. Ekrana dokun ve çiz!</p>
            </div>

            {loading ? (
                <div style={{ textAlign: "center", padding: "50px", color: "var(--accent-color)" }}>
                    <i className="fa-solid fa-spinner fa-spin fa-2x"></i>
                </div>
            ) : (
                <div className="canvas-workspace">

                    {/* RENK PALETİ */}
                    <div className="palette-tools">
                        <div className="color-picker-group">
                            {PALETTE.map((color, idx) => (
                                <button
                                    key={idx}
                                    className={`color-btn ${selectedColor === color ? "active" : ""}`}
                                    style={{ background: color === "eraser" ? "transparent" : color }}
                                    onClick={() => setSelectedColor(color)}
                                    title={color === "eraser" ? "Silgi" : "Renk Seç"}
                                >
                                    {color === "eraser" && <i className="fa-solid fa-eraser"></i>}
                                </button>
                            ))}
                            {/* Özel Renk Seçici (Color Input) */}
                            <div className="custom-color-wrapper">
                                <input
                                    type="color"
                                    className="custom-color-input"
                                    onChange={(e) => setSelectedColor(e.target.value)}
                                    title="Özel Renk Seç"
                                />
                                <i className="fa-solid fa-palette"></i>
                            </div>
                        </div>

                        <button className="clear-canvas-btn" onClick={handleClearClick}>
                            <i className="fa-solid fa-trash-can"></i> Temizle
                        </button>
                    </div>

                    {/* ÇİZİM TAHTASI (GRID) */}
                    <div className="canvas-board-wrapper">
                        <div
                            className="canvas-board"
                            style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            {pixels.map((color, index) => (
                                <div
                                    key={index}
                                    data-index={index}
                                    className="pixel-cell"
                                    style={{ backgroundColor: color || "transparent" }}
                                    onMouseDown={() => handleMouseDown(index)}
                                    onMouseEnter={() => handleMouseEnter(index)}
                                />
                            ))}
                        </div>
                    </div>

                </div>
            )}
            <Modal
                isOpen={isModalOpen}
                title="Kanvası Temizle"
                message="Bütün çizimi silmek istediğine emin misin? Bu işlem geri alınamaz."
                onConfirm={confirmClear}
                onCancel={() => setIsModalOpen(false)}
            />
        </div>
    );
}