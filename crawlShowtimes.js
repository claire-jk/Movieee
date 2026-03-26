import fs from 'fs';
import { dirname, join } from 'path';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';

chromium.use(stealth());
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 取得今天日期字串 (格式如: "3/26") 用於日後比對（選填）
const now = new Date();
const todayStr = `${now.getMonth() + 1}/${now.getDate()}`;

function cleanMovieTitle(fullTitle) {
    return fullTitle.replace(/\(.*?\)/g, '')
        .replace(/3D|4DX|IMAX|SCREENX|數位|英|日|國|分級|普遍級|保護級|輔12級|輔15級|限制級/gi, '')
        .replace(/\s+/g, ' ').trim();
}

async function runUnifiedCrawl() {
    // 建議正式跑時 headless 改為 true
    const browser = await chromium.launch({ headless: true }); 
    let page = await browser.newPage();
    const cinemaMap = new Map();

    try {
        console.log(`🚀 秀泰影城當日場次抓取啟動 - 目標日期：${todayStr}`);
        console.log("🌐 正在進入秀泰電影列表...");
        await page.goto('https://www.showtimes.com.tw/programs', { waitUntil: 'networkidle' });
        await page.waitForSelector('text="線上訂票"', { timeout: 15000 });
        
        const ticketCount = await page.locator('text="線上訂票"').count();
        console.log(`🎬 偵測到 ${ticketCount} 部電影，開始解析今日場次...`);

        for (let i = 0; i < ticketCount; i++) {
            if (i > 0 && i % 15 === 0) {
                console.log("♻️ 釋放記憶體中...");
                await page.close();
                page = await browser.newPage();
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

                console.log(`🎯 [${i + 1}/${ticketCount}] 處理中: ${cleanTitle}`);
                await btn.click();

                // 等待影城選單
                try {
                    await page.waitForSelector('button:has-text("影城")', { timeout: 6000 });
                } catch (e) {
                    continue; 
                }

                const cinemas = await page.$$eval('button', btns =>
                    btns.map(b => b.innerText.trim()).filter(t => t.includes('影城'))
                );

                for (let cinemaName of cinemas) {
                    await page.getByRole('button', { name: cinemaName, exact: true }).click();
                    await page.waitForTimeout(1000); 

                    // 🛠️ 改良後的解析邏輯：確保只抓取「當前顯示(active)」的日期區塊內的場次
                    const todayShowtimes = await page.evaluate(() => {
                        // 1. 先找到目前被選中的日期按鈕 (通常有特殊的 class 或顏色)
                        // 秀泰的結構中，未選中的日期內容通常會被隱藏或不在當前 container
                        const results = [];
                        
                        // 2. 抓取場次卡片
                        // 秀泰的場次通常在包含 '|' 的按鈕或 div 中
                        const cards = Array.from(document.querySelectorAll('div, button, a'))
                            .filter(el => {
                                // 必須看得到 (排除隱藏的隔日場次)
                                const style = window.getComputedStyle(el);
                                return style.display !== 'none' && 
                                       style.visibility !== 'hidden' &&
                                       el.innerText && 
                                       el.innerText.includes('|') && 
                                       /\d{2}:\d{2}/.test(el.innerText);
                            });

                        cards.forEach(card => {
                            const lines = card.innerText.trim().split('\n');
                            let ver = "數位";
                            let time = "";

                            const infoLine = lines.find(l => l.includes('|'));
                            if (infoLine) {
                                ver = infoLine.split('|')[1]?.trim() || "數位";
                            }

                            const timeLine = lines.find(l => /\d{2}:\d{2}/.test(l));
                            if (timeLine) {
                                time = timeLine.split('~')[0].trim();
                            }

                            if (time) results.push({ time, ver });
                        });
                        return results;
                    });

                    if (todayShowtimes.length > 0) {
                        if (!cinemaMap.has(cinemaName)) {
                            cinemaMap.set(cinemaName, { 
                                cinema: cinemaName, 
                                date: new Date().toISOString().split('T')[0],
                                movies: [] 
                            });
                        }
                        
                        const cinemaData = cinemaMap.get(cinemaName);
                        let movieEntry = cinemaData.movies.find(m => m.title === cleanTitle);
                        
                        if (!movieEntry) {
                            movieEntry = { title: cleanTitle, versions: [], showtimes: [] };
                            cinemaData.movies.push(movieEntry);
                        }

                        // 統一格式：將場次塞入 showtimes 並更新 versions 清單
                        todayShowtimes.forEach(s => {
                            if (!movieEntry.versions.includes(s.ver)) {
                                movieEntry.versions.push(s.ver);
                            }
                            // 避免重複
                            if (!movieEntry.showtimes.find(st => st.time === s.time && st.ver === s.ver)) {
                                movieEntry.showtimes.push(s);
                            }
                        });
                    }
                }
            } catch (innerErr) {
                console.error(` ❌ 第 ${i+1} 部錯誤:`, innerErr.message);
            }
            await page.waitForTimeout(500);
        }

        const finalOutput = Array.from(cinemaMap.values());
        fs.writeFileSync(join(__dirname, 'showtimes_today.json'), JSON.stringify(finalOutput, null, 4));
        console.log(`\n🏁 今日任務完成！檔案：showtimes_today.json`);

    } catch (err) {
        console.error("🔥 嚴重錯誤:", err);
    } finally {
        await browser.close();
    }
}

runUnifiedCrawl();