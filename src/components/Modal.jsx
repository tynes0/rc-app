import "./Modal.css";

export default function Modal({ isOpen, title, message, onConfirm, onCancel }) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-top-section">
                    <div className="modal-icon">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <div className="modal-content-text">
                        <h3>{title}</h3>
                        <p>{message}</p>
                    </div>
                </div>

                {/* Alt Kısım: Butonlar tam genişlikte */}
                <div className="modal-actions">
                    <button className="modal-btn-cancel" onClick={onCancel}>Vazgeç</button>
                    <button className="modal-btn-confirm" onClick={onConfirm}>Evet, Sil</button>
                </div>
            </div>
        </div>
    );
}