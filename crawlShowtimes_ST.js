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
// 在 GitHub Actions 環境下，我們會從 Secret 讀取字串
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : JSON.parse(fs.readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 秀泰影城清單 (你可以根據需要擴充 ID)
const stCinemas = [
  { "id": "st_keelung", "showtimesId": "1002", "name": "基隆秀泰影城", "city": "基隆市", "lat": 25.1311, "lng": 121.7445 },
  { "id": "st_today", "showtimesId": "1004", "name": "台北欣欣秀泰影城", "city": "台北市", "lat": 25.0531, "lng": 121.5262 },
  { "id": "st_dome", "showtimesId": "1085", "name": "台北大巨蛋秀泰影城", "city": "台北市", "lat": 25.0441, "lng": 121.5606 },
  { "id": "st_shulin", "showtimesId": "1069", "name": "樹林秀泰影城", "city": "新北市", "lat": 24.9918, "lng": 121.4251 },
  { "id": "st_tucheng", "showtimesId": "1071", "name": "土城秀泰影城", "city": "新北市", "lat": 24.9821, "lng": 121.4468 },
  { "id": "st_taichung_station", "showtimesId": "1054", "name": "台中站前秀泰影城", "city": "台中市", "lat": 24.1415, "lng": 120.6903 },
  { "id": "st_wenxin", "showtimesId": "1067", "name": "台中文心秀泰影城", "city": "台中市", "lat": 24.1237, "lng": 120.6416 },
  { "id": "st_lihpaio", "showtimesId": "1076", "name": "台中麗寶秀泰影城", "city": "台中市", "lat": 24.3312, "lng": 120.6981 },
  { "id": "st_beigang", "showtimesId": "1078", "name": "雲林北港秀泰影城", "city": "雲林縣", "lat": 23.5702, "lng": 120.2981 },
  { "id": "st_chiayi", "showtimesId": "1034", "name": "嘉義秀泰影城", "city": "嘉義市", "lat": 23.4862, "lng": 120.4476 },
  { "id": "st_rende", "showtimesId": "1079", "name": "台南仁德秀泰影城", "city": "台南市", "lat": 22.9515, "lng": 120.2223 },
  { "id": "st_gangshan", "showtimesId": "1081", "name": "高雄岡山秀泰影城", "city": "高雄市", "lat": 22.7845, "lng": 120.2965 },
  { "id": "st_dream_mall", "showtimesId": "1083", "name": "高雄夢時代秀泰影城", "city": "高雄市", "lat": 22.5951, "lng": 120.3069 },
  { "id": "st_hualien", "showtimesId": "1074", "name": "花蓮秀泰影城", "city": "花蓮縣", "lat": 23.9881, "lng": 121.6072 },
  { "id": "st_taitung", "showtimesId": "1029", "name": "台東秀泰影城", "city": "台東縣", "lat": 22.7523, "lng": 121.1481 }
];

function cleanMovieTitle(fullTitle) {
    let version = "數位";
    if (/4DX/i.test(fullTitle)) version = "4DX";
    else if (/3D/i.test(fullTitle)) version = "3D";
    else if (/SCREENX/i.test(fullTitle)) version = "ScreenX";
    const cleanTitle = fullTitle.replace(/\(.*?\)/g, '').replace(/3D|4DX|IMAX|SCREENX|數位|英|日|國|普遍級|保護級|輔12級|輔15級|限制級/gi, '').replace(/\s+/g, ' ').trim();
    return { cleanTitle, version };
}

async function runStCrawl() {
    const browser = await chromium.launch({ headless: true }); // GitHub Actions 必須為 true
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    
    // 用來暫存所有資料的 Map (Key: cinemaId)
    const cinemaDataMap = new Map();

    try {
        console.log("🌐 進入秀泰總覽...");
        await page.goto('https://www.showtimes.com.tw/programs', { waitUntil: 'networkidle' });
        
        const ticketBtns = page.locator('text="線上訂票"');
        const count = await ticketBtns.count();
        console.log(`🎬 偵測到 ${count} 部電影`);

        for (let i = 0; i < count; i++) {
            try {
                if (!page.url().includes('/programs')) {
                    await page.goto('https://www.showtimes.com.tw/programs', { waitUntil: 'domcontentloaded' });
                }

                const btn = page.locator('text="線上訂票"').nth(i);
                const rawTitle = await btn.evaluate(el => el.closest('div').parentElement.innerText.split('\n')[0].trim());
                const { cleanTitle } = cleanMovieTitle(rawTitle);
                
                console.log(`\n🎯 [${i+1}/${count}] 抓取中: ${cleanTitle}`);
                await btn.click();
                await page.waitForSelector('button:has-text("影城")', { timeout: 8000 });

                // 輪詢清單中的影城
                for (const cinema of stCinemas) {
                    const cBtn = page.locator(`button:has-text("${cinema.name}")`);
                    if (await cBtn.count() > 0) {
                        await cBtn.click();
                        await page.waitForTimeout(1200);

                        const showtimes = await page.evaluate(() => {
                            return Array.from(document.querySelectorAll('div.text-lg'))
                                .map(node => ({
                                    time: node.innerText.split('~')[0].trim(),
                                    ver: node.closest('div').parentElement.innerText.includes('4DX') ? "4DX" : "數位"
                                })).filter(t => t.time.includes(':'));
                        });

                        if (showtimes.length > 0) {
                            if (!cinemaDataMap.has(cinema.id)) {
                                cinemaDataMap.set(cinema.id, {
                                    cinemaName: cinema.name,
                                    movies: []
                                });
                            }
                            const movieEntry = {
                                title: cleanTitle,
                                versions: [...new Set(showtimes.map(s => s.ver))],
                                showtimes: showtimes
                            };
                            cinemaDataMap.get(cinema.id).movies.push(movieEntry);
                        }
                    }
                }
            } catch (err) {
                console.log(`   ⏩ 跳過此片`);
            }
        }

        // --- 🚀 批次上傳至 Firestore ---
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
        console.log("✅ 全部影城資料上傳成功！");

    } catch (err) {
        console.error("🔥 嚴重失敗:", err.message);
    } finally {
        await browser.close();
    }
}

runStCrawl();