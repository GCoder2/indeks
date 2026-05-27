// Anonymous user id stored in cookie (1 year). Used for history/favorites/tracking.

const COOKIE_NAME = "emg_anon_id";

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "anon-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function readCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(name + "="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function writeCookie(name, value, days = 365) {
  if (typeof document === "undefined") return;
  const exp = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
}

export function getAnonId() {
  let id = readCookie(COOKIE_NAME);
  if (!id) {
    id = genId();
    writeCookie(COOKIE_NAME, id);
  }
  return id;
}
