// Saatte bir çalışır: yaklaşan date'ler için 1 gün ve 2 saat önce hatırlatma gönderir.
import { init, db, sendToRoom, clip } from "../lib/shared.mjs";

export const config = { schedule: "@hourly" };

const H = 3600 * 1000;

export default async () => {
  init();
  const now = Date.now();
  const rooms = await db().collection("rooms").listDocuments();
  let total = 0;
  for (const roomRef of rooms) {
    const plans = await roomRef.collection("plans").where("done", "==", false).get();
    for (const p of plans.docs) {
      const d = p.data();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || "")) continue;
      const time = /^\d{2}:\d{2}$/.test(d.time || "") ? d.time : "19:00";
      const start = Date.parse(`${d.date}T${time}:00+03:00`); // Türkiye saati
      const left = start - now;
      if (left <= 0) continue;
      const title = clip(d.title, 70);
      const where = clip(d.place, 40);

      if (left <= 2.5 * H && !d.n2) {
        total += await sendToRoom(roomRef.id, {
          title: `Date'e az kaldı ⏰ ${time}`,
          body: `${title}${where ? " · " + where : ""}`,
          tag: "remind-" + p.id
        }, { pref: "remind" });
        await p.ref.update({ n2: true, n24: true });
      } else if (left <= 24 * H && left > 2.5 * H && !d.n24) {
        const tomorrow = new Date(now + 3 * H).toISOString().slice(0, 10) !== d.date;
        total += await sendToRoom(roomRef.id, {
          title: tomorrow ? `Yarın date var 💕 ${time}` : `Bugün date var 💕 ${time}`,
          body: `${title}${where ? " · " + where : ""}${d.note ? " — " + clip(d.note, 60) : ""}`,
          tag: "remind-" + p.id
        }, { pref: "remind" });
        await p.ref.update({ n24: true });
      }
    }
  }
  console.log("reminders sent:", total);
};
