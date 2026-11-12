var d = Object.defineProperty;
var m = (t, e, r) => (e in t ? d(t, e, { enumerable: !0, configurable: !0, writable: !0, value: r }) : (t[e] = r));
var f = (t, e, r) => m(t, typeof e != "symbol" ? e + "" : e, r);
import { g as h } from "./CPkiEbDf.js";
import { w as g } from "./CR18yOJo.js";
const p = !0;
class c extends Error {
  constructor(r, o) {
    super(r);
    f(this, "status");
    ((this.status = o), Object.setPrototypeOf(this, c.prototype));
  }
}
async function w(t) {
  if (!t.ok) {
    let e = "Unknown error occurred";
    try {
      const r = await t.json();
      (t.status === 302 && (g.set(!0), await h(r.redirect_url)),
        (t.status === 401 || t.status === 403) &&
          (p && t.status === 401 && (localStorage.removeItem("token"), localStorage.removeItem("role")), await h("/auth/login")),
        (e = r.message || r.msg || r.errors[Object.keys(r.errors)[0]][0] || e));
    } catch (r) {
      console.error("Error parsing error response:", r);
    }
    throw new c(e, t.status);
  }
}
const y = "https://ictfromabc.com/api";
function S(t) {
  if (!t) return "";
  const e = new URLSearchParams();
  Object.entries(t).forEach(([o, s]) => {
    s == null || s === "" || e.set(o, String(s));
  });
  const r = e.toString();
  return r ? `?${r}` : "";
}
async function a({ method: t, path: e, data: r, contentType: o, params: s }) {
  const n = { method: t, headers: {} };
  ((n.headers.Accept = "application/json"),
    o && o !== "" && (n.headers["Content-Type"] = o),
    r && r instanceof FormData ? (n.body = r) : r && ((n.headers["Content-Type"] = "application/json"), (n.body = JSON.stringify(r))));
  const i = localStorage.getItem("token");
  i && (n.headers.Authorization = `Bearer ${i}`);
  const l = S(s),
    u = await fetch(`${y}${e}${l}`, n);
  return (await w(u), u);
}
function j(t, e) {
  return a({ method: "GET", path: t, params: e });
}
function T(t) {
  return a({ method: "DELETE", path: t });
}
function O(t, e, r) {
  return a({ method: "POST", path: t, data: e, contentType: r });
}
function P(t, e, r) {
  return a({ method: "PUT", path: t, data: e, contentType: r });
}
function $(t, e, r) {
  return a({ method: "PATCH", path: t, data: e, contentType: r });
}
async function A(t) {
  const e = localStorage.getItem("token");
  if (!e) throw new Error("Token not found");
  return await fetch(t, { method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${e}` } });
}
export { j as a, $ as b, P as c, T as d, p as e, A as g, O as p };
