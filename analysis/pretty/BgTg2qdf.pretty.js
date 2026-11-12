import { a as c } from "./BoaDJuae.js";
const o = new Map();
function s(t) {
  return t.includes("youtube.com") || t.includes("youtu.be");
}
function a(t, { token: n, expires: r }) {
  const i = t.includes("?") ? "&" : "?";
  return `${t}${i}token=${n}&expires=${r}`;
}
async function l(t) {
  const n = o.get(t);
  if (n && n.expires > Date.now() / 1e3 + 300) return n;
  try {
    const { token: r, expires: i } = await c.generateToken(t),
      e = { token: r, expires: i };
    return (o.set(t, e), e);
  } catch {
    return null;
  }
}
async function d(t) {
  const n = t.reduce((e, u) => (s(u.thumbnail_url) || e.push(u.id), e), []);
  if (!n.length) return t;
  const r = await Promise.allSettled(n.map(l)),
    i = new Map();
  return (
    r.forEach((e, u) => {
      e.status === "fulfilled" && e.value && i.set(n[u], e.value);
    }),
    t.map((e) => {
      const u = e.id ? i.get(e.id) : void 0;
      return u
        ? {
            ...e,
            video_url: e.video_url ? a(e.video_url, u) : e.video_url,
            thumbnail_url: e.thumbnail_url ? a(e.thumbnail_url, u) : e.thumbnail_url,
            preview_url: e.preview_url ? a(e.preview_url, u) : e.preview_url,
          }
        : e;
    })
  );
}
async function f(t, n) {
  if (s(t)) return t;
  const r = await l(n);
  return r ? a(t, r) : t;
}
export { d as a, f as b };
