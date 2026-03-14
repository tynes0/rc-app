import Sidebar from "../components/Sidebar";
import { Outlet } from "react-router-dom";

export default function AppLayout() {
    return (
        <div className="app-layout" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <Sidebar />
            <main className="main-content" style={{ flex: 1, overflowY: 'auto', height: '100vh', position: 'relative' }}>
                <Outlet />
            </main>
        </div>
    );
}