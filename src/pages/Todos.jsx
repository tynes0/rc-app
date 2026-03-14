import { useState, useEffect } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import "./Todos.css";
import "./Movies.css";

export default function Todos() {
    const [todos, setTodos] = useState([]);
    const [newTask, setNewTask] = useState("");
    const [description, setDescription] = useState("");
    const [deadline, setDeadline] = useState("");
    const [category, setCategory] = useState("Alışveriş");
    const [priority, setPriority] = useState("Normal");
    const [assignee, setAssignee] = useState("Biz");

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("active");
    const [itemToDelete, setItemToDelete] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // YENİ: Görev Düzenleme State'leri
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTodo, setEditingTodo] = useState(null);

    const [showOnlyMine, setShowOnlyMine] = useState(false);
    const currentUser = localStorage.getItem("currentUser") || "Bilinmiyor";

    useEffect(() => {
        const q = query(collection(db, "todos"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const todosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTodos(todosData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (isAddModalOpen || isEditModalOpen || itemToDelete) {
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
    }, [isAddModalOpen, isEditModalOpen, itemToDelete]);

    const handleAddTodo = async (e) => {
        e.preventDefault();
        if (!newTask.trim()) return;

        try {
            await addDoc(collection(db, "todos"), {
                text: newTask.trim(),
                description: description.trim(),
                deadline: deadline,
                isCompleted: false,
                addedBy: currentUser,
                category: category,
                priority: priority,
                assignee: assignee,
                createdAt: Date.now()
            });
            setIsAddModalOpen(false);
            setNewTask(""); setDescription(""); setDeadline(""); setPriority("Normal"); setCategory("Alışveriş"); setAssignee("Biz");
        } catch (error) {
            console.error("Görev eklenirken hata:", error);
        }
    };

    // YENİ: Görevi Güncelleme Fonksiyonu
    const handleEditTodo = async (e) => {
        e.preventDefault();
        if (!editingTodo.text.trim()) return;

        try {
            await updateDoc(doc(db, "todos", editingTodo.id), {
                text: editingTodo.text.trim(),
                description: editingTodo.description.trim(),
                deadline: editingTodo.deadline,
                category: editingTodo.category,
                priority: editingTodo.priority,
                assignee: editingTodo.assignee
            });
            setIsEditModalOpen(false);
        } catch (error) {
            console.error("Görev güncellenirken hata:", error);
        }
    };

    const openEditModal = (todo) => {
        setEditingTodo({
            id: todo.id,
            text: todo.text || "",
            description: todo.description || "",
            deadline: todo.deadline || "",
            category: todo.category || "Alışveriş",
            priority: todo.priority || "Normal",
            assignee: todo.assignee || "Biz"
        });
        setIsEditModalOpen(true);
    };

    const fireConfetti = () => {
        const container = document.createElement("div");
        container.className = "confetti-container";
        document.body.appendChild(container);

        const emojis = ["🎉", "✨", "🔥", "💖", "🥳"];

        for (let i = 0; i < 40; i++) {
            const particle = document.createElement("div");
            particle.className = "confetti-particle";
            particle.innerText = emojis[Math.floor(Math.random() * emojis.length)];
            particle.style.left = Math.random() * 100 + "vw";
            particle.style.animationDuration = (Math.random() * 2 + 2) + "s";
            particle.style.fontSize = (Math.random() * 15 + 15) + "px";
            container.appendChild(particle);
        }

        setTimeout(() => document.body.removeChild(container), 4000);
    };

    const toggleComplete = async (id, currentStatus) => {
        try {
            if (!currentStatus) fireConfetti();
            await updateDoc(doc(db, "todos", id), { isCompleted: !currentStatus });
        } catch (error) { console.error("Güncellenirken hata:", error); }
    };

    const confirmDelete = async () => {
        try {
            await deleteDoc(doc(db, "todos", itemToDelete));
            setItemToDelete(null);
        } catch (error) { console.error("Silinirken hata:", error); }
    };

    const getDeadlineStatus = (dateString) => {
        if (!dateString) return null;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const taskDate = new Date(dateString); taskDate.setHours(0, 0, 0, 0);

        if (taskDate < today) return "overdue";
        if (taskDate.getTime() === today.getTime()) return "today";
        return "future";
    };

    const displayedTodos = todos.filter(todo => {
        if (activeTab === "active" && todo.isCompleted) return false;
        if (activeTab === "completed" && !todo.isCompleted) return false;
        if (showOnlyMine) {
            const isMyTask = todo.assignee.toLowerCase() === currentUser.toLowerCase() || todo.assignee === "Biz";
            if (!isMyTask) return false;
        }
        return true;
    });

    const totalTasks = todos.length;
    const completedTasks = todos.filter(t => t.isCompleted).length;
    const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    const getCategoryIcon = (cat) => {
        switch(cat) {
            case "Alışveriş": return "fa-cart-shopping";
            case "Ev": return "fa-house";
            case "Plan": return "fa-calendar-days";
            default: return "fa-thumbtack";
        }
    };

    return (
        <div className="todos-container">
            <div className="todo-header">
                <h2>📝 Yapılacaklar listesi</h2>
                <p>Eksikleri, planları organize et...</p>
            </div>

            <div className="progress-container">
                <div className="progress-header">
                    <span>Başarım Yüzdesi 🚀</span>
                    <span>% {progressPercent}</span>
                </div>
                <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "10px 0 0 0", textAlign: "center" }}>
                    {totalTasks === 0 ? "Henüz görev yok, hadi başlayalım!" : progressPercent === 100 ? "Harika! Bütün görevler tamamlandı! 🥳" : `${totalTasks} görevin ${completedTasks} tanesini hallettiniz.`}
                </p>
            </div>

            <div className="tabs-container" style={{ marginBottom: "30px", display: "flex", flexWrap: "wrap", alignItems: "center" }}>
                <button className={`tab-btn ${activeTab === "active" ? "active" : ""}`} onClick={() => setActiveTab("active")}><i className="fa-regular fa-circle"></i> Yapılacaklar</button>
                <button className={`tab-btn ${activeTab === "completed" ? "active" : ""}`} onClick={() => setActiveTab("completed")}><i className="fa-solid fa-circle-check"></i> Tamamlananlar</button>
                <button className={`filter-toggle-btn ${showOnlyMine ? "active" : ""}`} onClick={() => setShowOnlyMine(!showOnlyMine)} title="Sadece senin yapman gereken ve ortak görevleri gösterir">
                    <i className="fa-solid fa-filter"></i> Sadece Benimkiler
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--accent-color)" }}><i className="fa-solid fa-spinner fa-spin fa-2x"></i></div>
            ) : displayedTodos.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>
                    <i className="fa-solid fa-clipboard-check" style={{ fontSize: "3rem", marginBottom: "15px", opacity: 0.5 }}></i>
                    <p>Görev bulunamadı. Temiz bir sayfa!</p>
                </div>
            ) : (
                <div className="todo-list">
                    {displayedTodos.map((todo) => {
                        const isMyTask = todo.assignee.toLowerCase() === currentUser.toLowerCase() || todo.assignee === "Biz";
                        const isDimmed = !isMyTask && !todo.isCompleted;
                        const isUrgent = todo.priority === "Acil" && !todo.isCompleted;
                        const dlStatus = getDeadlineStatus(todo.deadline);

                        let taskClasses = "todo-item";
                        if (todo.isCompleted) taskClasses += " completed";
                        else {
                            if (isUrgent) taskClasses += " urgent-task";
                            if (isDimmed) taskClasses += " dimmed-task";
                            else if (isMyTask) taskClasses += " my-task";
                        }

                        return (
                            <div key={todo.id} className={taskClasses}>
                                <div className={`todo-checkbox ${todo.isCompleted ? 'checked' : ''}`} onClick={() => toggleComplete(todo.id, todo.isCompleted)}>
                                    <i className="fa-solid fa-check"></i>
                                </div>

                                <div className="todo-content">
                                    <span className="todo-text">{todo.text}</span>
                                    {todo.description && <div className="todo-description">{todo.description}</div>}

                                    <div className="todo-details" style={{ marginTop: "5px" }}>
                                        {todo.deadline && !todo.isCompleted && (
                                            <span className={`detail-badge deadline-badge ${dlStatus === 'overdue' ? 'deadline-overdue' : dlStatus === 'today' ? 'deadline-today' : ''}`}>
                                                <i className="fa-regular fa-clock"></i>
                                                {dlStatus === 'overdue' ? "Süresi Geçti!" : dlStatus === 'today' ? "Son Gün Bugün!" : new Date(todo.deadline).toLocaleDateString('tr-TR')}
                                            </span>
                                        )}
                                        <span className={`detail-badge priority-${todo.priority}`}><i className="fa-solid fa-circle" style={{fontSize: "8px"}}></i> {todo.priority}</span>
                                        <span className={`detail-badge cat-${todo.category}`}><i className={`fa-solid ${getCategoryIcon(todo.category)}`}></i> {todo.category}</span>
                                        <span className="detail-badge assignee-badge"><i className="fa-solid fa-user"></i> <b style={{textTransform: "capitalize"}}>{todo.assignee}</b></span>
                                    </div>
                                </div>

                                <div className="todo-meta" style={{ flexDirection: "column", alignItems: "flex-end", gap: "8px", minWidth: "60px" }}>
                                    {/* YENİ: Butonlar yan yana */}
                                    <div style={{ display: "flex", gap: "10px" }}>
                                        <button className="todo-delete" style={{ color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer", fontSize: "1.1rem" }} onClick={() => openEditModal(todo)} title="Görevi Düzenle">
                                            <i className="fa-solid fa-pen" style={{ transition: "color 0.2s" }} onMouseOver={e => e.target.style.color="var(--accent-color)"} onMouseOut={e => e.target.style.color=""}></i>
                                        </button>
                                        <button className="todo-delete" onClick={() => setItemToDelete(todo.id)} title="Görevi Sil">
                                            <i className="fa-solid fa-trash-can"></i>
                                        </button>
                                    </div>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Ekleyen: <b style={{textTransform: "capitalize"}}>{todo.addedBy}</b></span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <button className="fab-add-btn" onClick={() => setIsAddModalOpen(true)} title="Yeni Görev Ekle"><i className="fa-solid fa-plus"></i></button>

            {/* EKLEME MODALI */}
            {isAddModalOpen && (
                <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
                    <div className="add-todo-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="close-modal-btn" onClick={() => setIsAddModalOpen(false)}><i className="fa-solid fa-xmark"></i></button>
                        <div className="add-todo-header"><h3>Yeni Görev Ekle</h3><p>Listeye detaylı bir görev ekle.</p></div>
                        <form onSubmit={handleAddTodo} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input type="text" className="add-todo-input" placeholder="Ne yapılması gerekiyor? *" value={newTask} onChange={(e) => setNewTask(e.target.value)} required autoFocus />
                            <textarea className="add-todo-input add-todo-textarea" placeholder="Notlar, detaylar veya alınacak alt öğeler (İsteğe bağlı)..." value={description} onChange={(e) => setDescription(e.target.value)} />
                            <div className="add-todo-grid">
                                <select className="todo-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                                    <option value="Alışveriş">🛒 Alışveriş</option><option value="Ev">🏠 Ev İşleri</option><option value="Plan">📅 Plan/Etkinlik</option><option value="Diğer">💡 Diğer</option>
                                </select>
                                <select className="todo-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                                    <option value="Düşük">🔵 Düşük</option><option value="Normal">🟡 Normal</option><option value="Acil">🔴 Acil!</option>
                                </select>
                            </div>
                            <div className="add-todo-grid">
                                <select className="todo-select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                                    <option value="Biz">🤝 İkimiz (Biz)</option><option value="Cihan">👤 Sadece Cihan</option><option value="Rümeysa">👤 Sadece Rümeysa</option>
                                </select>
                                <input type="date" className="add-todo-input" style={{ padding: "8px 12px" }} value={deadline} onChange={(e) => setDeadline(e.target.value)} title="Hedef Tarih (İsteğe Bağlı)" />
                            </div>
                            <button type="submit" className="add-todo-submit"><i className="fa-solid fa-check"></i> Görevi Kaydet</button>
                        </form>
                    </div>
                </div>
            )}

            {/* YENİ: DÜZENLEME MODALI */}
            {isEditModalOpen && editingTodo && (
                <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
                    <div className="add-todo-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="close-modal-btn" onClick={() => setIsEditModalOpen(false)}><i className="fa-solid fa-xmark"></i></button>
                        <div className="add-todo-header"><h3>Görevi Düzenle</h3><p>Görevin detaylarını güncelle.</p></div>
                        <form onSubmit={handleEditTodo} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input type="text" className="add-todo-input" placeholder="Ne yapılması gerekiyor? *" value={editingTodo.text} onChange={(e) => setEditingTodo({...editingTodo, text: e.target.value})} required autoFocus />
                            <textarea className="add-todo-input add-todo-textarea" placeholder="Notlar, detaylar..." value={editingTodo.description} onChange={(e) => setEditingTodo({...editingTodo, description: e.target.value})} />
                            <div className="add-todo-grid">
                                <select className="todo-select" value={editingTodo.category} onChange={(e) => setEditingTodo({...editingTodo, category: e.target.value})}>
                                    <option value="Alışveriş">🛒 Alışveriş</option><option value="Ev">🏠 Ev İşleri</option><option value="Plan">📅 Plan/Etkinlik</option><option value="Diğer">💡 Diğer</option>
                                </select>
                                <select className="todo-select" value={editingTodo.priority} onChange={(e) => setEditingTodo({...editingTodo, priority: e.target.value})}>
                                    <option value="Düşük">🔵 Düşük</option><option value="Normal">🟡 Normal</option><option value="Acil">🔴 Acil!</option>
                                </select>
                            </div>
                            <div className="add-todo-grid">
                                <select className="todo-select" value={editingTodo.assignee} onChange={(e) => setEditingTodo({...editingTodo, assignee: e.target.value})}>
                                    <option value="Biz">🤝 İkimiz (Biz)</option><option value="Cihan">👤 Sadece Cihan</option><option value="Rümeysa">👤 Sadece Rümeysa</option>
                                </select>
                                <input type="date" className="add-todo-input" style={{ padding: "8px 12px" }} value={editingTodo.deadline} onChange={(e) => setEditingTodo({...editingTodo, deadline: e.target.value})} />
                            </div>
                            <button type="submit" className="add-todo-submit"><i className="fa-solid fa-check"></i> Değişiklikleri Kaydet</button>
                        </form>
                    </div>
                </div>
            )}

            {itemToDelete && (
                <div className="confirm-overlay" onClick={() => setItemToDelete(null)}>
                    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
                        <h3>Emin misin?</h3>
                        <p>Bu görevi listeden tamamen silmek istediğine emin misin?</p>
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