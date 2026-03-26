import fs from 'fs';
import { dirname, join } from 'path';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';

chromium.use(stealth());
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const now = new Date();
const todayFullStr = now.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' });

// --- 工具函數 ---

function standardizeVersion(rawVer) {
    const v = rawVer.toUpperCase();
    if (v.includes('SCREENX')) return v.includes('3D') ? 'ScreenX 3D' : 'ScreenX';
    if (v.includes('4DX')) return '4DX';
    if (v.includes('IMAX')) return 'IMAX';
    if (v.includes('3D')) return '數位 3D';
    if (v.includes('LIVE') || v.includes('現場直播')) return 'LIVE';
    return '數位 2D';
}

function cleanMovieTitle(fullTitle) {
    return fullTitle
        .replace(/\(.*?\)/g, '')
        .replace(/特別場|鐵粉|首日|首場|特別映演|安可重播|現場直播/g, '')
        .replace(/3D|4DX|IMAX|SCREENX|數位|英|日|國|韓|泰|粵|分級|普遍級|保護級|輔12級|輔15級|限制級|待定/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * 🚀 新增：具備重試機制的導航函數
 */
async function gotoWithRetry(page, url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            return; // 成功就跳出
        } catch (err) {
            console.log(`⚠️ 連線失敗 (第 ${i + 1} 次重試): ${err.message}`);
            if (i === retries - 1) throw err; // 最後一次失敗才拋出
            await new Promise(res => setTimeout(res, 3000)); // 等待 3 秒後重試
        }
    }
}

async function runUnifiedCrawl() {
    const browser = await chromium.launch({ headless: true }); 
    let page = await browser.newPage();
    const cinemaMap = new Map();

    try {
        console.log(`🚀 秀泰任務啟動 [強效重試版] - ${todayFullStr}`);
        
        await gotoWithRetry(page, 'https://www.showtimes.com.tw/programs');
        await page.waitForSelector('text="線上訂票"', { timeout: 15000 });
        
        const ticketCount = await page.locator('text="線上訂票"').count();
        console.log(`🎬 偵測到 ${ticketCount} 部電影，開始解析...`);

        for (let i = 0; i < ticketCount; i++) {
            // 定期換頁面防止記憶體問題
            if (i > 0 && i % 20 === 0) {
                await page.close();
                page = await browser.newPage();
            }

            try {
                // 確保回到列表頁
                if (!page.url().endsWith('/programs')) {
                    await gotoWithRetry(page, 'https://www.showtimes.com.tw/programs');
                }

                const btn = page.locator('text="線上訂票"').nth(i);
                await btn.waitFor({ state: 'visible', timeout: 10000 });
                
                const rawTitle = await btn.evaluate(el => el.closest('div').parentElement.innerText.split('\n')[0].trim());
                const cleanTitle = cleanMovieTitle(rawTitle);

                console.log(`🎯 [${i + 1}/${ticketCount}] 處理中: ${cleanTitle}`);
                await btn.click();

                // 等待選單出現，如果失敗則跳過這部
                try {
                    await page.waitForSelector('button:has-text("影城")', { timeout: 8000 });
                } catch (e) {
                    console.log(`  ⏩ 影城選單未出現，跳過`);
                    continue; 
                }

                const cinemas = await page.$$eval('button', btns =>
                    btns.map(b => b.innerText.trim()).filter(t => t.includes('影城'))
                );

                for (let cinemaName of cinemas) {
                    try {
                        await page.getByRole('button', { name: cinemaName, exact: true }).click();
                        await page.waitForTimeout(800); // 稍微等待渲染

                        const rawShowtimes = await page.evaluate(() => {
                            const results = [];
                            const cards = Array.from(document.querySelectorAll('div, button, a'))
                                .filter(el => {
                                    const style = window.getComputedStyle(el);
                                    return style.display !== 'none' && 
                                           el.innerText?.includes('|') && 
                                           /\d{2}:\d{2}/.test(el.innerText);
                                });

                            cards.forEach(card => {
                                const lines = card.innerText.trim().split('\n');
                                const infoLine = lines.find(l => l.includes('|'));
                                const timeLine = lines.find(l => /\d{2}:\d{2}/.test(l));
                                if (timeLine) {
                                    results.push({ 
                                        time: timeLine.split('~')[0].trim(), 
                                        ver: infoLine ? infoLine.split('|')[1]?.trim() : "數位"
                                    });
                                }
                            });
                            return results;
                        });

                        if (rawShowtimes.length > 0) {
                            if (!cinemaMap.has(cinemaName)) {
                                cinemaMap.set(cinemaName, { cinemaName, date: todayFullStr, movies: [] });
                            }
                            const cinemaData = cinemaMap.get(cinemaName);
                            let movieEntry = cinemaData.movies.find(m => m.title === cleanTitle);
                            if (!movieEntry) {
                                movieEntry = { title: cleanTitle, versions: [], showtimes: [] };
                                cinemaData.movies.push(movieEntry);
                            }

                            rawShowtimes.forEach(s => {
                                const finalVer = standardizeVersion(s.ver);
                                if (!movieEntry.versions.includes(finalVer)) movieEntry.versions.push(finalVer);
                                if (!movieEntry.showtimes.some(st => st.time === s.time && st.ver === finalVer)) {
                                    movieEntry.showtimes.push({ time: s.time, ver: finalVer });
                                }
                            });
                        }
                    } catch (cinErr) {
                        console.log(`    ⚠️ 影城 ${cinemaName} 解析失敗，繼續下一間`);
                    }
                }
            } catch (innerErr) {
                console.error(` ❌ 第 ${i + 1} 部電影處理崩潰:`, innerErr.message);
                // 斷線救回邏輯
                if (innerErr.message.includes('DISCONNECTED')) {
                    console.log("🔌 偵測到斷線，等待 10 秒後重啟連線...");
                    await new Promise(res => setTimeout(res, 10000));
                }
            }
        }

        // 整理結果
        const finalOutput = Array.from(cinemaMap.values());
        finalOutput.forEach(c => c.movies.forEach(m => m.showtimes.sort((a, b) => a.time.localeCompare(b.time))));

        fs.writeFileSync(join(__dirname, 'showtimes_today.json'), JSON.stringify(finalOutput, null, 4));
        console.log(`\n🏁 秀泰場次抓取完畢！檔案：showtimes_today.json`);

    } catch (err) {
        console.error("🔥 腳本核心崩潰:", err);
    } finally {
        await browser.close();
    }
}

runUnifiedCrawl();