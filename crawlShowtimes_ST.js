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
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : JSON.parse(fs.readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 秀泰影城清單
const stCinemas = [
  { "id": "st_keelung", "showtimesId": "1002", "name": "基隆秀泰影城", "city": "基隆市" },
  { "id": "st_today", "showtimesId": "1004", "name": "台北欣欣秀泰影城", "city": "台北市" },
  { "id": "st_dome", "showtimesId": "1085", "name": "台北大巨蛋秀泰影城", "city": "台北市" },
  { "id": "st_shulin", "showtimesId": "1069", "name": "樹林秀泰影城", "city": "新北市" },
  { "id": "st_tucheng", "showtimesId": "1071", "name": "土城秀泰影城", "city": "新北市" },
  { "id": "st_taichung_station", "showtimesId": "1054", "name": "台中站前秀泰影城", "city": "台中市" },
  { "id": "st_wenxin", "showtimesId": "1067", "name": "台中文心秀泰影城", "city": "台中市" },
  { "id": "st_lihpaio", "showtimesId": "1076", "name": "台中麗寶秀泰影城", "city": "台中市" },
  { "id": "st_beigang", "showtimesId": "1078", "name": "雲林北港秀泰影城", "city": "雲林縣" },
  { "id": "st_chiayi", "showtimesId": "1034", "name": "嘉義秀泰影城", "city": "嘉義市" },
  { "id": "st_rende", "showtimesId": "1079", "name": "台南仁德秀泰影城", "city": "台南市" },
  { "id": "st_gangshan", "showtimesId": "1081", "name": "高雄岡山秀泰影城", "city": "高雄市" },
  { "id": "st_dream_mall", "showtimesId": "1083", "name": "高雄夢時代秀泰影城", "city": "高雄市" },
  { "id": "st_hualien", "showtimesId": "1074", "name": "花蓮秀泰影城", "city": "花蓮縣" },
  { "id": "st_taitung", "showtimesId": "1029", "name": "台東秀泰影城", "city": "台東縣" }
];

/**
 * 清理電影標題
 */
function cleanMovieTitle(fullTitle) {
    const cleanTitle = fullTitle.replace(/\(.*?\)/g, '')
        .replace(/3D|4DX|IMAX|SCREENX|數位|英|日|國|分級|普遍級|保護級|輔12級|輔15級|限制級/gi, '')
        .replace(/\s+/g, ' ').trim();
    return cleanTitle;
}

async function runStCrawl() {
    const browser = await chromium.launch({ headless: true }); 
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    let page = await context.newPage();
    const cinemaDataMap = new Map();

    try {
        console.log("🌐 正在進入秀泰電影列表...");
        await page.goto('https://www.showtimes.com.tw/programs', { waitUntil: 'networkidle' });
        await page.waitForSelector('text="線上訂票"', { timeout: 15000 });
        
        const ticketCount = await page.locator('text="線上訂票"').count();
        console.log(`🎬 偵測到 ${ticketCount} 部電影`);

        for (let i = 0; i < ticketCount; i++) {
            // 每 15 部電影重啟分頁，避免 GitHub Actions 記憶體溢出
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

                console.log(`\n🎯 [${i + 1}/${ticketCount}] 處理中: ${cleanTitle}`);
                await btn.click();
                await page.waitForSelector('button:has-text("影城")', { timeout: 8000 });

                for (const cinema of stCinemas) {
                    const cBtn = page.locator(`button:has-text("${cinema.name}")`);
                    if (await cBtn.count() > 0) {
                        await cBtn.click();
                        await page.waitForTimeout(1500); // 等待 React 渲染場次卡片

                        // --- 核心邏輯：解析包含 | 的場次卡片 ---
                        const extracted = await page.evaluate(() => {
                            const cards = Array.from(document.querySelectorAll('div, button, a')).filter(el => 
                                el.innerText && el.innerText.includes('|') && /\d{2}:\d{2}/.test(el.innerText)
                            );

                            return cards.map(card => {
                                const lines = card.innerText.trim().split('\n');
                                let version = "數位";
                                let time = "";

                                const infoLine = lines.find(l => l.includes('|'));
                                if (infoLine) version = infoLine.split('|')[1].trim();

                                const timeLine = lines.find(l => /\d{2}:\d{2}/.test(l));
                                if (timeLine) time = timeLine.split('~')[0].trim();

                                return { version, time };
                            }).filter(item => item.time !== "");
                        });

                        if (extracted.length > 0) {
                            if (!cinemaDataMap.has(cinema.id)) {
                                cinemaDataMap.set(cinema.id, { cinemaName: cinema.name, movies: [] });
                            }
                            const moviesList = cinemaDataMap.get(cinema.id).movies;
                            let movieEntry = moviesList.find(m => m.title === cleanTitle);
                            
                            if (!movieEntry) {
                                movieEntry = { title: cleanTitle, versions: [] };
                                moviesList.push(movieEntry);
                            }

                            // 整理版本與場次
                            extracted.forEach(item => {
                                let vGroup = movieEntry.versions.find(v => v.name === item.version);
                                if (!vGroup) {
                                    vGroup = { name: item.version, showtimes: [] };
                                    movieEntry.versions.push(vGroup);
                                }
                                if (!vGroup.showtimes.includes(item.time)) {
                                    vGroup.showtimes.push(item.time);
                                }
                            });
                        }
                    }
                }
            } catch (err) {
                console.log(`  ⏩ 跳過此電影節點: ${err.message}`);
            }
        }

        // --- 🚀 同步至 Firestore ---
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
        console.log("✅ 全部影城資料同步成功！");

    } catch (err) {
        console.error("🔥 嚴重失敗:", err.message);
    } finally {
        await browser.close();
    }
}

runStCrawl();