// 威秀影城爬蟲上傳至 Firestore
import admin from 'firebase-admin';
import fs from 'fs';
import { JSDOM } from 'jsdom';
import { dirname, join } from 'path';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';

chromium.use(stealth());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serviceAccountPath = join(__dirname, 'serviceAccount.json');

// 🔥 Firebase 初始化
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const cinemas = [
    { "id": "tp_xinyi", "vId": "1", "name": "台北信義威秀影城", "city": "台北市", "lat": 25.0354, "lng": 121.5671 },
    { "id": "tp_qsquare", "vId": "12", "name": "台北京站威秀影城", "city": "台北市", "lat": 25.0494, "lng": 121.5172 },
    { "id": "tp_ximen", "vId": "116", "name": "台北西門威秀影城", "city": "台北市", "lat": 25.0448, "lng": 121.5069 },
    { "id": "tp_muvie", "vId": "123", "name": "MUVIE CINEMAS 台北松仁", "city": "台北市", "lat": 25.0357, "lng": 121.5685 },
    { "id": "tp_lalaport", "vId": "141", "name": "台北南港LaLaport威秀影城", "city": "台北市", "lat": 25.0558, "lng": 121.6163 },
    { "id": "ntp_banqiao", "vId": "26", "name": "板橋大遠百威秀影城", "city": "新北市", "lat": 25.0134, "lng": 121.4650 },
    { "id": "ntp_zhonghe", "vId": "129", "name": "中和環球威秀影城", "city": "新北市", "lat": 25.0016, "lng": 121.4746 },
    { "id": "ntp_linkou", "vId": "65", "name": "林口MITSUI OUTLET PARK威秀影城", "city": "新北市", "lat": 25.0701, "lng": 121.3621 },
    { "id": "ntp_xindian", "vId": "139", "name": "新店裕隆城威秀影城", "city": "新北市", "lat": 24.9781, "lng": 121.5452 },
    { "id": "ty_tonlin", "vId": "84", "name": "桃園統領威秀影城", "city": "桃園市", "lat": 24.9920, "lng": 121.3120 },
    { "id": "ty_taozhidao", "vId": "144", "name": "桃園桃知道威秀影城", "city": "桃園市", "lat": 25.0159, "lng": 121.3005 },
    { "id": "hc_feba", "vId": "36", "name": "新竹大遠百威秀影城", "city": "新竹市", "lat": 24.8016, "lng": 120.9642 },
    { "id": "hc_bigcity", "vId": "39", "name": "新竹巨城威秀影城", "city": "新竹市", "lat": 24.8105, "lng": 120.9752 },
    { "id": "tc_feba", "vId": "32", "name": "台中大遠百威秀影城", "city": "台中市", "lat": 24.1645, "lng": 120.6438 },
    { "id": "tc_tiger", "vId": "30", "name": "台中 Tiger City 威秀影城", "city": "台中市", "lat": 24.1627, "lng": 120.6366 },
    { "id": "tc_taroko", "vId": "115", "name": "台中大魯閣新時代威秀影城", "city": "台中市", "lat": 24.1362, "lng": 120.6872 },
    { "id": "tn_feba", "vId": "43", "name": "台南大遠百威秀影城", "city": "台南市", "lat": 22.9961, "lng": 120.2096 },
    { "id": "tn_focus", "vId": "126", "name": "台南 FOCUS 威秀影城", "city": "台南市", "lat": 22.9966, "lng": 120.2089 },
    { "id": "tn_tsmall", "vId": "60", "name": "台南南紡威秀影城", "city": "台南市", "lat": 22.9904, "lng": 120.2335 },
    { "id": "kh_feba", "vId": "48", "name": "高雄大遠百威秀影城", "city": "高雄市", "lat": 22.6141, "lng": 120.3045 },
    { "id": "hl_paradisio", "vId": "105", "name": "花蓮新天堂樂園威秀影城", "city": "花蓮縣", "lat": 23.9317, "lng": 121.5976 }
];

/**
 * 🧼 核心清洗函數：移除 (3D 數位 英) 與 (普遍級) 等雜質
 */
function cleanMovieTitle(fullTitle) {
    let version = "數位"; // 預設版本
    if (/4DX/i.test(fullTitle)) version = "4DX";
    else if (/IMAX/i.test(fullTitle)) version = "IMAX";
    else if (/3D/i.test(fullTitle)) version = "3D";
    else if (/SCREENX/i.test(fullTitle)) version = "ScreenX";
    else if (/LIVE/i.test(fullTitle)) version = "LIVE";

    let cleanTitle = fullTitle
        .replace(/\(.*?\)/g, '') // 移除所有括號
        .replace(/3D|4DX|IMAX|GOLD CLASS|SCREENX|數位|英|日|國|分級|普遍級|保護級|輔12級|輔15級|限制級|待定/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    return { cleanTitle, version };
}

/**
 * 🔄 通用的合併函數
 */
function mergeMovieData(rawData) {
    const merged = [];
    rawData.forEach(item => {
        const { cleanTitle, version } = cleanMovieTitle(item.fullTitle || item.title);
        
        // 將這批時間標註上版本
        const newShowtimes = item.times.map(t => ({
            time: t,
            ver: version
        }));

        const existing = merged.find(m => m.title === cleanTitle);
        if (existing) {
            // 合併場次並排序
            existing.showtimes = [...existing.showtimes, ...newShowtimes].sort((a, b) => a.time.localeCompare(b.time));
            // 更新版本清單
            if (!existing.versions.includes(version)) {
                existing.versions.push(version);
            }
        } else {
            merged.push({
                title: cleanTitle,
                versions: [version],
                showtimes: newShowtimes
            });
        }
    });
    return merged;
}

async function crawl() {
    console.log(`\n⏰ 啟動任務: ${new Date().toLocaleString()}`);

    const browser = await chromium.launch({ headless: process.env.NODE_ENV === 'production' ? true : false });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    const allResults = [];

    for (const cinema of cinemas) {
        try {
            console.log(`\n🌐 處理影城: ${cinema.name}`);
            let apiRawData = null;

            page.removeAllListeners('response');
            page.on('response', async (response) => {
                if (response.url().includes('GetShowTimes')) {
                    try {
                        const html = await response.text();
                        const dom = new JSDOM(html);
                        const document = dom.window.document;
                        const results = [];
                        document.querySelectorAll('.col-xs-12').forEach(block => {
                            const title = block.querySelector('.MovieName')?.textContent.trim();
                            const times = Array.from(block.querySelectorAll('.SessionTimeInfo div'))
                                .map(el => el.textContent.trim())
                                .filter(t => /^\d{2}:\d{2}$/.test(t));
                            if (title && times.length > 0) results.push({ title, times });
                        });
                        apiRawData = results;
                    } catch {}
                }
            });

            await page.goto('https://www.vscinemas.com.tw/ShowTimes/', { waitUntil: 'networkidle' });

            await page.evaluate((cName) => {
                const select = document.querySelector('#CinemaNameTWInfoS');
                if (select) {
                    const option = Array.from(select.options).find(opt => opt.text.includes(cName));
                    if (option) {
                        select.value = option.value;
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            }, cinema.name);

            console.log("⏳ 等待資料載入...");
            await page.waitForTimeout(5000);

            let finalData = [];

            if (apiRawData && apiRawData.length > 0) {
                console.log(`🎯 API 攔截成功，進行清洗合併...`);
                finalData = mergeMovieData(apiRawData);
            } else {
                console.log("⚠️ API 沒抓到 -> 嘗試 UI 解析並清洗合併");
                const uiRaw = await page.evaluate(() => {
                    const results = [];
                    document.querySelectorAll('.row').forEach(row => {
                        const titleEl = row.querySelector('.LangTW.MovieName');
                        if (!titleEl) return;
                        const fullTitle = titleEl.innerText.trim();
                        const times = Array.from(row.querySelectorAll('a'))
                            .map(a => a.innerText.trim())
                            .filter(t => /^\d{2}:\d{2}$/.test(t));
                        if (fullTitle && times.length > 0) results.push({ fullTitle, times });
                    });
                    return results;
                });
                finalData = mergeMovieData(uiRaw);
            }

            if (finalData.length > 0) {
                await db.collection('realtime_showtimes').doc(cinema.id).set({
                    cinemaName: cinema.name,
                    showDate: new Date().toLocaleDateString(),
                    movies: finalData,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                allResults.push({ cinema: cinema.name, movies: finalData });
                console.log(`✅ ${cinema.name}：完成 (共 ${finalData.length} 部電影)`);
            }
        } catch (e) {
            console.log(`⚠️ ${cinema.name} 錯誤: ${e.message}`);
        }
    }

    if (allResults.length > 0) {
        fs.writeFileSync(join(__dirname, 'movies_data.json'), JSON.stringify(allResults, null, 4), 'utf8');
        console.log(`\n💾 檔案已回傳！請檢查 movies_data.json`);
    }

    await browser.close();
    console.log('\n🏁 任務完成');
}

crawl();