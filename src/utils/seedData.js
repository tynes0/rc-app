import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { mockMovies, mockSeries, mockPool } from "../data/mockData";

export const uploadDataToFirebase = async () => {
    try {
        console.log("Veriler yükleniyor, lütfen bekleyin...");

        for (const movie of mockMovies) {
            await setDoc(doc(db, "movies", movie.id.toString()), movie);
        }

        for (const series of mockSeries) {
            await setDoc(doc(db, "series", series.id.toString()), series);
        }

        for (const item of mockPool) {
            await setDoc(doc(db, "pool", item.id.toString()), item);
        }

        console.log("✅ İŞLEM TAMAM!");
        alert("Bütün veriler başarıyla Firebase'e yüklendi! Artık Sidebar'daki butonu silebilirsin.");
    } catch (error) {
        console.error("Yükleme sırasında bir hata oluştu: ", error);
        alert("Hata oluştu! F12 ile konsolu kontrol et.");
    }
};