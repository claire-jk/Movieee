// crawler.js
// Node.js script: 抓取「全台影城（多來源）」+ 場次，fallback 手動清單，並寫入 Firebase

import * as cheerio from "cheerio";
import admin from "firebase-admin";
import cron from "node-cron";
import fetch from "node-fetch";

// ===== Firebase 初始化 =====
import serviceAccount from "./serviceAccount.json" with { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ===== fallback 清單 =====
const fallbackCinemas = [
  { name: "台北京站威秀", source: "vieshow", url: "https://www.vscinemas.com.tw/" },
  { name: "美麗華大直影城", source: "miramar", url: "https://www.miramarcinemas.tw/" },
  { name: "秀泰影城", source: "showtime", url: "https://www.showtimes.com.tw/" },
  { name: "國賓影城", source: "ambassador", url: "https://www.ambassador.com.tw/" }
];

// ===== 通用 fetch（防擋） =====
async function safeFetch(url) {
  return fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });
}

// ===== 威秀影城 =====
async function fetchVieShowCinemas() {
  try {
    const res = await safeFetch("https://www.vscinemas.com.tw/vsweb/theater/index.aspx");
    const html = await res.text();
    const $ = cheerio.load(html);

    let cinemas = [];

    $(".theaterList a").each((i, el) => {
      const name = $(el).text().trim();
      const url = $(el).attr("href");

      if (name && url) {
        cinemas.push({
          name,
          source: "vieshow",
          url: "https://www.vscinemas.com.tw" + url
        });
      }
    });

    return cinemas;
  } catch {
    return [];
  }
}

// ===== 秀泰影城（簡化版） =====
async function fetchShowtimeCinemas() {
  try {
    return [
      { name: "秀泰台北站前", source: "showtime", url: "https://www.showtimes.com.tw/" },
      { name: "秀泰台中", source: "showtime", url: "https://www.showtimes.com.tw/" }
    ];
  } catch {
    return [];
  }
}

// ===== 國賓影城（簡化版） =====
async function fetchAmbassadorCinemas() {
  try {
    return [
      { name: "國賓台北長春", source: "ambassador", url: "https://www.ambassador.com.tw/" }
    ];
  } catch {
    return [];
  }
}

// ===== 整合全台影城 =====
async function fetchAllCinemas() {
  const results = await Promise.all([
    fetchVieShowCinemas(),
    fetchShowtimeCinemas(),
    fetchAmbassadorCinemas()
  ]);

  const cinemas = results.flat();

  if (cinemas.length === 0) {
    console.log("⚠️ 無法抓取影城，使用 fallback");
    return fallbackCinemas;
  }

  console.log(`✅ 抓到 ${cinemas.length} 間影城`);
  return cinemas;
}

// ===== 抓場次（依來源切換） =====
async function fetchShowtimes(cinema) {
  try {
    const res = await safeFetch(cinema.url);
    const html = await res.text();
    const $ = cheerio.load(html);

    let movies = [];

    // 通用解析（不同網站可能需客製）
    $(".movieList .movie").each((i, el) => {
      const title = $(el).find(".title").text().trim();
      let times = [];

      $(el).find(".time").each((j, t) => {
        times.push($(t).text().trim());
      });

      if (title && times.length > 0) {
        movies.push({
          title,
          showtimes: times,
          date: new Date().toISOString().split("T")[0]
        });
      }
    });

    return {
      cinemaName: cinema.name,
      source: cinema.source,
      movies,
      updatedAt: new Date()
    };
  } catch {
    console.log(`❌ ${cinema.name} 抓取失敗`);
    return null;
  }
}

// ===== Firebase =====
async function saveToFirebase(data) {
  const batch = db.batch();

  data.forEach(cinemaData => {
    if (!cinemaData) return;

    const ref = db.collection("cinemas").doc(cinemaData.cinemaName);

    batch.set(ref, cinemaData);
  });

  await batch.commit();
  console.log("✅ Firebase 更新完成");
}

// ===== 主流程 =====
async function main() {
  console.log("🎬 開始抓全台影城...");

  const cinemas = await fetchAllCinemas();

  let results = [];

  for (const cinema of cinemas) {
    console.log(`➡️ ${cinema.name}`);
    const data = await fetchShowtimes(cinema);
    results.push(data);
  }

  await saveToFirebase(results);

  console.log("🎉 完成");
}

// ===== 排程（每30分鐘） =====
cron.schedule("*/30 * * * *", () => {
  main();
});

// 初次執行
main();