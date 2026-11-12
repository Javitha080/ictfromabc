import { A as j } from "../chunks/ICWD8bEM.js";
import { b as q } from "../chunks/ykit6GOS.js";
import {
  s as B,
  J as N,
  n as $,
  d as p,
  K as S,
  i as g,
  L as x,
  e as C,
  M as F,
  N as J,
  O as M,
  P as D,
  F as z,
  g as T,
  G as L,
  j as I,
  k as K,
  C as U,
  w as Q,
  q as O,
  c as R,
  h as V,
} from "../chunks/CrD0m2hm.js";
import { S as P, i as G, d as b, t as d, a as _, g as H, c as W, m as v, b as w, e as k } from "../chunks/DzXz5lJj.js";
import { H as X } from "../chunks/Dhmb1UwJ.js";
import { E as Y } from "../chunks/BEehUGop.js";
import { L as Z } from "../chunks/DxjtTLou.js";
import { s as ee } from "../chunks/DwVtshrH.js";
import { E as te } from "../chunks/DbJp5i6b.js";
import { c as se } from "../chunks/B7szV-kk.js";
import { g as re } from "../chunks/CgU5AtxT.js";
import { s as ne, b as oe } from "../chunks/BrY_1-xV.js";
const le = async ({ params: a }) => {
    let t = a.course,
      s = [];
    try {
      (await q(s, t),
        s.sort((e, r) =>
          e.lessonStatus === "ALLOWED" && r.lessonStatus !== "ALLOWED"
            ? -1
            : e.lessonStatus !== "ALLOWED" && r.lessonStatus === "ALLOWED"
              ? 1
              : e.lessonStatus === "PENDING" && r.lessonStatus !== "PENDING"
                ? -1
                : e.lessonStatus !== "PENDING" && r.lessonStatus === "PENDING"
                  ? 1
                  : 0,
        ));
    } catch {
      j.set({ message: "Failed to load lessons", type: "error" });
    }
    return { courseID: t, lessons: s };
  },
  De = Object.freeze(Object.defineProperty({ __proto__: null, load: le }, Symbol.toStringTag, { value: "Module" }));
function ae(a) {
  let t,
    s,
    e =
      '<path fill="currentColor" d="m20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42l10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001l-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15l4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434"/>',
    r = [{ viewBox: "0 0 24 24" }, { width: "1.2em" }, { height: "1.2em" }, a[0]],
    o = {};
  for (let n = 0; n < r.length; n += 1) o = N(o, r[n]);
  return {
    c() {
      ((t = J("svg")), (s = new M(!0)), this.h());
    },
    l(n) {
      t = x(n, "svg", { viewBox: !0, width: !0, height: !0 });
      var i = C(t);
      ((s = F(i, !0)), i.forEach(p), this.h());
    },
    h() {
      ((s.a = null), S(t, o));
    },
    m(n, i) {
      (g(n, t, i), s.m(e, t));
    },
    p(n, [i]) {
      S(t, (o = re(r, [{ viewBox: "0 0 24 24" }, { width: "1.2em" }, { height: "1.2em" }, i & 1 && n[0]])));
    },
    i: $,
    o: $,
    d(n) {
      n && p(t);
    },
  };
}
function ie(a, t, s) {
  return (
    (a.$$set = (e) => {
      s(0, (t = N(N({}, t), D(e))));
    }),
    (t = D(t)),
    [t]
  );
}
class ce extends P {
  constructor(t) {
    (super(), G(this, t, ie, ae, B, {}));
  }
}
function A(a) {
  let t, s, e, r, o;
  return (
    (s = new ce({ props: { height: "30px", width: "30px", color: "white" } })),
    {
      c() {
        ((t = V("button")), k(s.$$.fragment), this.h());
      },
      l(n) {
        t = R(n, "BUTTON", { class: !0, title: !0 });
        var i = C(t);
        (w(s.$$.fragment, i), i.forEach(p), this.h());
      },
      h() {
        (O(t, "class", "gap-1 items-center flex hover:opacity-75"), O(t, "title", "Join Telegram Group"));
      },
      m(n, i) {
        (g(n, t, i), v(s, t, null), (e = !0), r || ((o = Q(t, "click", a[6])), (r = !0)));
      },
      p: $,
      i(n) {
        e || (_(s.$$.fragment, n), (e = !0));
      },
      o(n) {
        (d(s.$$.fragment, n), (e = !1));
      },
      d(n) {
        (n && p(t), b(s), (r = !1), o());
      },
    }
  );
}
function ue(a) {
  let t,
    s,
    e = a[3] && A(a);
  return {
    c() {
      (e && e.c(), (t = L()));
    },
    l(r) {
      (e && e.l(r), (t = L()));
    },
    m(r, o) {
      (e && e.m(r, o), g(r, t, o), (s = !0));
    },
    p(r, o) {
      r[3]
        ? e
          ? (e.p(r, o), o & 8 && _(e, 1))
          : ((e = A(r)), e.c(), _(e, 1), e.m(t.parentNode, t))
        : e &&
          (H(),
          d(e, 1, 1, () => {
            e = null;
          }),
          W());
    },
    i(r) {
      s || (_(e), (s = !0));
    },
    o(r) {
      (d(e), (s = !1));
    },
    d(r) {
      (r && p(t), e && e.d(r));
    },
  };
}
function fe(a) {
  let t, s;
  return (
    (t = new Z({ props: { filteredLessons: a[2] } })),
    {
      c() {
        k(t.$$.fragment);
      },
      l(e) {
        w(t.$$.fragment, e);
      },
      m(e, r) {
        (v(t, e, r), (s = !0));
      },
      p(e, r) {
        const o = {};
        (r & 4 && (o.filteredLessons = e[2]), t.$set(o));
      },
      i(e) {
        s || (_(t.$$.fragment, e), (s = !0));
      },
      o(e) {
        (d(t.$$.fragment, e), (s = !1));
      },
      d(e) {
        b(t, e);
      },
    }
  );
}
function me(a) {
  let t, s;
  return (
    (t = new Y({ props: { message: "No lessons available." } })),
    {
      c() {
        k(t.$$.fragment);
      },
      l(e) {
        w(t.$$.fragment, e);
      },
      m(e, r) {
        (v(t, e, r), (s = !0));
      },
      p: $,
      i(e) {
        s || (_(t.$$.fragment, e), (s = !0));
      },
      o(e) {
        (d(t.$$.fragment, e), (s = !1));
      },
      d(e) {
        b(t, e);
      },
    }
  );
}
function _e(a) {
  let t, s;
  return (
    (t = new te({ props: { message: "No lessons available." } })),
    {
      c() {
        k(t.$$.fragment);
      },
      l(e) {
        w(t.$$.fragment, e);
      },
      m(e, r) {
        (v(t, e, r), (s = !0));
      },
      p: $,
      i(e) {
        s || (_(t.$$.fragment, e), (s = !0));
      },
      o(e) {
        (d(t.$$.fragment, e), (s = !1));
      },
      d(e) {
        b(t, e);
      },
    }
  );
}
function pe(a) {
  let t, s, e, r, o, n, i, u;
  ((document.title = t = a[0]), (e = new X({ props: { title: a[0], $$slots: { default: [ue] }, $$scope: { ctx: a } } })));
  const h = [_e, me, fe],
    f = [];
  function m(l, c) {
    return l[1].length === 0 ? 0 : l[2].length === 0 ? 1 : 2;
  }
  return (
    (o = m(a)),
    (n = f[o] = h[o](a)),
    {
      c() {
        ((s = I()), k(e.$$.fragment), (r = I()), n.c(), (i = L()));
      },
      l(l) {
        (z("svelte-uowv43", document.head).forEach(p), (s = T(l)), w(e.$$.fragment, l), (r = T(l)), n.l(l), (i = L()));
      },
      m(l, c) {
        (g(l, s, c), v(e, l, c), g(l, r, c), f[o].m(l, c), g(l, i, c), (u = !0));
      },
      p(l, [c]) {
        (!u || c & 1) && t !== (t = l[0]) && (document.title = t);
        const y = {};
        (c & 1 && (y.title = l[0]), c & 264 && (y.$$scope = { dirty: c, ctx: l }), e.$set(y));
        let E = o;
        ((o = m(l)),
          o === E
            ? f[o].p(l, c)
            : (H(),
              d(f[E], 1, 1, () => {
                f[E] = null;
              }),
              W(),
              (n = f[o]),
              n ? n.p(l, c) : ((n = f[o] = h[o](l)), n.c()),
              _(n, 1),
              n.m(i.parentNode, i)));
      },
      i(l) {
        u || (_(e.$$.fragment, l), _(n), (u = !0));
      },
      o(l) {
        (d(e.$$.fragment, l), d(n), (u = !1));
      },
      d(l) {
        (l && (p(s), p(r), p(i)), b(e, l), f[o].d(l));
      },
    }
  );
}
function de(a, t, s) {
  let e, r, o, n, i;
  K(a, ee, (m) => s(5, (i = m)));
  let { data: u } = t;
  const h = U(se),
    f = () => window.open(o, "_blank");
  return (
    (a.$$set = (m) => {
      "data" in m && s(4, (u = m.data));
    }),
    (a.$$.update = () => {
      var m, l;
      (a.$$.dirty & 16 && s(1, (e = u.lessons)),
        a.$$.dirty & 16 && s(0, (r = (m = h.find((c) => c.id === u.courseID)) == null ? void 0 : m.title)),
        a.$$.dirty & 16 && s(3, (o = (l = h.find((c) => c.id === u.courseID)) == null ? void 0 : l.telegram_link)),
        a.$$.dirty & 34 && s(2, (n = e.filter((c) => c.title.toLowerCase().includes(i.toLowerCase())))),
        a.$$.dirty & 1 && r && ne(oe.course(r)));
    }),
    [r, e, n, o, u, i, f]
  );
}
class Te extends P {
  constructor(t) {
    (super(), G(this, t, de, pe, B, { data: 4 }));
  }
}
export { Te as component, De as universal };
