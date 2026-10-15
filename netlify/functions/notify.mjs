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
    } else if (b.type === "note") {
      const t = clip(b.text, 120);
      const n = Math.max(0, Math.min(4, +b.photos || 0));
      msg = {
        title: `${name} sana bir not bıraktı 💌`,
        body: t ? (n ? `📷 ${t}` : t) : (n > 1 ? `${n} fotoğraf gönderdi` : "Bir fotoğraf gönderdi"),
        tag: "note-" + Date.now()
      };
      pref = "note";
    } else if (b.type === "photo") {
      const t = clip(b.title, 60);
      const n = Math.max(1, Math.min(12, +b.count || 1));
      msg = { title: `${name} ${n > 1 ? n + " fotoğraf" : "bir fotoğraf"} ekledi 📸`, body: t ? `"${t}" sayfası albümde seni bekliyor` : "Albüme göz at", tag: "photo-" + Date.now() };
      pref = "photo";
    } else if (b.type === "memory") {
      msg = { title: `${name} bir anı yazdı ✍️`, body: `${clip(b.title, 50)}: “${clip(b.text, 100)}”`, tag: "memory-" + Date.now() };
      pref = "other";
    } else if (b.type === "done") {
      msg = { title: `"${clip(b.title, 50)}" tamamlandı 🎉`, body: `${name} işaretledi. Yıldız verip fotoğraf eklemeyi unutmayın!`, tag: "done" };
      pref = "other";
    } else if (b.type === "idea") {
      msg = { title: `${name} yeni bir fikir ekledi 💡`, body: clip(b.title, 80), tag: "idea" };
      pref = "other";
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
