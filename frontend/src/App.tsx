import { Routes, Route } from "react-router-dom";
import AppShell from "@/components/AppShell";
import Explore from "@/pages/Explore";
import Communities from "@/pages/Communities";
import CommunityDetail from "@/pages/CommunityDetail";
import NewCommunity from "@/pages/NewCommunity";
import Tournaments from "@/pages/Tournaments";
import TournamentDetail from "@/pages/TournamentDetail";
import HostPro from "@/pages/HostPro";
import Profile from "@/pages/Profile";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import Privacy from "@/pages/Privacy";
import PlayerProfilePage from "@/pages/PlayerProfile";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Explore />} />
        <Route path="/communities" element={<Communities />} />
        <Route path="/communities/new" element={<NewCommunity />} />
        <Route path="/communities/:id" element={<CommunityDetail />} />
        <Route path="/tournaments" element={<Tournaments />} />
        <Route path="/tournaments/:id" element={<TournamentDetail />} />
        <Route path="/monetize" element={<HostPro />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/players/:key" element={<PlayerProfilePage />} />
        <Route path="*" element={<Explore />} />
      </Route>
    </Routes>
  );
}
