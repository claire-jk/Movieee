import admin from 'firebase-admin';
import fs from 'fs';
import { dirname, join } from 'path';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';

chromium.use(stealth());
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 🛠️ 修正 1：完全依照測試腳本的日期取得邏輯 (ISO 格式：2026-03-26)
const today = new Date().toISOString().split('T')[0];

// --- Firebase 初始化 ---
const serviceAccountPath = join(__dirname, 'serviceAccount.json');
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const broadwayCinemas = [
    { id: "broadway_taipei", name: "百老匯公館店", url: "https://www.broadway-cineplex.com.tw/Movie/GetMovieList/Taipei" },
    { id: "broadway_zhubei", name: "百老匯竹北店", url: "https://www.broadway-cineplex.com.tw/Movie/GetMovieList/Zhubei" }
];

async function runBroadwayCrawl() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const cinemaDataMap = new Map();

    console.log(`🚀 百老匯 API 啟動 - 目標日期：${today}`);

    try {
        for (const cinema of broadwayCinemas) {
            console.log(`📡 正在抓取: ${cinema.name}...`);
            
            const response = await context.request.get(cinema.url, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://www.broadway-cineplex.com.tw/book.html'
                }
            });

            if (response.ok()) {
                const json = await response.json();
                
                if (json.status && Array.isArray(json.Data)) {
                    const moviesToday = [];

                    json.Data.forEach(movie => {
                        const movieEntry = {
                            title: movie.cname,
                            versions: [],
                            showtimes: []
                        };

                        (movie.timedata || []).forEach(ver => {
                            const versionName = ver.SubName2 || "數位";

                            (ver.subtimedata || []).forEach(t => {
                                // 🛠️ 修正 2：完全依照測試腳本的比對邏輯
                                // 取得 PlayDate 並將斜線換成橫線
                                const playDate = t["PlayDate"] ? t["PlayDate"].split(' ')[0].replace(/\//g, '-') : today;

                                if (playDate === today) {
                                    if (!movieEntry.versions.includes(versionName)) {
                                        movieEntry.versions.push(versionName);
                                    }
                                    movieEntry.showtimes.push({
                                        time: t["時間"],
                                        ver: versionName
                                    });
                                }
                            });
                        });

                        // 排序場次
                        if (movieEntry.showtimes.length > 0) {
                            movieEntry.showtimes.sort((a, b) => a.time.localeCompare(b.time));
                            moviesToday.push(movieEntry);
                        }
                    });

                    cinemaDataMap.set(cinema.id, { 
                        cinemaName: cinema.name, 
                        date: today,
                        movies: moviesToday 
                    });
                    
                    console.log(`   ✅ ${cinema.name} 解析完成，今日共有 ${moviesToday.length} 部電影場次`);
                }
            } else {
                console.log(`   ❌ ${cinema.name} 請求失敗`);
            }
        }

        // --- 📤 同步至 Firestore ---
        if (cinemaDataMap.size > 0) {
            console.log("\n📤 正在同步至 Firestore...");
            const batch = db.batch();
            for (const [cinemaId, data] of cinemaDataMap) {
                const docRef = db.collection('realtime_showtimes').doc(cinemaId);
                batch.set(docRef, {
                    ...data,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
            await batch.commit();
            console.log("✅ 全部百老匯資料同步成功！");
        } else {
            console.log("\n⚠️ 無今日資料，跳過 Firestore 更新");
        }

    } catch (err) {
        console.error("🔥 嚴重錯誤:", err.message);
    } finally {
        await browser.close();
        console.log("🏁 任務結束");
    }
}

runBroadwayCrawl();