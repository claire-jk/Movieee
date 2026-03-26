import admin from 'firebase-admin';
import fs from 'fs';
import { dirname, join } from 'path';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';

chromium.use(stealth());
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- 取得今天日期 ---
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

// --- 工具函數 ---

function standardizeVersion(rawVer) {
    const v = rawVer.toUpperCase();
    if (v.includes('IMAX')) return 'IMAX';
    if (v.includes('4DX')) return '4DX';
    if (v.includes('SCREENX')) return v.includes('3D') ? 'ScreenX 3D' : 'ScreenX';
    if (v.includes('3D')) return '數位 3D';
    if (v.includes('LIVE') || v.includes('現場直播')) return 'LIVE';
    return '數位 2D';
}

function cleanMovieTitle(fullTitle) {
    return fullTitle
        .replace(/\(.*?\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/特別場|鐵粉|首日|首場|特別映演|安可重播|現場直播/g, '')
        .replace(/3D|4DX|IMAX|SCREENX|數位|英|日|國|韓|泰|粵|分級|普遍級|保護級|輔12級|輔15級|限制級|待定/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

async function runMiramarCrawl() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`🚀 美麗華影城更新啟動 [標準化合併版] - 目標日期：${todayStr}`);

    try {
        await page.goto('https://www.miramarcinemas.tw/Timetable/Index?cinema=standard', { 
            waitUntil: 'networkidle' 
        });

        // 點選大直影城
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
                const showtimeData = [];
                const blocks = container.querySelectorAll('.time_list_right .block');

                blocks.forEach(block => {
                    const style = window.getComputedStyle(block);
                    if (style.display === 'none') return;
                    if (block.classList.contains('booking_date_area')) return;

                    const roomDiv = block.querySelector('.room');
                    if (!roomDiv) return;

                    const rawVer = roomDiv.innerText.replace(/watch_later/g, '').trim();
                    const timeElements = block.querySelectorAll('.booking_time');
                    
                    timeElements.forEach(t => {
                        const timeStr = t.innerText.trim();
                        if (/^\d{2}:\d{2}$/.test(timeStr)) {
                            showtimeData.push({ time: timeStr, rawVer: rawVer });
                        }
                    });
                });

                if (showtimeData.length > 0) {
                    movies.push({ rawTitle, showtimeData });
                }
            });
            return movies;
        });

        // --- 📥 資料清洗、標準化與合併 (重要修正) ---
        const cinemaMoviesMap = new Map();

        rawResults.forEach(m => {
            const title = cleanMovieTitle(m.rawTitle);
            
            if (!cinemaMoviesMap.has(title)) {
                cinemaMoviesMap.set(title, {
                    title: title,
                    versions: [],
                    showtimes: []
                });
            }

            const movieEntry = cinemaMoviesMap.get(title);

            m.showtimeData.forEach(s => {
                const finalVer = standardizeVersion(s.rawVer);
                
                if (!movieEntry.versions.includes(finalVer)) {
                    movieEntry.versions.push(finalVer);
                }

                // 檢查重複 (避免不同原始標題合併後產生重複場次)
                const isDup = movieEntry.showtimes.some(st => st.time === s.time && st.ver === finalVer);
                if (!isDup) {
                    movieEntry.showtimes.push({
                        time: s.time,
                        ver: finalVer
                    });
                }
            });
        });

        const finalMovies = Array.from(cinemaMoviesMap.values());
        
        // 排序場次時間
        finalMovies.forEach(m => {
            m.showtimes.sort((a, b) => a.time.localeCompare(b.time));
        });

        if (finalMovies.length > 0) {
            console.log(`📡 清洗完成！準備同步至 Firestore (共 ${finalMovies.length} 部電影)...`);

            const docId = "miramar_dazhi";
            const docRef = db.collection('realtime_showtimes').doc(docId);

            await docRef.set({
                cinemaName: "美麗華大直影城",
                date: todayStr,
                city: "台北市",
                location: { lat: 25.0837, lng: 121.5566 }, // 大直美麗華座標
                movies: finalMovies,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log("✅ 美麗華資料已成功更新！");
        } else {
            console.log("⚠️ 抓取結果為空。");
        }

    } catch (err) {
        console.error("🔥 錯誤:", err.message);
    } finally {
        await browser.close();
        console.log("🏁 任務結束");
    }
}

runMiramarCrawl();