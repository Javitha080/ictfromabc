import { p as i, a as r } from "./gH3D-RDX.js";
const t = {
  checkModelPaperAvailability: async () => {
    const a = await r("/model-papers/availability");
    if (!a.ok) throw new Error("Failed to fetch model paper availability");
    return a.json();
  },
  getModelPapers: async () => {
    const a = await r("/model-papers");
    if (!a.ok) throw new Error("Failed to fetch model paper availability");
    return a.json();
  },
  uploadAnswers: async (a, o) => {
    const e = await i(`/model-papers/upload/${a}`, o, "");
    if (!e.ok) throw new Error("Failed to fetch model paper availability");
    return e.json();
  },
};
async function l() {
  return { availability: (await t.checkModelPaperAvailability()).availability };
}
async function p() {
  return await t.getModelPapers();
}
async function c(a, o) {
  const e = new FormData();
  return (e.append("file", o), await t.uploadAnswers(a, e));
}
export { l as c, p as f, c as u };
