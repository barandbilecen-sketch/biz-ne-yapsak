// Uygulamadan çağrılır: beğeni, eşleşme, yeni plan bildirimleri
import { init, db, auth, sendToRoom, clip, json } from "../lib/shared.mjs";

const AY = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    init();
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "auth" }, 401);
    const { uid } = await auth().verifyIdToken(token);

    const b = await req.json();
    const room = String(b.room || "").toUpperCase();
    if (!/^[A-Z0-9]{6,12}$/.test(room)) return json({ error: "room" }, 400);

    // Gönderen bu odanın üyesi mi?
    const me = await db().collection("rooms").doc(room).collection("members").doc(uid).get();
    if (!me.exists) return json({ error: "not_member" }, 403);
    const name = clip(me.data().name, 24) || "Sevgilin";

    let msg, pref;
    if (b.type === "love") {
      const items = (Array.isArray(b.items) ? b.items : []).map((x) => clip(x, 60)).filter(Boolean).slice(0, 5);
      if (!items.length) return json({ ok: true, sent: 0 });
      msg = {
        title: items.length > 1 ? `${name} ${items.length} fikre bayıldı 💗` : `${name} bir fikre bayıldı 💗`,
        body: items.join(" · "),
        tag: "love"
      };
      pref = "love";
    } else if (b.type === "match") {
      const t = clip(b.title, 70);
      msg = { title: "Eşleşme! 💞", body: `İkiniz de "${t}" fikrine bayıldınız. Takvime koyalım mı?`, tag: "match" };
      pref = "match";
    } else if (b.type === "plan") {
      const t = clip(b.title, 70);
      let when = "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(b.date || "")) {
        const [, m, d] = b.date.split("-").map(Number);
        when = ` · ${d} ${AY[m - 1]}${/^\d{2}:\d{2}$/.test(b.time || "") ? " " + b.time : ""}`;
      }
      msg = { title: `${name} bir date planladı 📅`, body: t + when, tag: "plan" };
      pref = "plan";
    } else if (b.type === "test") {
      msg = { title: "Bildirimler açık 🎉", body: "Artık planlar, beğeniler ve yaklaşan date'ler için haber alacaksın.", tag: "test" };
      const sent = await sendToRoom(room, msg, { only: uid });
      // test sadece gönderenin kendisine
      return json({ ok: true, sent });
    } else {
      return json({ error: "type" }, 400);
    }

    const sent = await sendToRoom(room, msg, { except: uid, pref });
    return json({ ok: true, sent });
  } catch (e) {
    console.error(e);
    return json({ error: "server" }, 500);
  }
};
