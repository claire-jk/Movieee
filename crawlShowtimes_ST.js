import admin from 'firebase-admin';
import fs from 'fs';
import { dirname, join } from 'path';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';

chromium.use(stealth());
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Firebase 初始化 (建議使用環境變數或 Secret)
const serviceAccountPath = join(__dirname, 'serviceAccount.json');
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
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
    // 直接套用你威秀的清洗邏輯
    let version = "數位"; 
    if (/4DX/i.test(fullTitle)) version = "4DX";
    else if (/3D/i.test(fullTitle)) version = "3D";
    else if (/SCREENX/i.test(fullTitle)) version = "ScreenX";

    let cleanTitle = fullTitle
        .replace(/\(.*?\)/g, '') 
        .replace(/3D|4DX|IMAX|SCREENX|數位|英|日|國|普遍級|保護級|輔12級|輔15級|限制級/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    return { cleanTitle, version };
}

async function runStCrawl() {
    const browser = await chromium.launch({ headless: true }); // GitHub Actions 必須為 true
    const page = await browser.newPage();

    try {
        console.log("🌐 進入秀泰總覽...");
        await page.goto('https://www.showtimes.com.tw/programs', { waitUntil: 'networkidle' });

        const ticketBtn = page.locator('text="線上訂票"').first();
        await ticketBtn.waitFor({ state: 'visible' });

        const rawTitle = await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('*')).find(el => el.innerText === '線上訂票');
            return btn.closest('div').parentElement.innerText.split('\n')[0].trim();
        });

        const { cleanTitle } = cleanMovieTitle(rawTitle);
        await ticketBtn.click();
        await page.waitForSelector('button:has-text("影城")');

        for (const cinema of stCinemas) {
            console.log(`🎬 處理影城: ${cinema.name}`);
            const btn = page.locator(`button:has-text("${cinema.name}")`);
            
            if (await btn.count() > 0) {
                await btn.click();
                await page.waitForTimeout(2000);

                const showtimes = await page.evaluate(() => {
                    const nodes = Array.from(document.querySelectorAll('div.text-lg'));
                    return nodes.map(node => {
                        const time = node.innerText.split('~')[0].trim();
                        const info = node.closest('div').parentElement.innerText;
                        let ver = "數位";
                        if (/4DX/i.test(info)) ver = "4DX";
                        else if (/3D/i.test(info)) ver = "3D";
                        else if (/SCREENX/i.test(info)) ver = "ScreenX";
                        return { time, ver };
                    }).filter(t => t.time.includes(':'));
                });

                if (showtimes.length > 0) {
                    const versions = [...new Set(showtimes.map(s => s.ver))];
                    
                    // 🚀 直接寫入 Firestore (與威秀路徑一致)
                    await db.collection('realtime_showtimes').doc(cinema.id).set({
                        cinemaName: cinema.name,
                        showDate: new Date().toLocaleDateString(),
                        movies: [{
                            title: cleanTitle,
                            versions: versions,
                            showtimes: showtimes
                        }],
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                    
                    console.log(`✅ ${cinema.name} 上傳成功`);
                }
            }
        }
    } catch (err) {
        console.error("🔥 失敗:", err.message);
    }

    await browser.close();
    console.log("🏁 秀泰任務完成");
}

runStCrawl();