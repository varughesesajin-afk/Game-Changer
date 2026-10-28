import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import { queryClient } from "@/lib/queryClient";
import type { User } from "@/lib/types";

export default function AuthCallback() {
  const location = useLocation();
  const nav = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const m = location.hash.match(/session_id=([^&]+)/);
    if (!m) {
      nav("/login", { replace: true });
      return;
    }
    apiPost<User>("/auth/session", { session_id: m[1] })
      .then((user) => {
        beginSession();
        queryClient.setQueryData(["me"], user);
        nav("/profile", { replace: true });
      })
      .catch(() => nav("/login", { replace: true }));
  }, [location.hash, nav]);

  return <div className="min-h-screen bg-page" data-testid="auth-callback" />;
}
