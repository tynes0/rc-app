import { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import "./SearchMedia.css";

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

export default function SearchMedia() {
    const [query, setQuery] = useState("");
    const [activeQuery, setActiveQuery] = useState("");
    const [selectedGenre, setSelectedGenre] = useState("");
    const [mediaFilter, setMediaFilter] = useState("all");
    const [genresList, setGenresList] = useState([]);

    const [tmdbResults, setTmdbResults] = useState([]);
    const [apiPage, setApiPage] = useState(1);
    const [totalApiPages, setTotalApiPages] = useState(1);
    const [hasMoreApiPages, setHasMoreApiPages] = useState(true);
    const [isSearching, setIsSearching] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(40);

    const [existingInMovies, setExistingInMovies] = useState([]);
    const [existingInSeries, setExistingInSeries] = useState([]);
    const [existingInPool, setExistingInPool] = useState([]);
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);

    const currentUser = localStorage.getItem("currentUser") || "Bilinmiyor";

    useEffect(() => {
        const unsubMovies = onSnapshot(collection(db, "movies"), (snapshot) => setExistingInMovies(snapshot.docs.map(doc => doc.data().tmdbId || doc.data().id)));
        const unsubSeries = onSnapshot(collection(db, "series"), (snapshot) => setExistingInSeries(snapshot.docs.map(doc => doc.data().tmdbId || doc.data().id)));
        const unsubPool = onSnapshot(collection(db, "pool"), (snapshot) => setExistingInPool(snapshot.docs.map(doc => doc.data().tmdbId || doc.data().id)));

        fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_API_KEY}&language=tr-TR`)
            .then(res => res.json())
            .then(data => setGenresList(data.genres || []))
            .catch(err => console.error("Türler çekilemedi:", err));

        return () => { unsubMovies(); unsubSeries(); unsubPool(); };
    }, []);

    const allExistingMedia = [...existingInMovies, ...existingInSeries, ...existingInPool];

    const fetchApiData = async (pageNum, reset, currentQuery, currentGenre) => {
        setIsSearching(true);
        try {
            let newResults = [];
            let totalPagesFromApi = 1;

            if (currentQuery !== "") {
                const response = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=tr-TR&query=${currentQuery}&page=${pageNum}`);
                const data = await response.json();
                newResults = data.results || [];
                totalPagesFromApi = data.total_pages || 1;
            } else if (currentGenre !== "") {
                const [movieRes, tvRes] = await Promise.all([
                    fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=tr-TR&with_genres=${currentGenre}&sort_by=popularity.desc&page=${pageNum}`),
                    fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&language=tr-TR&with_genres=${currentGenre}&sort_by=popularity.desc&page=${pageNum}`)
                ]);
                const movieData = await movieRes.json();
                const tvData = await tvRes.json();
                const movies = (movieData.results || []).map(m => ({...m, media_type: 'movie'}));
                const tvs = (tvData.results || []).map(t => ({...t, media_type: 'tv'}));

                newResults = [...movies, ...tvs].sort((a, b) => b.popularity - a.popularity);
                totalPagesFromApi = Math.max(movieData.total_pages || 1, tvData.total_pages || 1);
            } else {
                const response = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_API_KEY}&language=tr-TR&page=${pageNum}`);
                const data = await response.json();
                newResults = data.results || [];
                totalPagesFromApi = data.total_pages || 1;
            }

            const filtered = newResults.filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path);

            setTmdbResults(prev => {
                const combined = reset ? filtered : [...prev, ...filtered];
                const uniqueMap = new Map();
                combined.forEach(item => uniqueMap.set(item.id, item));
                return Array.from(uniqueMap.values());
            });

            setTotalApiPages(totalPagesFromApi);
            setHasMoreApiPages(pageNum < totalPagesFromApi && pageNum < 500);
            setApiPage(pageNum);
        } catch (error) { console.error("API Hatası:", error); }
        setIsSearching(false);
    };

    useEffect(() => {
        setCurrentPage(1);
        fetchApiData(1, true, activeQuery, selectedGenre);
    }, [activeQuery, selectedGenre]);

    const displayedResults = tmdbResults.filter(item => {
        if (mediaFilter !== "all" && item.media_type !== mediaFilter) return false;
        if (!selectedGenre || activeQuery === "") return true;
        return item.genre_ids && item.genre_ids.includes(Number(selectedGenre));
    });

    const localTotalPages = Math.max(1, Math.ceil(displayedResults.length / itemsPerPage));

    // YENİ ÇÖZÜM: Toplam sayfa sayısını hesaplayan akıllı algoritma
    // TMDB her API sayfasında 20 sonuç verir. (totalApiPages * 20) ile havuzdaki tahmini toplam medyayı bulup, 
    // bunu senin seçtiğin (10, 20, 40) itemsPerPage değerine bölerek GERÇEK UI toplam sayfasını buluyoruz.
    const estimatedTotalPages = Math.max(localTotalPages, Math.ceil((totalApiPages * 20) / itemsPerPage));
    const displayTotalPages = hasMoreApiPages ? estimatedTotalPages : localTotalPages;

    useEffect(() => {
        const timer = setTimeout(() => {
            if (currentPage >= localTotalPages && hasMoreApiPages && !isSearching && tmdbResults.length > 0) {
                fetchApiData(apiPage + 1, false, activeQuery, selectedGenre);
            }
        }, 150);
        return () => clearTimeout(timer);
    }, [currentPage, localTotalPages, hasMoreApiPages, isSearching, tmdbResults.length, apiPage, activeQuery, selectedGenre]);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = displayedResults.slice(indexOfFirstItem, indexOfLastItem);

    const nextPage = () => setCurrentPage(prev => prev + 1);
    const prevPage = () => setCurrentPage(prev => (prev > 1 ? prev - 1 : prev));

    const handleSearch = (e) => {
        e.preventDefault();
        setActiveQuery(query.trim());
    };

    const fetchExactDetails = async (mediaType, id) => {
        try {
            const response = await fetch(`https://api.themoviedb.org/3/${mediaType}/${id}?api_key=${TMDB_API_KEY}&language=tr-TR`);
            return await response.json();
        } catch (error) { return null; }
    };

    const openDetailsModal = async (item) => {
        setIsDetailLoading(true);
        setSelectedDetail(item);
        const type = item.media_type || 'movie';
        const advancedData = await fetchExactDetails(type, item.id);

        if (advancedData) {
            let durationStr = "Bilinmiyor";
            if (type === 'movie' && advancedData.runtime) durationStr = `${advancedData.runtime} dk`;
            else if (type === 'tv' && advancedData.episode_run_time?.length > 0) durationStr = `${advancedData.episode_run_time[0]} dk`;

            setSelectedDetail(prev => ({
                ...prev,
                exactDuration: durationStr,
                genres: advancedData.genres,
                seasons: type === 'tv' ? advancedData.number_of_seasons : null,
                episodes: type === 'tv' ? advancedData.number_of_episodes : null
            }));
        }
        setIsDetailLoading(false);
    };

    const handleAdd = async (item, targetCollection, e) => {
        if (e) e.stopPropagation();
        try {
            const type = item.media_type || 'movie';
            const advancedData = await fetchExactDetails(type, item.id);

            let newItem = {
                tmdbId: item.id,
                title: item.title || item.name,
                overview: item.overview || "",
                poster: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
                rating: item.vote_average || 0,
                year: (item.release_date || item.first_air_date || "").substring(0, 4),
                addedBy: currentUser,
                mediaType: type,
                createdAt: Date.now(),
                genres: advancedData && advancedData.genres ? advancedData.genres.map(g => g.name) : []
            };

            if (type === 'movie') {
                newItem.duration = advancedData && advancedData.runtime ? `${advancedData.runtime} dk` : "Bilinmiyor";
            } else if (type === 'tv') {
                newItem.seasons = advancedData ? advancedData.number_of_seasons : 1;
                newItem.episodes = advancedData ? advancedData.number_of_episodes : 1;
                newItem.episodeDuration = advancedData && advancedData.episode_run_time?.length > 0 ? `${advancedData.episode_run_time[0]} dk` : "Bilinmiyor";
            }

            let finalCollection = 'pool';
            if (targetCollection === 'liste') {
                finalCollection = type === 'tv' ? 'series' : 'movies';
            }

            await addDoc(collection(db, finalCollection), newItem);
            if (selectedDetail && selectedDetail.id === item.id) setSelectedDetail(null);
        } catch (error) { console.error("Eklerken hata:", error); }
    };

    return (
        <div className="search-media-container">
            <div className="search-header">
                <h2>🍿 Keşfet ve Öneriler</h2>
                <p>Film veya dizi aratıp listeye veya havuza ekle. Havuza eklenen filmler sevgilin tarafından kabul edilirse listeye eklenir.</p>
            </div>

            <div className="search-filter-wrapper" style={{display: 'flex', gap: '10px', maxWidth: '800px', margin: '0 auto 15px auto', flexWrap: 'wrap'}}>
                <form onSubmit={handleSearch} className="search-form" style={{flex: '1', minWidth: '300px', margin: 0}}>
                    <input
                        type="text"
                        placeholder="Film veya dizi adı yazın..."
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            if(e.target.value === "") setActiveQuery("");
                        }}
                        className="search-input"
                    />
                    <button type="submit" className="search-btn" disabled={isSearching && activeQuery === query}>
                        {isSearching && activeQuery === query ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>} Ara
                    </button>
                </form>

                <div className="custom-select-wrapper">
                    <select
                        className="search-input custom-select"
                        value={mediaFilter}
                        onChange={(e) => { setMediaFilter(e.target.value); setCurrentPage(1); }}
                    >
                        <option value="all">🎬 Tüm Yapımlar</option>
                        <option value="movie">🎞️ Sadece Filmler</option>
                        <option value="tv">📺 Sadece Diziler</option>
                    </select>
                    <i className="fa-solid fa-chevron-down select-arrow"></i>
                </div>

                <div className="custom-select-wrapper">
                    <select
                        className="search-input custom-select"
                        value={selectedGenre}
                        onChange={(e) => { setSelectedGenre(e.target.value); setCurrentPage(1); }}
                    >
                        <option value="">{selectedGenre ? "❌ Filtreyi Kaldır" : "🎭 Tür Seç / Filtrele"}</option>
                        {genresList.map(genre => (
                            <option key={genre.id} value={genre.id}>{genre.name}</option>
                        ))}
                    </select>
                    <i className="fa-solid fa-chevron-down select-arrow"></i>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px', padding: '0 10px', maxWidth: '800px', margin: '0 auto 15px auto' }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-layer-group"></i> Sayfada Göster:
                    <select
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        style={{ background: 'var(--sidebar-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '5px', padding: '5px', outline: 'none' }}
                    >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={40}>40</option>
                        <option value={100}>100</option>
                    </select>
                </label>
            </div>

            <div style={{marginBottom: "15px", fontWeight: "bold", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "10px"}}>
                {activeQuery !== "" ? <><i className="fa-solid fa-list-ul"></i> Arama Sonuçları {selectedGenre && "(Türe Göre Filtrelendi)"}</>
                    : selectedGenre ? <><i className="fa-solid fa-wand-magic-sparkles" style={{color: "var(--accent-color)"}}></i> Tür Tavsiyeleri</>
                        : <><i className="fa-solid fa-fire" style={{color: "#ef4444"}}></i> Haftanın Popülerleri</>}
            </div>

            {currentItems.length === 0 && !isSearching ? (
                <p style={{textAlign: "center", color: "var(--text-muted)", padding: "40px 0"}}>Bu kriterlere uygun sonuç bulunamadı.</p>
            ) : (
                <div className="search-results-grid">
                    {currentItems.map((item) => {
                        const isAlreadyAdded = allExistingMedia.includes(item.id);

                        return (
                            <div key={item.id} className="search-card" onClick={() => openDetailsModal(item)}>
                                <div className="search-card-img-wrapper">
                                    <img src={`https://image.tmdb.org/t/p/w500${item.poster_path}`} alt={item.title || item.name} className="search-card-img" />
                                    <div className="click-to-view-overlay"><i className="fa-solid fa-circle-info"></i> Detaylar</div>
                                </div>

                                <div className="search-card-info">
                                    <div className="search-card-meta">
                                        <span className={`media-badge ${item.media_type || 'movie'}`}>{item.media_type === 'tv' ? 'Dizi' : 'Film'}</span>
                                        <span className="media-rating"><i className="fa-solid fa-star" style={{color: '#fbbf24'}}></i> {item.vote_average?.toFixed(1)}</span>
                                    </div>
                                    <h4 className="search-card-title">{item.title || item.name}</h4>
                                    <p className="search-card-date">{(item.release_date || item.first_air_date)?.substring(0, 4)}</p>

                                    <div className="search-card-actions">
                                        {isAlreadyAdded ? (
                                            <button className="added-btn" disabled onClick={(e) => e.stopPropagation()}><i className="fa-solid fa-check-double"></i> Zaten Eklendi</button>
                                        ) : (
                                            <>
                                                <button className="add-pool-btn" onClick={(e) => handleAdd(item, 'pool', e)}><i className="fa-solid fa-droplet"></i> Havuza</button>
                                                <button className="add-list-btn" onClick={(e) => handleAdd(item, 'liste', e)}><i className="fa-solid fa-list-check"></i> Listeye</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* DEĞİŞEN KISIM: Sayfalama UI'ı */}
            {(hasMoreApiPages || localTotalPages > 1) && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '30px', paddingBottom: '20px' }}>
                    <button onClick={prevPage} disabled={currentPage === 1 || isSearching} className="pagination-btn">
                        <i className="fa-solid fa-chevron-left"></i> Önceki
                    </button>

                    <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>
                        Sayfa {currentPage} <span style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>/ {displayTotalPages}</span>
                    </span>

                    <button onClick={nextPage} disabled={(!hasMoreApiPages && currentPage >= localTotalPages) || isSearching} className="pagination-btn">
                        {isSearching && currentPage >= localTotalPages ? <i className="fa-solid fa-spinner fa-spin"></i> : "Sonraki"} <i className="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
            )}

            {selectedDetail && (
                <div className="modal-overlay" onClick={() => setSelectedDetail(null)}>
                    <div className="media-detail-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="close-modal-btn" onClick={() => setSelectedDetail(null)}>
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                        <div className="media-detail-content">
                            <img src={`https://image.tmdb.org/t/p/w500${selectedDetail.poster_path}`} alt="Afiş" className="media-detail-poster" />
                            <div className="media-detail-info">
                                <h2>{selectedDetail.title || selectedDetail.name}</h2>
                                <div className="media-detail-tags">
                                    <span className="detail-tag rating"><i className="fa-solid fa-star"></i> {selectedDetail.vote_average?.toFixed(1)}</span>
                                    <span className="detail-tag year"><i className="fa-regular fa-calendar"></i> {(selectedDetail.release_date || selectedDetail.first_air_date)?.substring(0, 4)}</span>
                                    <span className="detail-tag duration">
                                        <i className="fa-regular fa-clock"></i> {isDetailLoading ? "Hesaplanıyor..." : (selectedDetail.exactDuration || "Bilinmiyor")}
                                    </span>
                                    {selectedDetail.seasons && (
                                        <span className="detail-tag seasons">
                                            <i className="fa-solid fa-list-ol"></i> {selectedDetail.seasons} Sezon • {selectedDetail.episodes} Bölüm
                                        </span>
                                    )}
                                </div>
                                {!isDetailLoading && selectedDetail.genres && (
                                    <div className="media-genres">
                                        {selectedDetail.genres.map(g => <span key={g.id} className="genre-pill">{g.name}</span>)}
                                    </div>
                                )}
                                <div className="media-detail-overview">
                                    <h4>Özet</h4>
                                    <p>{selectedDetail.overview || "Bu yapım için henüz Türkçe özet bulunmuyor."}</p>
                                </div>
                                <div className="media-detail-actions">
                                    {allExistingMedia.includes(selectedDetail.id) ? (
                                        <button className="added-btn" disabled style={{width: "100%"}}><i className="fa-solid fa-check-double"></i> Bu yapım zaten listelerde mevcut</button>
                                    ) : (
                                        <>
                                            <button className="add-pool-btn" onClick={() => handleAdd(selectedDetail, 'pool')}><i className="fa-solid fa-droplet"></i> Havuza Ekle</button>
                                            <button className="add-list-btn" onClick={() => handleAdd(selectedDetail, 'liste')}><i className="fa-solid fa-list-check"></i> Doğrudan Listeye</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}