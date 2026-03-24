import fs from 'fs';
import { dirname, join } from 'path';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';

chromium.use(stealth());
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function cleanMovieTitle(fullTitle) {
    let version = "數位";
    if (/4DX/i.test(fullTitle)) version = "4DX";
    else if (/IMAX/i.test(fullTitle)) version = "IMAX";
    else if (/3D/i.test(fullTitle)) version = "3D";
    const cleanTitle = fullTitle.replace(/\(.*?\)/g, '').replace(/3D|4DX|IMAX|SCREENX|數位|英|日|國|分級|普遍級|保護級|輔12級|輔15級|限制級/gi, '').replace(/\s+/g, ' ').trim();
    return { cleanTitle, version };
}

async function runUnifiedCrawl() {
    const browser = await chromium.launch({ headless: false });
    let page = await browser.newPage();
    const cinemaMap = new Map();

    try {
        console.log("🌐 正在進入秀泰電影列表...");
        await page.goto('https://www.showtimes.com.tw/programs', { waitUntil: 'networkidle' });
        await page.waitForSelector('text="線上訂票"', { timeout: 15000 });
        
        const ticketCount = await page.locator('text="線上訂票"').count();
        console.log(`🎬 總計 ${ticketCount} 部電影，準備開始長時間任務...`);

        for (let i = 0; i < ticketCount; i++) {
            // 🛠️ 防當機機制：每 20 部電影重開一次頁面，釋放記憶體
            if (i > 0 && i % 20 === 0) {
                console.log("♻️ 正在釋放記憶體並重啟分頁...");
                await page.close();
                page = await browser.newPage();
                await page.goto('https://www.showtimes.com.tw/programs', { waitUntil: 'domcontentloaded' });
            }

            try {
                // 確保回到列表頁
                if (!page.url().includes('/programs')) {
                    await page.goto('https://www.showtimes.com.tw/programs', { waitUntil: 'domcontentloaded' });
                }

                const btn = page.locator('text="線上訂票"').nth(i);
                await btn.waitFor({ state: 'visible', timeout: 5000 });
                
                const rawTitle = await btn.evaluate(el => el.closest('div').parentElement.innerText.split('\n')[0].trim());
                const { cleanTitle, version: movieDefaultVer } = cleanMovieTitle(rawTitle);

                console.log(`\n🎯 [${i + 1}/${ticketCount}] 處理中: ${cleanTitle}`);

                await btn.click();
                
                // 縮短等待時間，若 5 秒內沒影城按鈕就判定為無場次
                try {
                    await page.waitForSelector('button:has-text("影城")', { timeout: 5000 });
                } catch (e) {
                    console.log(`   ⏩ 無影城場次資訊，跳過`);
                    continue; 
                }

                // 處理彈窗
                const closeBtn = page.locator('button.close, .modal-close');
                if (await closeBtn.isVisible()) await closeBtn.click();

                const cinemas = await page.$$eval('button', btns =>
                    btns.map(b => b.innerText.trim()).filter(t => t.includes('影城'))
                );

                for (let cinemaName of cinemas) {
                    await page.evaluate((name) => {
                        const target = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === name);
                        if (target) target.click();
                    }, cinemaName);

                    await page.waitForTimeout(1200); // 稍微等待 React 渲染

                    const showtimes = await page.evaluate(() => {
                        return Array.from(document.querySelectorAll('*'))
                            .filter(el => el.innerText && el.innerText.trim())
                            .map(el => el.innerText.trim())
                            .filter(text => /^\d{2}:\d{2}/.test(text)) 
                            .map(time => ({ time: time.split('~')[0].trim(), ver: "數位" }));
                    });

                    if (showtimes.length > 0) {
                        if (!cinemaMap.has(cinemaName)) {
                            cinemaMap.set(cinemaName, { cinema: cinemaName, movies: [] });
                        }
                        const cinemaData = cinemaMap.get(cinemaName);
                        let movieEntry = cinemaData.movies.find(m => m.title === cleanTitle);
                        if (!movieEntry) {
                            movieEntry = { title: cleanTitle, versions: [movieDefaultVer], showtimes: [] };
                            cinemaData.movies.push(movieEntry);
                        }
                        movieEntry.showtimes = showtimes;
                    }
                }
            } catch (innerErr) {
                console.error(`   ❌ 第 ${i+1} 部發生非預期錯誤`);
            }
            
            // 😴 每次抓完一部休息 0.5 秒，避免請求過快
            await page.waitForTimeout(500);
        }

        const finalOutput = Array.from(cinemaMap.values());
        fs.writeFileSync(join(__dirname, 'showtimes_all.json'), JSON.stringify(finalOutput, null, 4));
        console.log(`\n🏁 任務全數完成！檔案存於: showtimes_all.json`);

    } catch (err) {
        console.error("🔥 嚴重錯誤:", err);
    } finally {
        await browser.close();
    }
}

runUnifiedCrawl();