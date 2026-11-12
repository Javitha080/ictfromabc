import { s as h, J as l, n as c, d as u, K as m, i as v, L as _, e as g, M as f, N as k, O as p, P as d } from "./CrD0m2hm.js";
import { g as w } from "./CgU5AtxT.js";
import { S as x, i as C } from "./DzXz5lJj.js";
var L = ((s) => ((s.AL_GRADE = "al"), (s.OL_GRADE = "ol"), (s.TUTES = "tutes"), (s.PDFS = "pdfs"), s))(L || {});
const S = { al: "A/L Courses", ol: "O/L Courses", tutes: "Buy Tutes", pdfs: "PDFs" };
function A(s) {
  let e,
    n,
    o =
      '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M38.33 28.254v-5.248h1.896c2.206 0 2.223 5.248-.031 5.248zM9.67 23.007v5.247H7.775c-2.206 0-2.223-5.248.032-5.248z"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M38.33 23.007c0-23.358-28.369-23.327-28.66 0m3.267-2.747v4.93m3.034-7.523v9.895m2.909-8.004v6.334m10.243 7.139v4.932m2.94-7.429v10.021m2.845-8.225v6.17"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m25.866 19.558l-.158 17.203c0 1.903-2.898 6.033-6.828 5.722c-5.606-.443-7.623-6.749-2.909-9.768c2.063-1.32 3.802-1.327 5.66-1.087l.315-20.442c1.996 2.58 4.73 4.322 7.682 6.165c5.192 3.24 7.247 8.152 3.136 11.254c-.238-2.2-.133-4.518-2.472-5.99c-1.437-1.04-2.956-2.158-4.426-3.057"/>',
    i = [{ viewBox: "0 0 48 48" }, { width: "1.2em" }, { height: "1.2em" }, s[0]],
    a = {};
  for (let t = 0; t < i.length; t += 1) a = l(a, i[t]);
  return {
    c() {
      ((e = k("svg")), (n = new p(!0)), this.h());
    },
    l(t) {
      e = _(t, "svg", { viewBox: !0, width: !0, height: !0 });
      var r = g(e);
      ((n = f(r, !0)), r.forEach(u), this.h());
    },
    h() {
      ((n.a = null), m(e, a));
    },
    m(t, r) {
      (v(t, e, r), n.m(o, e));
    },
    p(t, [r]) {
      m(e, (a = w(i, [{ viewBox: "0 0 48 48" }, { width: "1.2em" }, { height: "1.2em" }, r & 1 && t[0]])));
    },
    i: c,
    o: c,
    d(t) {
      t && u(e);
    },
  };
}
function B(s, e, n) {
  return (
    (s.$$set = (o) => {
      n(0, (e = l(l({}, e), d(o))));
    }),
    (e = d(e)),
    [e]
  );
}
class j extends x {
  constructor(e) {
    (super(), C(this, e, B, A, h, {}));
  }
}
export { L as C, j as V, S as g };
