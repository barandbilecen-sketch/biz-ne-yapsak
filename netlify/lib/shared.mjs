import admin from "firebase-admin";
import webpush from "web-push";

let ready = false;
export function init() {
  if (ready) return;
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  ready = true;
}
export const db = () => admin.firestore();
export const auth = () => admin.auth();

/** Odadaki kişilere (except hariç) bildirim gönderir; tercihi kapalı olanları ve ölü abonelikleri atlar. */
export async function sendToRoom(room, { title, body, tag, url }, { except = null, only = null, pref = null } = {}) {
  const pushCol = db().collection("rooms").doc(room).collection("push");
  const snap = await pushCol.get();
  let sent = 0;
  for (const doc of snap.docs) {
    if (doc.id === except) continue;
    if (only && doc.id !== only) continue;
    const d = doc.data() || {};
    if (pref && d.prefs && d.prefs[pref] === false) continue;
    const subs = Array.isArray(d.subs) ? d.subs : [];
    const alive = [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub, JSON.stringify({ title, body, tag, url: url || "/#" + room }), { TTL: 60 * 60 * 12 });
        alive.push(sub); sent++;
      } catch (e) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) continue; // abonelik sona ermiş
        alive.push(sub);
      }
    }
    if (alive.length !== subs.length) await doc.ref.update({ subs: alive });
  }
  return sent;
}

export const clip = (s, n = 80) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
export const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
