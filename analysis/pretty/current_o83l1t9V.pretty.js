import { R as p } from "./IzJ_YNVj.js";
import { a as w } from "./BgTg2qdf.js";
import { b as i, a as r, g as l, p as e, d } from "./gH3D-RDX.js";
const h = {
  getAdminLessons: async () => {
    const t = await r("/admin/lessons");
    if (!t.ok) throw new Error("Failed to fetch lessons");
    return await t.json();
  },
  getZoomLinks: async () => {
    const t = await r("/admin/zoom");
    if (!t.ok) throw new Error("Failed to fetch zoom links");
    return await t.json();
  },
  getAdminVideos: async (t) => {
    const a = await r(`/admin/lessons/${t}`);
    if (!a.ok) throw new Error("Failed to fetch videos");
    return await a.json();
  },
  getAdmins: async () => {
    const t = await r("/admin/admins");
    if (!t.ok) throw new Error("Failed to fetch admins");
    return await t.json();
  },
  getStudentDetails: async (t) => {
    const a = await r(`/admin/users/${t}`);
    if (!a.ok) throw new Error("Failed to fetch user details");
    return await a.json();
  },
  checkNIC: async (t, a) => {
    const o = await e(`/admin/id/${t}/${a}`, { comments: "" }, "application/json");
    if (!o.ok) throw new Error("Failed to update status");
    return await o.json();
  },
  checkPayment: async (t, a) => {
    const o = await e(`/admin/check/${t}/${a}`, { comments: "" }, "application/json");
    if (!o.ok) throw new Error("Failed to update status");
    return await o.json();
  },
  checkRequest: async (t, a) => {
    const o = await e(`/admin/applied/${t}/${a}`, { comments: "" }, "application/json");
    if (!o.ok) throw new Error("Failed to update status");
    return await o.json();
  },
  createNewCourse: async (t) => {
    const a = await e("/admin/courses", t, "application/json");
    if (!a.ok) throw new Error("Failed to create new course");
    return await a.json();
  },
  createNewLesson: async (t) => {
    const a = await e("/admin/lessons", t, "application/json");
    if (!a.ok) throw new Error("Failed to create new lesson");
    return await a.json();
  },
  UpdateLesson: async (t) => {
    const a = await e(`/admin/lessons/${t.id}`, t, "application/json");
    if (!a.ok) throw new Error("Failed to update lesson");
    return await a.json();
  },
  createNewZoomLink: async (t) => {
    const a = { topic: t.topic, description: t.description, start_time: t.start_time, duration: t.duration, lesson_ids: t.lessonIds, type: t.type },
      o = await e("/admin/zoom/", a, "application/json");
    if (!o.ok) throw new Error("Failed to create new zoom link");
    return await o.json();
  },
  addRole: async (t) => {
    const a = await e("/admin/admins/role", { title: t }, "application/json");
    if (!a.ok) throw new Error("Failed to add role");
    return await a.json();
  },
  addVideoLink: async (t) => {
    const a = await e("/admin/videos", t, "application/json"),
      o = await a.json();
    if (!a.ok) {
      const s = o.errors[Object.keys(o.errors)[0]][0];
      throw new Error(s);
    }
    return (await w([o]))[0];
  },
  updateVideoLink: async (t, a) => {
    const o = await e(`/admin/videos/${t}`, a, "application/json");
    if (!o.ok) throw new Error("Failed to update video link");
    const n = await o.json();
    return (await w([n]))[0];
  },
  deleteLesson: async (t) => {
    const a = await d(`/admin/lessons/${t}`);
    if (!a.ok) throw new Error("Failed to delete lesson");
    return a.ok;
  },
  deleteAdmin: async (t) => {
    const a = await d(`/admin/admins/${t}`);
    if (!a.ok) throw new Error("Failed to delete admin");
    return a.ok;
  },
  addAdmin: async (t) => {
    const a = new FormData();
    for (const s in t) t[s] === null || t[s] === void 0 || a.append(s, t[s]);
    const o = await e("/admin/add-admin", a, "");
    if (!o.ok) throw new Error("Failed to add admin");
    return await o.json();
  },
  updateAdmin: async (t, a) => {
    const o = new FormData();
    for (const c in a) o.append(c, a[c]);
    o.append("_method", "PUT");
    const n = await e(`/admin/admins/${t}`, o, "");
    if (!n.ok) throw new Error("Failed to update admin");
    return await n.json();
  },
  deleteZoomLink: async (t) => {
    const a = await d(`/admin/zoom/${t}`);
    if (!a.ok) throw new Error("Failed to delete zoom link");
    return await a.json();
  },
  deleteVideoLink: async (t) => {
    if (!(await d(`/admin/videos/${t}`)).ok) throw new Error("Failed to delete video link");
  },
  deleteCourse: async (t) => {
    if (!(await d(`/admin/courses/${t}`)).ok) throw new Error("Failed to delete course");
  },
  toggleLessonStatus: async (t) => {
    const a = await i(`/admin/lessons/${t}/toggle-status-all`, {}, "application/json");
    if (!a.ok) throw new Error("Failed to toggle status");
    return await a.json();
  },
  toggleCourseStatus: async (t) => {
    const a = await i(`/admin/courses/${t}/toggle-status-all`, {}, "application/json");
    if (!a.ok) throw new Error("Failed to toggle status");
    return await a.json();
  },
  toggleVideoStatus: async (t) => {
    const a = await i(`/admin/videos/${t}/toggle-status`, {}, "application/json");
    if (!a.ok) throw new Error("Failed to toggle status");
    return await a.json();
  },
  updateCourseInfo: async (t, a) => {
    a._method = "PUT";
    const o = await e(`/admin/courses/${t}`, a, "application/json");
    if (!o.ok) throw new Error("Failed to update course");
    return await o.json();
  },
  getFile: async (t) => {
    const a = await r(`/admin/check/${t}`);
    if (!a.ok) throw new Error("Failed to get file");
    return await a.blob();
  },
  toggleStudentStatus: async (t) => {
    const a = await i(`/admin/users/${t}`, {}, "application/json");
    if (!a.ok) throw new Error("Failed to toggle status");
    return await a.json();
  },
  changePassword: async (t) => {
    if (!(await i(`/admin/users/${t}/reset-password`, {}, "application/json")).ok) throw new Error("Failed to change password");
  },
  getPaginationNextPage: async (t) => {
    const a = await l(t);
    if (!a.ok) throw new Error("Failed to fetch next page");
    const o = await a.json();
    return { data: o.data, nextPage: o.next_page_url };
  },
  getReviews: async (t = p.ALL) => {
    const a = new URLSearchParams();
    t !== "all" && a.set("status", t);
    const o = await r(`/admin/reviews?${a.toString()}`);
    if (!o.ok) throw new Error("Failed to fetch reviews");
    return await o.json();
  },
  updateReviewStatus: async (t, a) => {
    const o = await i(`/admin/reviews/${t}`, { status: a }, "application/json");
    if (!o.ok) throw new Error("Failed to update review status");
    return await o.json();
  },
};
export { h as a };
