import admin from 'firebase-admin';
import fs from 'fs';
import { dirname, join } from 'path';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';

chromium.use(stealth());
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 🔥 1. 取得台灣當天日期 (用於寫入資料庫標記)
const now = new Date();
const todayFullStr = now.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' });

// --- Firebase 初始化 ---
const serviceAccountPath = join(__dirname, 'serviceAccount.json');
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 秀泰影城清單 (含座標)
const stCinemas = [
  { "id": "st_keelung", "name": "基隆秀泰影城", "lat": 25.1301, "lng": 121.7441, "city": "基隆市" },
  { "id": "st_today", "name": "台北欣欣秀泰影城", "lat": 25.0537, "lng": 121.5262, "city": "台北市" },
  { "id": "st_dome", "name": "台北大巨蛋秀泰影城", "lat": 25.0441, "lng": 121.5606, "city": "台北市" },
  { "id": "st_shulin", "name": "樹林秀泰影城", "lat": 24.9926, "lng": 121.4259, "city": "新北市" },
  { "id": "st_tucheng", "name": "土城秀泰影城", "lat": 24.9785, "lng": 121.4449, "city": "新北市" },
  { "id": "st_taichung_station", "name": "台中站前秀泰影城", "lat": 24.1378, "lng": 120.6901, "city": "台中市" },
  { "id": "st_wenxin", "name": "台中文心秀泰影城", "lat": 24.1275, "lng": 120.6483, "city": "台中市" },
  { "id": "st_lihpaio", "name": "台中麗寶秀泰影城", "lat": 24.3218, "lng": 120.6946, "city": "台中市" },
  { "id": "st_beigang", "name": "雲林北港秀泰影城", "lat": 23.5753, "lng": 120.3013, "city": "雲林縣" },
  { "id": "st_chiayi", "name": "嘉義秀泰影城", "lat": 23.4842, "lng": 120.4444, "city": "嘉義市" },
  { "id": "st_rende", "name": "台南仁德秀泰影城", "lat": 22.9733, "lng": 120.2503, "city": "台南市" },
  { "id": "st_gangshan", "name": "高雄岡山秀泰影城", "lat": 22.7845, "lng": 120.3049, "city": "高雄市" },
  { "id": "st_dream_mall", "name": "高雄夢時代秀泰影城", "lat": 22.5951, "lng": 120.3069, "city": "高雄市" },
  { "id": "st_hualien", "name": "花蓮秀泰影城", "lat": 23.9929, "lng": 121.6062, "city": "花蓮縣" },
  { "id": "st_taitung", "name": "台東秀泰影城", "lat": 22.7523, "lng": 121.1507, "city": "台東縣" }
];

function cleanMovieTitle(fullTitle) {
    return fullTitle.replace(/\(.*?\)/g, '')
        .replace(/3D|4DX|IMAX|SCREENX|數位|英|日|國|分級|普遍級|保護級|輔12級|輔15級|限制級/gi, '')
        .replace(/\s+/g, ' ').trim();
}

async function runStCrawl() {
    console.log(`\n⏰ 啟動秀泰更新任務: ${todayFullStr}`);
    const browser = await chromium.launch({ headless: true }); 
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    let page = await context.newPage();
    const cinemaDataMap = new Map();

    try {
        console.log("🌐 正在進入秀泰電影列表...");
        await page.goto('https://www.showtimes.com.tw/programs', { waitUntil: 'networkidle' });
        await page.waitForSelector('text="線上訂票"', { timeout: 15000 });
        
        const ticketCount = await page.locator('text="線上訂票"').count();
        console.log(`🎬 偵測到 ${ticketCount} 部電影，開始解析...`);

        for (let i = 0; i < ticketCount; i++) {
            if (i > 0 && i % 15 === 0) {
                await page.close();
                page = await context.newPage();
                await page.goto('https://www.showtimes.com.tw/programs', { waitUntil: 'domcontentloaded' });
            }

            try {
                if (!page.url().includes('/programs')) {
                    await page.goto('https://www.showtimes.com.tw/programs', { waitUntil: 'domcontentloaded' });
                }

                const btn = page.locator('text="線上訂票"').nth(i);
                await btn.waitFor({ state: 'visible', timeout: 5000 });
                
                const rawTitle = await btn.evaluate(el => el.closest('div').parentElement.innerText.split('\n')[0].trim());
                const cleanTitle = cleanMovieTitle(rawTitle);

                console.log(`🎯 [${i + 1}/${ticketCount}] 處理中: ${cleanTitle}`);
                await btn.click();
                await page.waitForSelector('button:has-text("影城")', { timeout: 8000 });

                for (const cinema of stCinemas) {
                    const cBtn = page.locator(`button:has-text("${cinema.name}")`);
                    if (await cBtn.count() > 0) {
                        await cBtn.click();
                        await page.waitForTimeout(1000); 

                        // 🛠️ 核心解析：只抓取畫面上「未被隱藏」的場次 (即當日場次)
                        const extracted = await page.evaluate(() => {
                            const results = [];
                            const cards = Array.from(document.querySelectorAll('div, button, a'))
                                .filter(el => {
                                    const style = window.getComputedStyle(el);
                                    // 關鍵過濾：必須是可見的且包含場次特徵文字 |
                                    return style.display !== 'none' && 
                                           style.visibility !== 'hidden' &&
                                           el.innerText && el.innerText.includes('|') && 
                                           /\d{2}:\d{2}/.test(el.innerText);
                                });

                            cards.forEach(card => {
                                const lines = card.innerText.trim().split('\n');
                                let version = "數位";
                                let time = "";

                                const infoLine = lines.find(l => l.includes('|'));
                                if (infoLine) version = infoLine.split('|')[1]?.trim() || "數位";

                                const timeLine = lines.find(l => /\d{2}:\d{2}/.test(l));
                                if (timeLine) time = timeLine.split('~')[0].trim();

                                if (time) results.push({ ver: version, time: time });
                            });
                            return results;
                        });

                        if (extracted.length > 0) {
                            if (!cinemaDataMap.has(cinema.id)) {
                                cinemaDataMap.set(cinema.id, { 
                                    cinemaName: cinema.name, 
                                    date: todayFullStr,
                                    city: cinema.city,
                                    location: new admin.firestore.GeoPoint(cinema.lat, cinema.lng),
                                    movies: [] 
                                });
                            }
                            const moviesList = cinemaDataMap.get(cinema.id).movies;
                            let movieEntry = moviesList.find(m => m.title === cleanTitle);
                            
                            if (!movieEntry) {
                                movieEntry = { title: cleanTitle, versions: [], showtimes: [] };
                                moviesList.push(movieEntry);
                            }

                            // 格式統一化 (與威秀腳本一致)
                            extracted.forEach(item => {
                                if (!movieEntry.versions.includes(item.ver)) {
                                    movieEntry.versions.push(item.ver);
                                }
                                // 避免重複場次
                                if (!movieEntry.showtimes.find(s => s.time === item.time && s.ver === item.ver)) {
                                    movieEntry.showtimes.push({ time: item.time, ver: item.ver });
                                }
                            });
                        }
                    }
                }
            } catch (err) {
                console.log(`  ⏩ 跳過此電影: ${err.message}`);
            }
        }

        // --- 🚀 同步至 Firestore ---
        console.log("\n📤 正在同步至 Firestore...");
        for (const [cinemaId, data] of cinemaDataMap) {
            // 排序場次
            data.movies.forEach(m => {
                m.showtimes.sort((a, b) => a.time.localeCompare(b.time));
            });

            await db.collection('realtime_showtimes').doc(cinemaId).set({
                ...data,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`✅ ${data.cinemaName} 同步成功 (${data.movies.length} 部電影)`);
        }

    } catch (err) {
        console.error("🔥 嚴重失敗:", err.message);
    } finally {
        await browser.close();
        console.log("\n🏁 秀泰任務完成");
    }
}

runStCrawl();