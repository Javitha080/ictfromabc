import { s as o, n as i, d as r, a as c, i as l, b as m, q as h, c as d, e as f, f as u, h as p, t as _ } from "./CrD0m2hm.js";
import { S as x, i as y } from "./DzXz5lJj.js";
function g(n) {
  let e, a;
  return {
    c() {
      ((e = p("div")), (a = _(n[0])), this.h());
    },
    l(t) {
      e = d(t, "DIV", { class: !0 });
      var s = f(e);
      ((a = u(s, n[0])), s.forEach(r), this.h());
    },
    h() {
      h(e, "class", "flex text-xl justify-center py-4 text-gray-400 px-4 rounded h-full items-center");
    },
    m(t, s) {
      (l(t, e, s), m(e, a));
    },
    p(t, [s]) {
      s & 1 && c(a, t[0]);
    },
    i,
    o: i,
    d(t) {
      t && r(e);
    },
  };
}
function v(n, e, a) {
  let { message: t = "The Search Does not Match Any Items" } = e;
  return (
    (n.$$set = (s) => {
      "message" in s && a(0, (t = s.message));
    }),
    [t]
  );
}
class q extends x {
  constructor(e) {
    (super(), y(this, e, v, g, o, { message: 0 }));
  }
}
export { q as E };
