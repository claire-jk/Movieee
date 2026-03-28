//秀泰爬蟲
import admin from 'firebase-admin';
import fs from 'fs';
import { dirname, join } from 'path';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';

chromium.use(stealth());
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const now = new Date();
const todayFullStr = now.toLocaleDateString('zh-TW', { 
    timeZone: 'Asia/Taipei', 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
});

// --- Firebase 初始化 ---
const serviceAccountPath = join(__dirname, 'serviceAccount.json');
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const stCinemas = [
  { "id": "st_keelung", "name": "基隆秀泰影城", "location": { "lat": 25.1311, "lng": 121.7445 }, "city": "基隆市" },
  { "id": "st_today", "name": "台北欣欣秀泰影城", "location": { "lat": 25.0531, "lng": 121.5262 }, "city": "台北市" },
  { "id": "st_dome", "name": "台北大巨蛋秀泰影城", "location": { "lat": 25.0441, "lng": 121.5606 }, "city": "台北市" },
  { "id": "st_shulin", "name": "樹林秀泰影城", "location": { "lat": 24.9918, "lng": 121.4251 }, "city": "新北市" },
  { "id": "st_tucheng", "name": "土城秀泰影城", "location": { "lat": 24.9821, "lng": 121.4468 }, "city": "新北市" },
  { "id": "st_taichung_station", "name": "台中站前秀泰影城", "location": { "lat": 24.1415, "lng": 120.6903 }, "city": "台中市" },
  { "id": "st_wenxin", "name": "台中文心秀泰影城", "location": { "lat": 24.1237, "lng": 120.6416 }, "city": "台中市" },
  { "id": "st_lihpaio", "name": "台中麗寶秀泰影城", "location": { "lat": 24.3312, "lng": 120.6981 }, "city": "台中市" },
  { "id": "st_beigang", "name": "雲林北港秀泰影城", "location": { "lat": 23.5702, "lng": 120.2981 }, "city": "雲林縣" },
  { "id": "st_chiayi", "name": "嘉義秀泰影城", "location": { "lat": 23.4862, "lng": 120.4476 }, "city": "嘉義市" },
  { "id": "st_rende", "name": "台南仁德秀泰影城", "location": { "lat": 22.9515, "lng": 120.2223 }, "city": "台南市" },
  { "id": "st_gangshan", "name": "高雄岡山秀泰影城", "location": { "lat": 22.7845, "lng": 120.2965 }, "city": "高雄市" },
  { "id": "st_dream_mall", "name": "高雄夢時代秀泰影城", "location": { "lat": 22.5951, "lng": 120.3069 }, "city": "高雄市" },
  { "id": "st_hualien", "name": "花蓮秀泰影城", "location": { "lat": 23.9881, "lng": 121.6072 }, "city": "花蓮縣" },
  { "id": "st_taitung", "name": "台東秀泰影城", "location": { "lat": 22.7523, "lng": 121.1481 }, "city": "台東縣" }
];

// --- 工具函數 ---

/**
 * 🛠️ 修改：標準化版本名稱
 */
function standardizeShowtimesVersion(rawVer) {
    const v = rawVer.toUpperCase();
    if (v.includes('SCREENX')) return v.includes('3D') ? 'ScreenX 3D' : 'ScreenX';
    if (v.includes('4DX')) return '4DX';
    if (v.includes('IMAX')) return 'IMAX';
    if (v.includes('3D')) return '數位 3D';
    if (v.includes('LIVE') || v.includes('現場直播')) return 'LIVE';
    return '數位 2D';
}

/**
 * 🛠️ 修改：強化標題清洗 (移除特別場、首日等字眼)
 */
function cleanMovieTitle(fullTitle) {
    return fullTitle
        .replace(/\(.*?\)/g, '')
        .replace(/特別場|鐵粉|首日|首場|特別映演|安可重播|現場直播/g, '')
        .replace(/3D|4DX|IMAX|SCREENX|數位|英|日|國|韓|泰|粵|分級|普遍級|保護級|輔12級|輔15級|限制級|待定/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * 🚀 新增：具備重試機制的導航函數 (解決之前的 DISCONNECTED 錯誤)
 */
async function gotoWithRetry(page, url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            return;
        } catch (err) {
            console.log(`⚠️ 連線失敗 (第 ${i + 1} 次重試): ${err.message}`);
            if (i === retries - 1) throw err;
            await new Promise(res => setTimeout(res, 3000));
        }
    }
}

async function runStCrawl() {
    console.log(`\n⏰ 啟動秀泰更新任務: ${todayFullStr}`);
    const browser = await chromium.launch({ headless: true }); 
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    let page = await context.newPage();
    const cinemaDataMap = new Map();

    try {
        console.log("🌐 正在進入秀泰電影列表...");
        await gotoWithRetry(page, 'https://www.showtimes.com.tw/programs');
        await page.waitForSelector('text="線上訂票"', { timeout: 15000 });
        
        const ticketCount = await page.locator('text="線上訂票"').count();
        console.log(`🎬 偵測到 ${ticketCount} 部電影，開始解析...`);

        for (let i = 0; i < ticketCount; i++) {
            try {
                // 確保在列表頁
                if (!page.url().endsWith('/programs')) {
                    await gotoWithRetry(page, 'https://www.showtimes.com.tw/programs');
                }

                const btn = page.locator('text="線上訂票"').nth(i);
                await btn.waitFor({ state: 'visible', timeout: 5000 });
                
                const rawTitle = await btn.evaluate(el => el.closest('div').parentElement.innerText.split('\n')[0].trim());
                const cleanTitle = cleanMovieTitle(rawTitle);

                console.log(`🎯 [${i + 1}/${ticketCount}] 處理中: ${cleanTitle}`);
                await btn.click();
                
                try {
                    await page.waitForSelector('button:has-text("影城")', { timeout: 8000 });
                } catch (e) {
                    console.log(`  ⏩ 影城選單未出現，跳過此電影`);
                    continue;
                }

                for (const cinema of stCinemas) {
                    const cBtn = page.locator(`button:has-text("${cinema.name}")`);
                    if (await cBtn.count() > 0) {
                        await cBtn.click();
                        await page.waitForTimeout(800); 

                        const extracted = await page.evaluate(() => {
                            const results = [];
                            const cards = Array.from(document.querySelectorAll('div, button, a'))
                                .filter(el => {
                                    const style = window.getComputedStyle(el);
                                    return style.display !== 'none' && 
                                           el.innerText?.includes('|') && 
                                           /\d{2}:\d{2}/.test(el.innerText);
                                });

                            cards.forEach(card => {
                                const lines = card.innerText.trim().split('\n');
                                const infoLine = lines.find(l => l.includes('|'));
                                const timeLine = lines.find(l => /\d{2}:\d{2}/.test(l));
                                if (timeLine) {
                                    results.push({ 
                                        ver: infoLine ? infoLine.split('|')[1]?.trim() : "數位",
                                        time: timeLine.split('~')[0].trim() 
                                    });
                                }
                            });
                            return results;
                        });

                        if (extracted.length > 0) {
                            if (!cinemaDataMap.has(cinema.id)) {
                                cinemaDataMap.set(cinema.id, { 
                                    cinemaName: cinema.name, 
                                    date: todayFullStr,
                                    city: cinema.city,
                                    location: cinema.location,
                                    movies: [] 
                                });
                            }
                            const moviesList = cinemaDataMap.get(cinema.id).movies;
                            let movieEntry = moviesList.find(m => m.title === cleanTitle);
                            
                            if (!movieEntry) {
                                movieEntry = { title: cleanTitle, versions: [], showtimes: [] };
                                moviesList.push(movieEntry);
                            }

                            extracted.forEach(item => {
                                const finalVer = standardizeShowtimesVersion(item.ver);
                                if (!movieEntry.versions.includes(finalVer)) movieEntry.versions.push(finalVer);
                                
                                // 避免重複紀錄相同場次
                                const isDup = movieEntry.showtimes.some(s => s.time === item.time && s.ver === finalVer);
                                if (!isDup) {
                                    movieEntry.showtimes.push({ time: item.time, ver: finalVer });
                                }
                            });
                        }
                    }
                }
            } catch (err) {
                console.log(`  ⏩ 跳過此電影索引 [${i}]: ${err.message}`);
            }
        }

        // --- 📤 同步至 Firestore ---
        console.log("\n📤 正在同步至 Firestore...");
        for (const [cinemaId, data] of cinemaDataMap) {
            // 對每部電影的場次進行時間排序
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
        console.log("\n🏁 秀泰更新任務結束");
    }
}

runStCrawl();