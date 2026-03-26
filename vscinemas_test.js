import fs from 'fs';
import { JSDOM } from 'jsdom';
import { dirname, join } from 'path';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';

chromium.use(stealth());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. 取得台灣當天日期，格式化為威秀 HTML 顯示的 "MM月DD日" (例如 03月26日)
const now = new Date();
const todayDateStr = `${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日`;
const todayFullStr = now.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' });

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

function cleanMovieTitle(fullTitle) {
    let version = "數位";
    if (/4DX/i.test(fullTitle)) version = "4DX";
    else if (/IMAX/i.test(fullTitle)) version = "IMAX";
    else if (/3D/i.test(fullTitle)) version = "3D";
    else if (/SCREENX/i.test(fullTitle)) version = "ScreenX";

    let cleanTitle = fullTitle
        .replace(/\(.*?\)/g, '')
        .replace(/3D|4DX|IMAX|GOLD CLASS|SCREENX|數位|英|日|國|分級|普遍級|保護級|輔12級|輔15級|限制級|待定/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    return { cleanTitle, version };
}

function mergeMovieData(rawData) {
    const merged = [];
    rawData.forEach(item => {
        const { cleanTitle, version } = cleanMovieTitle(item.fullTitle || item.title);
        const newShowtimes = item.times.map(t => ({ time: t, ver: version }));

        const existing = merged.find(m => m.title === cleanTitle);
        if (existing) {
            existing.showtimes = [...existing.showtimes, ...newShowtimes].sort((a, b) => a.time.localeCompare(b.time));
            if (!existing.versions.includes(version)) existing.versions.push(version);
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

async function runTest() {
    console.log(`\n🚀 威秀當日場次過濾測試`);
    console.log(`📅 系統今天: ${todayFullStr} | 關鍵字: ${todayDateStr}`);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const allResults = [];

    for (const cinema of cinemas) {
        try {
            console.log(`\n🌐 正在處理: ${cinema.name}`);
            let apiRawData = null;

            page.removeAllListeners('response');
            page.on('response', async (response) => {
                if (response.url().includes('GetShowTimes')) {
                    try {
                        const html = await response.text();
                        const dom = new JSDOM(html);
                        const doc = dom.window.document;
                        const results = [];

                        // 威秀 API 的內容是平鋪的，日期、場次都在 .col-xs-12 裡面
                        doc.querySelectorAll('.col-xs-12').forEach(block => {
                            const title = block.querySelector('.MovieName')?.textContent.trim();
                            
                            // 核心過濾邏輯：掃描區塊內所有節點
                            const allNodes = Array.from(block.querySelectorAll('strong, div'));
                            let isTargetDate = false;
                            let extractedTimes = [];

                            allNodes.forEach(node => {
                                const text = node.textContent.trim();
                                
                                // 1. 偵測到「日期行」(包含星期字眼)
                                if (text.includes('星期')) {
                                    // 2. 判斷是否為我們要的日期 (例如：03月26日)
                                    isTargetDate = text.includes(todayDateStr);
                                }
                                
                                // 3. 如果目前處於目標日期區塊，且文字符合時間格式
                                if (isTargetDate && /^\d{2}:\d{2}$/.test(text)) {
                                    extractedTimes.push(text);
                                }
                            });

                            if (title && extractedTimes.length > 0) {
                                results.push({ title, times: extractedTimes });
                            }
                        });
                        apiRawData = results;
                    } catch (e) {}
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

            await page.waitForTimeout(5000);

            let finalData = [];
            if (apiRawData && apiRawData.length > 0) {
                console.log("🎯 API 解析成功，已過濾非當日場次");
                finalData = mergeMovieData(apiRawData);
            } else {
                console.log("⚠️ API 沒抓到，嘗試 UI 爬取...");
                // UI 爬取同樣透過 display 屬性確保只抓畫面上顯示的當天資料
                const uiRaw = await page.evaluate(() => {
                    const results = [];
                    document.querySelectorAll('.row').forEach(row => {
                        if (window.getComputedStyle(row).display === 'none') return;
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
                allResults.push({
                    cinemaId: cinema.id,
                    cinemaName: cinema.name,
                    date: todayFullStr,
                    movies: finalData
                });
                console.log(`✅ 成功獲取 ${finalData.length} 部電影場次`);
            }

        } catch (e) {
            console.error(`❌ ${cinema.name} 錯誤: ${e.message}`);
        }
    }

    const outputPath = join(__dirname, 'vscinemas_daily_test.json');
    fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 4), 'utf8');
    console.log(`\n🏁 任務完成！檔案已存至: ${outputPath}`);
    await browser.close();
}

runTest();