import { fmtDate, money } from "@/lib/auth";
import type { Community, Game } from "@/lib/types";

function time12(t: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return t;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "pm" : "am"}`;
}

const nameOf = (r: Game["roster"][number]) => `${r.name}${r.user_id ? "" : " (guest)"}`;

/** The message hosts paste into the WhatsApp group: who is in, where and when, and what is still free. */
export function buildGameText(g: Game, c?: Community | null): string {
  const url = `${window.location.origin}/communities/${g.community_id}`;
  const where = [g.venue, c?.city].filter(Boolean).join(", ");
  const left = Math.max(0, g.max_players - g.roster.length);
  const out: string[] = [`*${g.community_name} · ${g.sport}*`, `📅 ${fmtDate(g.date, "EEE d MMM")}, ${time12(g.time)}`];
  if (where) out.push(`📍 ${where}`);
  if (g.fee > 0) out.push(`💰 ${money(g.fee)} per player`);
  out.push("");

  if (g.signup_style === "spots") {
    out.push(`*Players (${g.roster.length}/${g.max_players})*`);
    [...g.roster].sort((a, b) => (a.spot ?? 999) - (b.spot ?? 999)).forEach((r) => out.push(`${r.spot ?? "-"}. ${nameOf(r)}`));
    out.push("");
    const used = new Set(g.roster.map((r) => r.spot));
    const free = Array.from({ length: g.max_players }, (_, i) => i + 1).filter((n) => !used.has(n));
    out.push(free.length ? `*${free.length} spot${free.length === 1 ? "" : "s"} left:* ${free.join(", ")}` : "*Game is full*");
    out.push("", `Take your spot: ${url}`);
  } else {
    const a = g.roster.filter((r) => r.team === "A");
    const b = g.roster.filter((r) => r.team === "B");
    out.push(`*Team A (${a.length})*`, ...(a.length ? a.map(nameOf) : ["-"]), "");
    out.push(`*Team B (${b.length})*`, ...(b.length ? b.map(nameOf) : ["-"]), "");
    out.push(left ? `*${left} spot${left === 1 ? "" : "s"} left*` : "*Game is full*");
    out.push("", `Join: ${url}`);
  }
  return out.join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
