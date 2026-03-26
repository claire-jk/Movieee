//美麗華爬蟲上傳 Firestore
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
        // 1. 進入美麗華時刻表頁面
        await page.goto('https://www.miramarcinemas.tw/Timetable/Index?cinema=standard', { 
            waitUntil: 'networkidle' 
        });

        // 2. 模擬點擊（觸發頁面載入特定影廳資料，比照你的 test 邏輯）
        await page.click('ul.cinema li a'); 
        await page.waitForSelector('.booking_time', { timeout: 15000 });
        await page.waitForTimeout(2000); // 等待 DOM 渲染完全

        // 3. 在瀏覽器環境中執行爬蟲邏輯
        const results = await page.evaluate(() => {
            const movies = [];
            const movieContainers = document.querySelectorAll('.row');

            movieContainers.forEach(container => {
                const titleElement = container.querySelector('.movie_info .title');
                if (!titleElement) return;

                const title = titleElement.innerText.trim();
                const showtimes = [];
                const versionSet = new Set();

                // 核心關鍵：檢查 block 是否沒有被 style="display: none" 隱藏
                const blocks = container.querySelectorAll('.time_list_right .block');

                blocks.forEach(block => {
                    const style = window.getComputedStyle(block);
                    if (style.display === 'none') return; // 隱藏的日期場次不抓取
                    if (block.classList.contains('booking_date_area')) return;

                    const roomDiv = block.querySelector('.room');
                    if (!roomDiv) return;

                    const versionName = roomDiv.innerText.replace(/watch_later/g, '').trim();
                    const timeElements = block.querySelectorAll('.booking_time');
                    
                    timeElements.forEach(t => {
                        const timeStr = t.innerText.trim();
                        if (/^\d{2}:\d{2}$/.test(timeStr)) {
                            versionSet.add(versionName);
                            showtimes.push({
                                "time": timeStr,
                                "ver": versionName
                            });
                        }
                    });
                });

                if (showtimes.length > 0) {
                    movies.push({ 
                        title, 
                        versions: Array.from(versionSet),
                        showtimes 
                    });
                }
            });

            return movies;
        });

        if (results.length > 0) {
            console.log(`📡 抓取成功！共有 ${results.length} 部電影，準備同步至 Firestore...`);

            // --- 📤 同步至 Firestore ---
            const docId = "miramar_dazhi"; // 美麗華大直影城 固定 ID
            const docRef = db.collection('realtime_showtimes').doc(docId);

            await docRef.set({
                cinemaName: "美麗華大直影城",
                date: todayStr,
                movies: results,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log("✅ 美麗華資料已成功更新至 Firestore！");
        } else {
            console.log("⚠️ 抓取結果為空，請檢查網頁結構是否有變或日期是否正確。");
        }

    } catch (err) {
        console.error("🔥 發生錯誤:", err.message);
        process.exit(1);
    } finally {
        await browser.close();
        console.log("🏁 任務結束");
    }
}

runMiramarCrawl();