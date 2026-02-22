import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Todos from "./pages/Todos";
import Movies from "./pages/Movies";
import Series from "./pages/Series";
import Gallery from "./pages/Gallery";
import SearchMedia from "./pages/SearchMedia";
import Pool from "./pages/Pool";
import AppLayout from "./layout/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/app/todos" replace />} />

                <Route path="/login" element={<Login />} />

                <Route
                    path="/app"
                    element={
                        <ProtectedRoute>
                            <AppLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route path="todos" element={<Todos />} />
                    <Route path="pool" element={<Pool />} />
                    <Route path="movies" element={<Movies />} />
                    <Route path="series" element={<Series />} />
                    <Route path="gallery" element={<Gallery />} />
                    <Route path="search-media" element={<SearchMedia />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;