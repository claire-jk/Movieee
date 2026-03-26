// 美麗華爬蟲增強版：加入自動化版本標準化與標題清洗
import admin from 'firebase-admin';
import fs from 'fs';
import { dirname, join } from 'path';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';

chromium.use(stealth());
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- 取得今天日期 (格式如 3/26) ---
const now = new Date();
const todayStr = `${now.getMonth() + 1}/${now.getDate()}`;

// --- Firebase 初始化 ---
const serviceAccountPath = join(__dirname, 'serviceAccount.json');
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function runMiramarCrawl() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    console.log(`🚀 美麗華影城更新啟動 - 目標日期：${todayStr}`);

    try {
        await page.goto('https://www.miramarcinemas.tw/Timetable/Index?cinema=standard', { 
            waitUntil: 'networkidle' 
        });

        // 模擬點擊第一家影城（大直）
        await page.click('ul.cinema li a'); 
        await page.waitForSelector('.booking_time', { timeout: 15000 });
        await page.waitForTimeout(2000); 

        const rawResults = await page.evaluate(() => {
            const movies = [];
            const movieContainers = document.querySelectorAll('.row');

            movieContainers.forEach(container => {
                const titleElement = container.querySelector('.movie_info .title');
                if (!titleElement) return;

                const rawTitle = titleElement.innerText.trim();
                const showtimes = [];
                const versionSet = new Set();

                const blocks = container.querySelectorAll('.time_list_right .block');
                blocks.forEach(block => {
                    const style = window.getComputedStyle(block);
                    if (style.display === 'none') return;
                    if (block.classList.contains('booking_date_area')) return;

                    const roomDiv = block.querySelector('.room');
                    if (!roomDiv) return;

                    // 原始版本名稱 (例如 "IMAX2D", "雷射數位")
                    const rawVersionName = roomDiv.innerText.replace(/watch_later/g, '').trim();
                    
                    const timeElements = block.querySelectorAll('.booking_time');
                    timeElements.forEach(t => {
                        const timeStr = t.innerText.trim();
                        if (/^\d{2}:\d{2}$/.test(timeStr)) {
                            versionSet.add(rawVersionName);
                            showtimes.push({
                                "time": timeStr,
                                "ver": rawVersionName
                            });
                        }
                    });
                });

                if (showtimes.length > 0) {
                    movies.push({ 
                        title: rawTitle, 
                        versions: Array.from(versionSet),
                        showtimes 
                    });
                }
            });
            return movies;
        });

        // --- 📥 資料清洗與增強匹配邏輯 ---
        const cleanedResults = rawResults.map(movie => {
            // 1. 標題清洗：移除 "_首日瘋特別場"、"(待定)" 等後綴，確保能跟威秀合併
            const cleanedTitle = movie.title
                .split('_')[0]   // 處理美麗華常用的底線分隔
                .split('(')[0]   // 處理括號
                .trim();

            // 2. 版本標準化函數
// 2. 版本標準化函數 (增強版：處理語言標籤)
const standardizeVersion = (ver) => {
    const v = ver.toUpperCase();

    // 優先判斷特殊硬體版本
    if (v.includes('IMAX')) return 'IMAX';
    if (v.includes('4DX')) return '4DX';
    if (v.includes('DOLBY')) return 'Dolby Cinema';
    if (v.includes('3D')) return '數位 3D'; // 雖然美麗華現在較少 3D，但保留判斷

    // 核心修正：如果包含「數位」、「2D」、「中文」、「英文」、「CHI」、「ENG」
    // 通通歸類為「數位 2D」
    if (
        v.includes('數位') || 
        v.includes('2D') || 
        v.includes('中文') || 
        v.includes('英文') || 
        v.includes('CHI') || 
        v.includes('ENG')
    ) {
        return '數位 2D';
    }

    // 若都不符合（例如預告片或其他標籤），預設給數位 2D 或回傳原始值
    return '數位 2D'; 
};

            // 處理所有場次中的版本字串
            const cleanedShowtimes = movie.showtimes.map(s => ({
                ...s,
                ver: standardizeVersion(s.ver)
            }));

            // 處理 versions 陣列並去重
            const cleanedVersions = Array.from(new Set(movie.versions.map(v => standardizeVersion(v))));

            return {
                title: cleanedTitle,
                originalTitle: movie.title, // 保留原始標題備查
                versions: cleanedVersions,
                showtimes: cleanedShowtimes
            };
        });

        if (cleanedResults.length > 0) {
            console.log(`📡 清洗完成！準備上傳 ${cleanedResults.length} 部電影至 Firestore...`);

            const docId = "miramar_dazhi";
            const docRef = db.collection('realtime_showtimes').doc(docId);

            await docRef.set({
                cinemaName: "美麗華大直影城",
                date: todayStr,
                movies: cleanedResults,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log("✅ 美麗華資料已成功更新（標題與版本已標準化）！");
        } else {
            console.log("⚠️ 抓取結果為空。");
        }

    } catch (err) {
        console.error("🔥 錯誤:", err.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

runMiramarCrawl();