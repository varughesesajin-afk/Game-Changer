import { Routes, Route, useLocation } from "react-router-dom";
import AppShell from "@/components/AppShell";
import AuthCallback from "@/components/AuthCallback";
import Explore from "@/pages/Explore";
import Communities from "@/pages/Communities";
import CommunityDetail from "@/pages/CommunityDetail";
import Tournaments from "@/pages/Tournaments";
import TournamentDetail from "@/pages/TournamentDetail";
import HostPro from "@/pages/HostPro";
import Profile from "@/pages/Profile";
import Login from "@/pages/Login";

export default function App() {
  const location = useLocation();
  // Emergent Google auth returns with #session_id=... — handle it before any route renders.
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Explore />} />
        <Route path="/communities" element={<Communities />} />
        <Route path="/communities/:id" element={<CommunityDetail />} />
        <Route path="/tournaments" element={<Tournaments />} />
        <Route path="/tournaments/:id" element={<TournamentDetail />} />
        <Route path="/monetize" element={<HostPro />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Explore />} />
      </Route>
    </Routes>
  );
}
