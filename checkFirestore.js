import fs from 'fs';
import { dirname, join } from 'path';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';

chromium.use(stealth());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 🧼 電影標題清洗
 */
function cleanMovieTitle(fullTitle) {
    let version = "數位";

    if (/4DX/i.test(fullTitle)) version = "4DX";
    else if (/IMAX/i.test(fullTitle)) version = "IMAX";
    else if (/3D/i.test(fullTitle)) version = "3D";
    else if (/SCREENX/i.test(fullTitle)) version = "ScreenX";
    else if (/LIVE/i.test(fullTitle)) version = "LIVE";

    let cleanTitle = fullTitle
        .replace(/\(.*?\)/g, '')
        .replace(/3D|4DX|IMAX|GOLD CLASS|SCREENX|數位|英|日|國|分級|普遍級|保護級|輔12級|輔15級|限制級|待定/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    return { cleanTitle, version };
}

async function runUnifiedCrawl() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    const finalOutput = [];

    try {
        console.log("🌐 進入秀泰電影列表...");
        await page.goto('https://www.showtimes.com.tw/programs', {
            waitUntil: 'networkidle'
        });

        await page.waitForSelector('text="線上訂票"', { timeout: 15000 });

        // ⭐ 抓所有電影按鈕數量（只抓一次）
        const movieCount = await page.locator('text="線上訂票"').count();
        console.log(`🎬 共找到 ${movieCount} 部電影`);

        for (let m = 0; m < movieCount; m++) {

            // ⭐ 每次重新抓 locator（避免 stale）
            const ticketBtns = page.locator('text="線上訂票"');
            const btn = ticketBtns.nth(m);

            // ⭐ 抓電影標題
            const rawTitle = await btn.evaluate(el => {
                const card = el.closest('div');
                return card.parentElement.innerText.split('\n')[0].trim();
            });

            const { cleanTitle } = cleanMovieTitle(rawTitle);
            console.log(`\n🎯 處理電影 ${m + 1}/${movieCount}: ${cleanTitle}`);

            await btn.click();

            // ⭐ 等影城載入
            await page.waitForSelector('button:has-text("影城")', { timeout: 20000 });

            const venueCount = await page.locator('button:has-text("影城")').count();
            console.log(`🏢 共 ${venueCount} 間影城`);

            for (let i = 0; i < venueCount; i++) {

                const venueBtns = page.locator('button:has-text("影城")');
                const venueBtn = venueBtns.nth(i);

                const venueName = await venueBtn.innerText();
                console.log(`🎬 處理影城: ${venueName}`);

                await venueBtn.click();
                await page.waitForTimeout(2000);

const showtimes = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));

    const results = elements
        .map(el => el.innerText.trim())
        .filter(text => /^\d{2}:\d{2}/.test(text))
        .map(text => {
            const time = text.split('~')[0].trim();

            let ver = "數位";
            if (/4DX/i.test(text)) ver = "4DX";
            else if (/3D/i.test(text)) ver = "3D";
            else if (/SCREENX/i.test(text)) ver = "ScreenX";
            else if (/Dolby/i.test(text)) ver = "Dolby";

            return { time, ver };
        });

    return results;
});

                if (showtimes.length > 0) {
                    const versions = [...new Set(showtimes.map(s => s.ver))];

                    finalOutput.push({
                        cinema: venueName,
                        movies: [{
                            title: cleanTitle,
                            versions,
                            showtimes
                        }]
                    });
                }
            }

            // ⭐ 回首頁抓下一部（關鍵！！）
            await page.goto('https://www.showtimes.com.tw/programs', {
                waitUntil: 'networkidle'
            });

            await page.waitForTimeout(2000);
        }

        // ⭐ 輸出 JSON
        const outputPath = join(__dirname, 'showtimes_all.json');
        fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 4));

        console.log("\n🏁 全部電影抓取完成！");
        console.log(`📁 檔案位置: ${outputPath}`);

    } catch (err) {
        console.error("🔥 抓取失敗:", err);
    }

    await browser.close();
}

runUnifiedCrawl();