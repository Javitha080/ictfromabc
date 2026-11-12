import {
  s as Y,
  n as G,
  d as g,
  i as j,
  l as ue,
  g as C,
  m as U,
  j as P,
  o as ce,
  a as O,
  q as d,
  b as y,
  y as J,
  a6 as fe,
  c as E,
  e as z,
  f as Z,
  h as V,
  t as W,
  A as me,
  u as ae,
  p as de,
  a5 as A,
  a7 as X,
  k as pe,
} from "../chunks/BitTBVkN.js";
import { S as K, i as Q, d as F, t as N, a as S, m as B, b as M, e as R, g as ge, c as _e } from "../chunks/Bc7KUd1A.js";
import { g as he } from "../chunks/D0QH3NT1.js";
import { e as ee } from "../chunks/BJCETRoq.js";
import { a as be } from "../chunks/V_pZSE_j.js";
import { s as ye } from "../chunks/DwC4MltK.js";
import { c as ve, d as we, g as $e } from "../chunks/Cf9__6PF.js";
import { C as ke } from "../chunks/BXYf_raO.js";
import { E as Ie } from "../chunks/CfwPFfmD.js";
import { L as Le } from "../chunks/CzP9JvuM.js";
import { A as te } from "../chunks/C7xdrqTy.js";
import { G as Ee } from "../chunks/CIekToeX.js";
import { H as Ve } from "../chunks/BzXVTjMD.js";
import { s as Ce, b as Pe } from "../chunks/CBADUwYq.js";
import { L as Te } from "../chunks/BDz6KPd1.js";
import { S as je } from "../chunks/CRhaA8Hb.js";
import { p as xe } from "../chunks/B75c6CfY.js";
const re =
  "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%3e%3cpath%20fill='currentColor'%20d='M3%203.993C3%203.445%203.445%203%203.993%203h16.014c.548%200%20.993.445.993.993v16.014a.994.994%200%200%201-.993.993H3.993A.993.993%200%200%201%203%2020.007zM5%205v14h14V5zm5.622%203.415l4.879%203.252a.4.4%200%200%201%200%20.666l-4.88%203.252a.4.4%200%200%201-.621-.332V8.747a.4.4%200%200%201%20.622-.332'/%3e%3c/svg%3e";
function Ne(o) {
  let t, r;
  return (
    (t = new je({ props: { size: "20", class: "w-full h-14 rounded-sm my-4 p-3 bg-gray-300" } })),
    {
      c() {
        R(t.$$.fragment);
      },
      l(e) {
        M(t.$$.fragment, e);
      },
      m(e, l) {
        (B(t, e, l), (r = !0));
      },
      p: G,
      i(e) {
        r || (S(t.$$.fragment, e), (r = !0));
      },
      o(e) {
        (N(t.$$.fragment, e), (r = !1));
      },
      d(e) {
        F(t, e);
      },
    }
  );
}
class Se extends K {
  constructor(t) {
    (super(), Q(this, t, null, Ne, Y, {}));
  }
}
const { document: le } = he;
function se(o, t, r) {
  const e = o.slice();
  return ((e[20] = t[r]), e);
}
function qe(o) {
  let t, r;
  return (
    (t = new Ie({ props: { message: "No Videos available." } })),
    {
      c() {
        R(t.$$.fragment);
      },
      l(e) {
        M(t.$$.fragment, e);
      },
      m(e, l) {
        (B(t, e, l), (r = !0));
      },
      p: G,
      i(e) {
        r || (S(t.$$.fragment, e), (r = !0));
      },
      o(e) {
        (N(t.$$.fragment, e), (r = !1));
      },
      d(e) {
        F(t, e);
      },
    }
  );
}
function ze(o) {
  let t, r, e, l, s, n, f, _, m, p, b, $, L, h, x, k, q, I, T, D;
  t = new Ve({ props: { title: o[4].title } });
  let c = o[5] && oe(o);
  return (
    (l = new Ee({ props: { $$slots: { default: [Be] }, $$scope: { ctx: o } } })),
    (_ = new ke({ props: { style: "color: red; background-color: transparent;", size: "xl" } })),
    {
      c() {
        (R(t.$$.fragment),
          (r = P()),
          c && c.c(),
          (e = P()),
          R(l.$$.fragment),
          (s = P()),
          (n = V("div")),
          (f = V("button")),
          R(_.$$.fragment),
          (m = P()),
          (p = V("div")),
          (b = V("p")),
          ($ = W(o[1])),
          (L = P()),
          (h = V("iframe")),
          this.h());
      },
      l(a) {
        (M(t.$$.fragment, a), (r = C(a)), c && c.l(a), (e = C(a)), M(l.$$.fragment, a), (s = C(a)), (n = E(a, "DIV", { id: !0, class: !0, style: !0 })));
        var i = z(n);
        f = E(i, "BUTTON", { class: !0 });
        var u = z(f);
        (M(_.$$.fragment, u), u.forEach(g), (m = C(i)), (p = E(i, "DIV", { style: !0, id: !0 })));
        var v = z(p);
        b = E(v, "P", { class: !0, style: !0 });
        var w = z(b);
        (($ = Z(w, o[1])), w.forEach(g), (L = C(v)), (h = E(v, "IFRAME", { id: !0, title: !0, loading: !0, style: !0, allow: !0 })));
        var H = z(h);
        (H.forEach(g), v.forEach(g), i.forEach(g), this.h());
      },
      h() {
        (d(f, "class", "absolute top-0 right-0 m-2 p-2 rounded-full z-50"),
          d(b, "class", "absolute bottom-10 left-0 z-50 m-2 text-white pointer-events-none scrolling-text svelte-1irap3k"),
          fe(b, "text-shadow", "1px 1px 2px black, -1px -1px 2px black"),
          d(h, "id", "videoIframe"),
          d(h, "title", "Video Player"),
          d(h, "loading", "lazy"),
          d(h, "style", (x = o[3] ? "border: none; position: absolute; top: 0; height: 100%; width: 100%;" : "display:none;border:0;")),
          d(h, "allow", "accelerometer; gyroscope; autoplay; encrypted-media;"),
          d(p, "style", (k = o[3] ? "border: none; position: absolute; top: 0; height: 100%; width: 100%;" : "display:none;border:0;")),
          d(p, "id", "videoIframeContainer"),
          d(n, "id", "videoContainer"),
          d(n, "class", "fixed top-0 left-0 w-full h-full bg-black z-50"),
          d(n, "style", (q = o[3] ? "display: block;" : "display: none;")));
      },
      m(a, i) {
        (B(t, a, i),
          j(a, r, i),
          c && c.m(a, i),
          j(a, e, i),
          B(l, a, i),
          j(a, s, i),
          j(a, n, i),
          y(n, f),
          B(_, f, null),
          y(n, m),
          y(n, p),
          y(p, b),
          y(b, $),
          y(p, L),
          y(p, h),
          o[14](h),
          (I = !0),
          T || ((D = J(f, "click", o[13])), (T = !0)));
      },
      p(a, i) {
        const u = {};
        (i & 16 && (u.title = a[4].title), t.$set(u), a[5] ? (c ? c.p(a, i) : ((c = oe(a)), c.c(), c.m(e.parentNode, e))) : c && (c.d(1), (c = null)));
        const v = {};
        (i & 8388736 && (v.$$scope = { dirty: i, ctx: a }),
          l.$set(v),
          (!I || i & 2) && O($, a[1]),
          (!I || (i & 8 && x !== (x = a[3] ? "border: none; position: absolute; top: 0; height: 100%; width: 100%;" : "display:none;border:0;"))) &&
            d(h, "style", x),
          (!I || (i & 8 && k !== (k = a[3] ? "border: none; position: absolute; top: 0; height: 100%; width: 100%;" : "display:none;border:0;"))) &&
            d(p, "style", k),
          (!I || (i & 8 && q !== (q = a[3] ? "display: block;" : "display: none;"))) && d(n, "style", q));
      },
      i(a) {
        I || (S(t.$$.fragment, a), S(l.$$.fragment, a), S(_.$$.fragment, a), (I = !0));
      },
      o(a) {
        (N(t.$$.fragment, a), N(l.$$.fragment, a), N(_.$$.fragment, a), (I = !1));
      },
      d(a) {
        (a && (g(r), g(e), g(s), g(n)), F(t, a), c && c.d(a), F(l, a), F(_), o[14](null), (T = !1), D());
      },
    }
  );
}
function Fe(o) {
  let t, r, e, l;
  return (
    (t = new Se({})),
    (e = new Te({})),
    {
      c() {
        (R(t.$$.fragment), (r = P()), R(e.$$.fragment));
      },
      l(s) {
        (M(t.$$.fragment, s), (r = C(s)), M(e.$$.fragment, s));
      },
      m(s, n) {
        (B(t, s, n), j(s, r, n), B(e, s, n), (l = !0));
      },
      p: G,
      i(s) {
        l || (S(t.$$.fragment, s), S(e.$$.fragment, s), (l = !0));
      },
      o(s) {
        (N(t.$$.fragment, s), N(e.$$.fragment, s), (l = !1));
      },
      d(s) {
        (s && g(r), F(t, s), F(e, s));
      },
    }
  );
}
function oe(o) {
  let t,
    r = `<img class="h-6 w-6 mr-2" alt="Live Now Icon" src="${Le}"/> <span>Now Streaming.... Click here to join</span>`,
    e,
    l;
  return {
    c() {
      ((t = V("button")), (t.innerHTML = r), this.h());
    },
    l(s) {
      ((t = E(s, "BUTTON", { class: !0, "data-svelte-h": !0 })), ae(t) !== "svelte-120hdlt" && (t.innerHTML = r), this.h());
    },
    h() {
      d(
        t,
        "class",
        "justify-center w-full bg-red-500 hover:bg-red-600 text-white text-sm sm:text-md md:text-xl font-bold inline-flex items-start rounded animate-pulse px-4 py-2",
      );
    },
    m(s, n) {
      (j(s, t, n), e || ((l = J(t, "click", o[8])), (e = !0)));
    },
    p: G,
    d(s) {
      (s && g(t), (e = !1), l());
    },
  };
}
function ne(o) {
  let t, r;
  return {
    c() {
      ((t = V("img")), this.h());
    },
    l(e) {
      ((t = E(e, "IMG", { src: !0, alt: !0, class: !0 })), this.h());
    },
    h() {
      (A(t.src, (r = o[20].preview_url)) || d(t, "src", r),
        d(t, "alt", "Video preview"),
        d(t, "class", "absolute w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-800 rounded-lg"));
    },
    m(e, l) {
      j(e, t, l);
    },
    p(e, l) {
      l & 128 && !A(t.src, (r = e[20].preview_url)) && d(t, "src", r);
    },
    d(e) {
      e && g(t);
    },
  };
}
function ie(o) {
  let t,
    r,
    e = o[20].title + "",
    l,
    s,
    n,
    f,
    _,
    m,
    p,
    b,
    $,
    L = o[20].description + "",
    h,
    x,
    k,
    q = "Watch",
    I,
    T,
    D,
    c = o[20].preview_url && ne(o);
  function a() {
    return o[12](o[20]);
  }
  return {
    c() {
      ((t = V("div")),
        (r = V("h2")),
        (l = W(e)),
        (s = P()),
        (n = V("div")),
        (f = V("img")),
        (p = P()),
        c && c.c(),
        (b = P()),
        ($ = V("p")),
        (h = W(L)),
        (x = P()),
        (k = V("button")),
        (k.textContent = q),
        (I = P()),
        this.h());
    },
    l(i) {
      t = E(i, "DIV", { class: !0 });
      var u = z(t);
      r = E(u, "H2", { class: !0 });
      var v = z(r);
      ((l = Z(v, e)), v.forEach(g), (s = C(u)), (n = E(u, "DIV", { class: !0 })));
      var w = z(n);
      ((f = E(w, "IMG", { src: !0, alt: !0, class: !0 })), (p = C(w)), c && c.l(w), w.forEach(g), (b = C(u)), ($ = E(u, "P", { class: !0 })));
      var H = z($);
      ((h = Z(H, L)),
        H.forEach(g),
        (x = C(u)),
        (k = E(u, "BUTTON", { class: !0, "data-svelte-h": !0 })),
        ae(k) !== "svelte-16wc4rj" && (k.textContent = q),
        (I = C(u)),
        u.forEach(g),
        this.h());
    },
    h() {
      (d(r, "class", "font-bold text-xl mb-10 text-center border-slate-600 border-b-2 mx-2 my-4 py-2"),
        A(f.src, (_ = o[20].thumbnail_url || re)) || d(f, "src", _),
        d(f, "alt", "Video thumbnail"),
        d(
          f,
          "class",
          (m =
            X(
              `absolute w-full h-full object-cover opacity-100 ${o[20].preview_url ? "group-hover:opacity-0" : ""} transition-opacity duration-800 rounded-lg`,
            ) + " svelte-1irap3k"),
        ),
        d(n, "class", "relative w-3/4 h-48 mx-auto group rounded-lg bg-gray-200"),
        d($, "class", "text-gray-600 text-justify text-sm m-3 mx-6 mb-20 "),
        d(k, "class", "absolute bottom-0 right-0 mr-5 mb-5 bg-purple-800 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded"),
        d(t, "class", "bg-white shadow-lg rounded-lg overflow-hidden my-4 relative"));
    },
    m(i, u) {
      (j(i, t, u),
        y(t, r),
        y(r, l),
        y(t, s),
        y(t, n),
        y(n, f),
        y(n, p),
        c && c.m(n, null),
        y(t, b),
        y(t, $),
        y($, h),
        y(t, x),
        y(t, k),
        y(t, I),
        T || ((D = J(k, "click", a)), (T = !0)));
    },
    p(i, u) {
      ((o = i),
        u & 128 && e !== (e = o[20].title + "") && O(l, e),
        u & 128 && !A(f.src, (_ = o[20].thumbnail_url || re)) && d(f, "src", _),
        u & 128 &&
          m !==
            (m =
              X(
                `absolute w-full h-full object-cover opacity-100 ${o[20].preview_url ? "group-hover:opacity-0" : ""} transition-opacity duration-800 rounded-lg`,
              ) + " svelte-1irap3k") &&
          d(f, "class", m),
        o[20].preview_url ? (c ? c.p(o, u) : ((c = ne(o)), c.c(), c.m(n, null))) : c && (c.d(1), (c = null)),
        u & 128 && L !== (L = o[20].description + "") && O(h, L));
    },
    d(i) {
      (i && g(t), c && c.d(), (T = !1), D());
    },
  };
}
function Be(o) {
  let t,
    r = ee(o[7]),
    e = [];
  for (let l = 0; l < r.length; l += 1) e[l] = ie(se(o, r, l));
  return {
    c() {
      for (let l = 0; l < e.length; l += 1) e[l].c();
      t = U();
    },
    l(l) {
      for (let s = 0; s < e.length; s += 1) e[s].l(l);
      t = U();
    },
    m(l, s) {
      for (let n = 0; n < e.length; n += 1) e[n] && e[n].m(l, s);
      j(l, t, s);
    },
    p(l, s) {
      if (s & 640) {
        r = ee(l[7]);
        let n;
        for (n = 0; n < r.length; n += 1) {
          const f = se(l, r, n);
          e[n] ? e[n].p(f, s) : ((e[n] = ie(f)), e[n].c(), e[n].m(t.parentNode, t));
        }
        for (; n < e.length; n += 1) e[n].d(1);
        e.length = r.length;
      }
    },
    d(l) {
      (l && g(t), de(e, l));
    },
  };
}
function Me(o) {
  let t, r, e, l, s;
  const n = [Fe, ze, qe],
    f = [];
  function _(m, p) {
    return m[2] ? 0 : m[6].length > 0 || m[5] ? 1 : 2;
  }
  return (
    (r = _(o)),
    (e = f[r] = n[r](o)),
    {
      c() {
        ((t = P()), e.c(), (l = U()), this.h());
      },
      l(m) {
        (ue("svelte-1i6f1n5", le.head).forEach(g), (t = C(m)), e.l(m), (l = U()), this.h());
      },
      h() {
        le.title = "Videos";
      },
      m(m, p) {
        (j(m, t, p), f[r].m(m, p), j(m, l, p), (s = !0));
      },
      p(m, [p]) {
        let b = r;
        ((r = _(m)),
          r === b
            ? f[r].p(m, p)
            : (ge(),
              N(f[b], 1, 1, () => {
                f[b] = null;
              }),
              _e(),
              (e = f[r]),
              e ? e.p(m, p) : ((e = f[r] = n[r](m)), e.c()),
              S(e, 1),
              e.m(l.parentNode, l)));
      },
      i(m) {
        s || (S(e), (s = !0));
      },
      o(m) {
        (N(e), (s = !1));
      },
      d(m) {
        (m && (g(t), g(l)), f[r].d(m));
      },
    }
  );
}
const Re = "//assets.mediadelivery.net/playerjs/player-0.1.0.min.js",
  De = "https://www.youtube.com/iframe_api";
function He() {
  const o = document.createElement("script");
  ((o.src = Re), document.body.appendChild(o));
  var t = document.createElement("script");
  ((t.id = "iframe-demo"), (t.src = De));
  var r = document.getElementsByTagName("script")[0];
  r.parentNode.insertBefore(t, r);
}
function Ue(o, t, r) {
  let e,
    l = null,
    s,
    n,
    f = !1,
    _ = !1;
  const m = window.location.origin;
  let { lessonId: p } = t,
    b,
    $,
    L = [],
    h;
  function x(i) {
    const u = "&enablejsapi=1&origin=" + m;
    return i.includes("?") ? u : "?" + u.slice(1);
  }
  (ye.subscribe((i) => {
    r(7, (h = L.filter((u) => u.title.toLowerCase().includes(i.toLowerCase()))));
  }),
    ce(async () => {
      r(2, (f = !0));
      const [i, u] = await Promise.all([ve(), we(p)]);
      (r(1, (n = i == null ? void 0 : i.phone_number)),
        r(6, (L = u.videos)),
        r(5, ($ = u.live)),
        r(4, (b = u.lesson)),
        r(7, (h = L)),
        r(2, (f = !1)),
        He(),
        document.addEventListener("fullscreenchange", () => {
          (r(3, (_ = !!document.fullscreenElement)), T());
        }),
        Ce(Pe.lesson(b.title)));
    }));
  async function k() {
    try {
      const i = await $e($);
      window.open(i, "_tab");
    } catch {
      te.set({ message: "Zoom link not available", type: "warning" });
    }
  }
  async function q(i) {
    try {
      return (await be.getVideoLink(i)).video_url;
    } catch (u) {
      te.set({ message: u.message, type: "warning" });
    }
  }
  async function I(i) {
    const u = i.toString(),
      v = await q(u);
    if (!v) return;
    if (s)
      if (v.includes("youtube.com")) {
        const H = x(v);
        (s.src !== v + H && r(0, (s.src = v + H), s), (!e || l !== "youtube") && ((e = new YT.Player("videoIframe")), (l = "youtube")));
      } else
        (s.src !== v && r(0, (s.src = v), s),
          (l = "bunny"),
          (e = new playerjs.Player(s)),
          e.on("ready", () => {
            console.log("Player is ready");
          }));
    else console.error("Iframe element is not available");
    const w = document.getElementById("videoIframeContainer");
    (w &&
      ((w.style.display = "block"),
      w.requestFullscreen
        ? w.requestFullscreen()
        : w.mozRequestFullScreen
          ? w.mozRequestFullScreen()
          : w.webkitRequestFullscreen
            ? w.webkitRequestFullscreen()
            : w.msRequestFullscreen && w.msRequestFullscreen()),
      r(3, (_ = !0)));
  }
  function T() {
    if (e)
      switch (l) {
        case "bunny":
          e.pause();
          break;
        case "youtube":
          e.pauseVideo();
          break;
        default:
          console.log("Unsupported player type");
      }
  }
  const D = async (i) => await I(i.id),
    c = () => {
      (r(3, (_ = !1)), T());
    };
  function a(i) {
    me[i ? "unshift" : "push"](() => {
      ((s = i), r(0, s));
    });
  }
  return (
    (o.$$set = (i) => {
      "lessonId" in i && r(11, (p = i.lessonId));
    }),
    [s, n, f, _, b, $, L, h, k, I, T, p, D, c, a]
  );
}
class Ae extends K {
  constructor(t) {
    (super(), Q(this, t, Ue, Me, Y, { lessonId: 11 }));
  }
}
function Ge(o) {
  let t, r;
  return (
    (t = new Ae({ props: { lessonId: o[0].params.lessonID } })),
    {
      c() {
        R(t.$$.fragment);
      },
      l(e) {
        M(t.$$.fragment, e);
      },
      m(e, l) {
        (B(t, e, l), (r = !0));
      },
      p(e, [l]) {
        const s = {};
        (l & 1 && (s.lessonId = e[0].params.lessonID), t.$set(s));
      },
      i(e) {
        r || (S(t.$$.fragment, e), (r = !0));
      },
      o(e) {
        (N(t.$$.fragment, e), (r = !1));
      },
      d(e) {
        F(t, e);
      },
    }
  );
}
function Oe(o, t, r) {
  let e;
  return (pe(o, xe, (l) => r(0, (e = l))), [e]);
}
class ct extends K {
  constructor(t) {
    (super(), Q(this, t, Oe, Ge, Y, {}));
  }
}
export { ct as component };
