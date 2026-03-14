import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MemoryMap from "./pages/MemoryMap";
import Todos from "./pages/Todos";
import Movies from "./pages/Movies";
import Series from "./pages/Series";
import Gallery from "./pages/Gallery";
import SearchMedia from "./pages/SearchMedia";
import Pool from "./pages/Pool";
import Diary from "./pages/Diary";
import Canvas from "./pages/Canvas";
import Tales from "./pages/Tales";
import AppLayout from "./layout/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/app/dashboard" replace />} />

                <Route path="/login" element={<Login />} />

                <Route
                    path="/app"
                    element={
                        <ProtectedRoute>
                            <AppLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="todos" element={<Todos />} />
                    <Route path="memory-map" element={<MemoryMap />} />
                    <Route path="pool" element={<Pool />} />
                    <Route path="movies" element={<Movies />} />
                    <Route path="series" element={<Series />} />
                    <Route path="gallery" element={<Gallery />} />
                    <Route path="search-media" element={<SearchMedia />} />
                    <Route path="diary" element={<Diary />} />
                    <Route path="canvas" element={<Canvas />} />
                    <Route path="tales" element={<Tales />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;