//百老匯影城爬蟲上傳至 Firestore
import admin from 'firebase-admin';
import fs from 'fs';
import { dirname, join } from 'path';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';

chromium.use(stealth());
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Firebase 初始化 ---
// 優先讀取環境變數 (GitHub Actions 使用)，否則讀取本地檔案
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : JSON.parse(fs.readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 百老匯影城清單 (對應 Firestore ID 與 API 網址)
const broadwayCinemas = [
    { id: "broadway_taipei", name: "百老匯公館店", url: "https://www.broadway-cineplex.com.tw/Movie/GetMovieList/Taipei" },
    { id: "broadway_zhubei", name: "百老匯竹北店", url: "https://www.broadway-cineplex.com.tw/Movie/GetMovieList/Zhubei" }
];

async function runBroadwayCrawl() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const cinemaDataMap = new Map();

    console.log("🚀 百老匯 API 抓取啟動 (同步至 Firestore)...");

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
                    const moviesData = json.Data.map(movie => {
                        const allShowtimes = [];
                        const allVersions = [];

                        (movie.timedata || []).forEach(ver => {
                            const versionName = ver.SubName2 || "數位";
                            if (!allVersions.includes(versionName)) {
                                allVersions.push(versionName);
                            }

                            (ver.subtimedata || []).forEach(t => {
                                if (t["時間"]) {
                                    allShowtimes.push({
                                        "time": t["時間"],
                                        "ver": versionName
                                    });
                                }
                            });
                        });

                        return {
                            "title": movie.cname,
                            "versions": allVersions,
                            "showtimes": allShowtimes
                        };
                    }).filter(m => m.showtimes.length > 0);

                    // 存入 Map 以供後續 Firestore 寫入
                    cinemaDataMap.set(cinema.id, { 
                        cinemaName: cinema.name, 
                        movies: moviesData 
                    });
                    
                    console.log(`   ✅ ${cinema.name} 抓取成功，共 ${moviesData.length} 部電影`);
                }
            } else {
                console.log(`   ❌ ${cinema.name} 請求失敗，狀態碼: ${response.status()}`);
            }
        }

        // --- 🚀 同步至 Firestore ---
        console.log("\n📤 正在同步至 Firestore (realtime_showtimes)...");
        const batch = db.batch();
        
        for (const [cinemaId, data] of cinemaDataMap) {
            const docRef = db.collection('realtime_showtimes').doc(cinemaId);
            batch.set(docRef, {
                ...data,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        await batch.commit();
        console.log("✅ 全部百老匯影城資料同步成功！");

    } catch (err) {
        console.error("🔥 發生錯誤:", err.message);
        process.exit(1); // 確保 GitHub Actions 知道出錯了
    } finally {
        await browser.close();
    }
}

runBroadwayCrawl();