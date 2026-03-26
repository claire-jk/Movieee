import fs from 'fs';
import { chromium } from 'playwright';

async function run() {
    const browser = await chromium.launch({ headless: true }); 
    const page = await browser.newPage();

    const now = new Date();
    const todayStr = `${now.getMonth() + 1}/${now.getDate()}`; // 格式如 "4/1"
    console.log(`🚀 美麗華影城更新啟動 - 目標日期：${todayStr}`);

    try {
        await page.goto('https://www.miramarcinemas.tw/Timetable/Index?cinema=standard', { 
            waitUntil: 'networkidle' 
        });

        await page.click('ul.cinema li a'); 
        await page.waitForSelector('.booking_time', { timeout: 10000 });
        await page.waitForTimeout(2000); 

        const results = await page.evaluate(() => {
            const movies = [];
            const movieContainers = document.querySelectorAll('.row');

            movieContainers.forEach(container => {
                const titleElement = container.querySelector('.movie_info .title');
                if (!titleElement) return;

                const title = titleElement.innerText.trim();
                const showtimes = [];
                const versionSet = new Set();

                // 核心關鍵：只抓取「當前顯示中」或「具有 active 日期」的場次區塊
                // 根據 image_de70ec.png，每個場次區塊都有對應日期的 class (如 219ad4e4...)
                // 我們檢查該 block 是否沒有被 style="display: none" 隱藏
                const blocks = container.querySelectorAll('.time_list_right .block');

                blocks.forEach(block => {
                    // 過濾掉被隱藏的日期場次 (美麗華切換日期時會切換 display 屬性)
                    const style = window.getComputedStyle(block);
                    if (style.display === 'none') return;

                    // 檢查是否為「場次區塊」而非「日期選擇區塊」
                    // 日期選擇區塊通常有 class 'booking_date_area'
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

        const finalOutput = {
            "cinema": "美麗華大直影城",
            "date": todayStr,
            "movies": results,
            "updatedAt": new Date().toLocaleString()
        };

        fs.writeFileSync('miramar_test.json', JSON.stringify(finalOutput, null, 4));
        console.log(`✅ 轉換完成！今日共有 ${results.length} 部電影`);

    } catch (e) {
        console.error(`❌ 發生錯誤: ${e.message}`);
    } finally {
        await browser.close();
    }
}

run();