import "./ContentCard.css";

export default function ContentCard({ data, onClick, onToggleWatched, isWatched }) {
    return (
        <div className="content-card" onClick={() => onClick(data)}>
            <img src={data.poster} alt={data.title} className="card-poster" loading="lazy" />

            {data.addedBy && (
                <div className="added-by-badge">
                    <i className="fa-solid fa-user-pen"></i> {data.addedBy}
                </div>
            )}

            <div className="card-overlay">
                <h3 className="card-title">{data.title}</h3>
                <div className="card-info" style={{ flexWrap: "wrap" }}>
                    <span>{data.year}</span>

                    {data.duration && <span>• ⏱️ {data.duration}</span>}
                    {data.seasons && <span>• 📺 {data.seasons} Sezon</span>}

                    <div className="rating-badge">
                        <i className="fa-solid fa-star"></i> {data.rating ? data.rating.toFixed(1) : "-"}
                    </div>
                    {data.genres && data.genres.length > 0 && (
                        <div className="card-genres" style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '10px' }}>
                            {data.genres.map((genre, index) => (
                                <span key={index} style={{
                                    background: 'rgba(192, 132, 252, 0.2)',
                                    color: 'var(--accent-color)',
                                    padding: '3px 8px',
                                    borderRadius: '12px',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold'
                                }}>
                                    {genre}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <p className="card-overview">
                    {data.overview}
                </p>

                <button
                    className={`watched-btn ${isWatched ? 'is-watched' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleWatched(data.id);
                    }}
                    title={isWatched ? "İzlenecekler listesine geri al" : "İzledim olarak işaretle"}
                >
                    <i className={`fa-solid ${isWatched ? 'fa-rotate-left' : 'fa-check'}`}></i>
                    {isWatched ? " Geri Al" : " İzledim"}
                </button>
            </div>
        </div>
    );
}