import { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import "./SearchMedia.css";

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

export default function SearchMedia() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isShowingPopular, setIsShowingPopular] = useState(true);

    // YENİ: Türler (Genres) State'leri
    const [genresList, setGenresList] = useState([]);
    const [selectedGenre, setSelectedGenre] = useState("");

    const [existingInMovies, setExistingInMovies] = useState([]);
    const [existingInSeries, setExistingInSeries] = useState([]);
    const [existingInPool, setExistingInPool] = useState([]);
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);

    const currentUser = localStorage.getItem("currentUser") || "Bilinmiyor";

    // 1. Veritabanını ve TMDb Tür Listesini Dinle
    useEffect(() => {
        // Firebase Dinlemeleri
        const unsubMovies = onSnapshot(collection(db, "movies"), (snapshot) => setExistingInMovies(snapshot.docs.map(doc => doc.data().tmdbId || doc.data().id)));
        const unsubSeries = onSnapshot(collection(db, "series"), (snapshot) => setExistingInSeries(snapshot.docs.map(doc => doc.data().tmdbId || doc.data().id)));
        const unsubPool = onSnapshot(collection(db, "pool"), (snapshot) => setExistingInPool(snapshot.docs.map(doc => doc.data().tmdbId || doc.data().id)));

        // YENİ: TMDb'den Film Türlerini Çek (Tavsiye motoru için)
        fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_API_KEY}&language=tr-TR`)
            .then(res => res.json())
            .then(data => setGenresList(data.genres || []))
            .catch(err => console.error("Türler çekilemedi:", err));

        return () => { unsubMovies(); unsubSeries(); unsubPool(); };
    }, []);

    const allExistingMedia = [...existingInMovies, ...existingInSeries, ...existingInPool];

    // 2. Arama Kutusuna veya Tür Seçimine Göre İçerik Getir
    useEffect(() => {
        if (selectedGenre !== "") {
            fetchRecommendationsByGenre(selectedGenre);
        } else if (query === "") {
            fetchPopular();
        }
    }, [query, selectedGenre]);

    const fetchPopular = async () => {
        setIsSearching(true);
        try {
            const response = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_API_KEY}&language=tr-TR`);
            const data = await response.json();
            setResults(data.results.filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path));
            setIsShowingPopular(true);
        } catch (error) { console.error(error); }
        setIsSearching(false);
    };

    // YENİ: Türe Göre Tavsiye Motoru (Discover API)
    const fetchRecommendationsByGenre = async (genreId) => {
        setIsSearching(true);
        setIsShowingPopular(false);
        try {
            // Hem film hem dizi için discover yapıp birleştiriyoruz ki zengin sonuç çıksın
            const [movieRes, tvRes] = await Promise.all([
                fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=tr-TR&with_genres=${genreId}&sort_by=popularity.desc`),
                fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&language=tr-TR&with_genres=${genreId}&sort_by=popularity.desc`)
            ]);

            const movieData = await movieRes.json();
            const tvData = await tvRes.json();

            // Medya türlerini manuel ekleyip popülerliğe göre birleştiriyoruz
            const movies = movieData.results.map(m => ({...m, media_type: 'movie'}));
            const tvs = tvData.results.map(t => ({...t, media_type: 'tv'}));

            const combined = [...movies, ...tvs]
                .filter(item => item.poster_path)
                .sort((a, b) => b.popularity - a.popularity); // En popülerler en üste

            setResults(combined);
        } catch (error) { console.error("Tavsiye hatası:", error); }
        setIsSearching(false);
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;
        setIsSearching(true);
        setIsShowingPopular(false);
        setSelectedGenre(""); // Arama yapılıyorsa tür filtresini sıfırla
        try {
            const response = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=tr-TR&query=${query}&page=1`);
            const data = await response.json();
            setResults(data.results.filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path));
        } catch (error) { console.error(error); }
        setIsSearching(false);
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
                // YENİ: Türleri objelerin isimleri olarak dizi halinde kaydet
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
                <p>Aradığın yapımı bul veya tür seçerek yeni maceralar keşfet.</p>
            </div>

            {/* YENİ: Arama ve Filtreleme Alanı */}
            <div className="search-filter-wrapper" style={{display: 'flex', gap: '10px', maxWidth: '800px', margin: '0 auto 30px auto', flexWrap: 'wrap'}}>
                <form onSubmit={handleSearch} className="search-form" style={{flex: '1', minWidth: '300px', margin: 0}}>
                    <input type="text" placeholder="Film veya dizi adı yazın..." value={query} onChange={(e) => { setQuery(e.target.value); if(e.target.value === "") setSelectedGenre(""); }} className="search-input" />
                    <button type="submit" className="search-btn" disabled={isSearching}>
                        {isSearching && !selectedGenre ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>} Ara
                    </button>
                </form>

                {/* YENİ: Tür Seçimi (Dropdown) */}
                <div style={{flex: '0 1 200px', minWidth: '150px'}}>
                    <select
                        className="search-input"
                        style={{width: '100%', cursor: 'pointer', appearance: 'auto'}}
                        value={selectedGenre}
                        onChange={(e) => {
                            setSelectedGenre(e.target.value);
                            if(e.target.value !== "") setQuery(""); // Tür seçilince yazılı aramayı sıfırla
                        }}
                    >
                        <option value="">🎭 Tür Seç / Filtrele</option>
                        {genresList.map(genre => (
                            <option key={genre.id} value={genre.id}>{genre.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div style={{marginBottom: "15px", fontWeight: "bold", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "10px"}}>
                {selectedGenre ? <><i className="fa-solid fa-wand-magic-sparkles" style={{color: "var(--accent-color)"}}></i> Tür Tavsiyeleri</>
                    : isShowingPopular ? <><i className="fa-solid fa-fire" style={{color: "#ef4444"}}></i> Haftanın Popülerleri</>
                        : <><i className="fa-solid fa-list-ul"></i> Arama Sonuçları</>}
            </div>

            {/* Kartlar ve Modal Render Kodları Aynı Kalacak (Aşağıdaki grid map ve Modal kodları mevcut haliyle durabilir) */}
            <div className="search-results-grid">
                {results.map((item) => {
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

            {/* BURAYA ÖNCEKİ MESAJDAKİ MODAL KODUNU KOYABİLİRSİN (selectedDetail) */}
        </div>
    );
}