import { a as i, p as t, d as n } from "./gH3D-RDX.js";
const s = {
  fetchPracticalSessions: async () => await i("/practical-sessions"),
  cancelPracticalSessionBooking: async (a) => await n(`/practical-sessions/${a}`),
  bookPracticalSession: async (a) => await t(`/practical-sessions/${a}`, null, ""),
  getPracticalSessionAvailability: async () => await i("/practical-sessions/availability"),
};
async function e() {
  return await (await s.fetchPracticalSessions()).json();
}
async function r(a) {
  return await s.cancelPracticalSessionBooking(a);
}
async function l(a) {
  return await s.bookPracticalSession(a);
}
async function p() {
  return await (await s.getPracticalSessionAvailability()).json();
}
export { p as a, l as b, r as c, e as f };
