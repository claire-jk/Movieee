import fs from 'fs';
import { chromium } from 'playwright';

/**
 * 🛠️ 核心修正：標準化美麗華版本
 */
function standardizeVersion(rawVer) {
    const v = rawVer.toUpperCase();
    if (v.includes('IMAX')) return 'IMAX';
    if (v.includes('4DX')) return '4DX';
    if (v.includes('SCREENX')) return v.includes('3D') ? 'ScreenX 3D' : 'ScreenX';
    if (v.includes('3D')) return '數位 3D';
    if (v.includes('LIVE') || v.includes('現場直播')) return 'LIVE';
    
    // 其餘 (如 2D, 數位, 英語, 國語) 統一歸類為數位 2D
    return '數位 2D';
}

/**
 * 🛠️ 核心修正：強化標題清洗
 */
function cleanMovieTitle(fullTitle) {
    return fullTitle
        .replace(/\(.*?\)/g, '') // 移除括號內容
        .replace(/\[.*?\]/g, '') // 美麗華常用中括號標註版本，一併移除
        .replace(/特別場|鐵粉|首日|首場|特別映演|安可重播|現場直播/g, '')
        .replace(/3D|4DX|IMAX|SCREENX|數位|英|日|國|韓|泰|粵|分級|普遍級|保護級|輔12級|輔15級|限制級|待定/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

async function run() {
    const browser = await chromium.launch({ headless: true }); 
    const page = await browser.newPage();

    const now = new Date();
    const todayStr = `${now.getMonth() + 1}/${now.getDate()}`;
    console.log(`🚀 美麗華影城更新啟動 [版本歸一化版] - 目標日期：${todayStr}`);

    try {
        await page.goto('https://www.miramarcinemas.tw/Timetable/Index?cinema=standard', { 
            waitUntil: 'networkidle' 
        });

        // 點選大直影城並等待場次加載
        await page.click('ul.cinema li a'); 
        await page.waitForSelector('.booking_time', { timeout: 10000 });
        await page.waitForTimeout(2000); 

        const results = await page.evaluate(() => {
            const movies = [];
            const movieContainers = document.querySelectorAll('.row');

            movieContainers.forEach(container => {
                const titleElement = container.querySelector('.movie_info .title');
                if (!titleElement) return;

                const rawTitle = titleElement.innerText.trim();
                // 在 evaluate 內部無法直接調用外部 function，這裡先回傳原始資料
                // 待會在外層進行清洗與標準化
                
                const showtimeData = [];
                const blocks = container.querySelectorAll('.time_list_right .block');

                blocks.forEach(block => {
                    const style = window.getComputedStyle(block);
                    if (style.display === 'none') return;
                    if (block.classList.contains('booking_date_area')) return;

                    const roomDiv = block.querySelector('.room');
                    if (!roomDiv) return;

                    // 移除美麗華網頁常見的無關文字
                    const rawVer = roomDiv.innerText.replace(/watch_later/g, '').trim();
                    const timeElements = block.querySelectorAll('.booking_time');
                    
                    timeElements.forEach(t => {
                        const timeStr = t.innerText.trim();
                        if (/^\d{2}:\d{2}$/.test(timeStr)) {
                            showtimeData.push({
                                "time": timeStr,
                                "rawVer": rawVer
                            });
                        }
                    });
                });

                if (showtimeData.length > 0) {
                    movies.push({ rawTitle, showtimeData });
                }
            });
            return movies;
        });

        // --- 在外層進行標準化與合併 (合併不同語言或版本的重複標題) ---
        const cinemaMoviesMap = new Map();

        results.forEach(m => {
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

                // 檢查重複 (避免因為標題合併導致場次重複)
                const isDup = movieEntry.showtimes.some(st => st.time === s.time && st.ver === finalVer);
                if (!isDup) {
                    movieEntry.showtimes.push({
                        time: s.time,
                        ver: finalVer
                    });
                }
            });
        });

        // 排序場次時間
        const finalMovies = Array.from(cinemaMoviesMap.values());
        finalMovies.forEach(m => {
            m.showtimes.sort((a, b) => a.time.localeCompare(b.time));
        });

        const finalOutput = {
            "cinema": "美麗華大直影城",
            "date": todayStr,
            "movies": finalMovies,
            "updatedAt": new Date().toLocaleString()
        };

        fs.writeFileSync('miramar_test.json', JSON.stringify(finalOutput, null, 4));
        console.log(`✅ 轉換完成！今日共有 ${finalMovies.length} 部電影 (已完成版本歸一化)`);

    } catch (e) {
        console.error(`❌ 發生錯誤: ${e.message}`);
    } finally {
        await browser.close();
    }
}

run();