import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ApiError, apiGet } from "./api";
import { queryClient } from "./queryClient";
import type { User } from "./types";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<User | null> => {
      try {
        return await apiGet<User>("/auth/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
}

export function loginWithGoogle(): void {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const redirectUrl = window.location.origin + "/profile";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

export function errMsg(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { detail?: unknown } | null;
    if (body && typeof body.detail === "string") return body.detail;
    if (e.status === 401) return "Please sign in first";
    return `Request failed (${e.status})`;
  }
  return "Something went wrong";
}

export function refreshAll(): void {
  void queryClient.invalidateQueries();
}

export function fmtDate(d: string, pattern = "EEE d MMM"): string {
  try {
    return format(parseISO(d), pattern);
  } catch {
    return d;
  }
}

export function money(n: number, currency = "OMR"): string {
  if (!n) return "Free";
  return `${currency} ${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

export const SPORTS = ["Football", "Basketball", "Padel", "Tennis", "Cricket", "Volleyball", "Badminton", "Running", "Other"];
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const IMG: Record<string, string> = {
  Football: "https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=1200&q=80",
  Basketball: "https://images.unsplash.com/photo-1518614368389-5160c0b0de72?w=1200&q=80",
  Padel: "https://images.unsplash.com/photo-1612534847738-b3af9bc31f0c?w=1200&q=80",
  Tennis: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=1200&q=80",
  Cricket: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=1200&q=80",
  Volleyball: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=1200&q=80",
};
export const HERO_IMG = "https://images.unsplash.com/photo-1512746804203-e53e69406f93?w=1400&q=80";

export function sportImage(sport: string, image?: string | null): string {
  return image || IMG[sport] || HERO_IMG;
}
