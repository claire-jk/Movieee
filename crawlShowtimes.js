import fs from 'fs';
import { dirname, join } from 'path';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';

chromium.use(stealth());
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 🧼 核心清洗函數：移植自你的威秀程式碼
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
    const finalOutput = []; // 最終輸出改為 Array 格式

    try {
        console.log("🌐 正在進入秀泰電影總覽...");
        await page.goto('https://www.showtimes.com.tw/programs', { waitUntil: 'networkidle' });

        // 定位第一個訂票按鈕並抓取標題
        const ticketBtn = page.locator('text="線上訂票"').first();
        await ticketBtn.waitFor({ state: 'visible', timeout: 15000 });

        const rawTitle = await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('*')).find(el => el.innerText === '線上訂票');
            const card = btn.closest('div'); 
            return card.parentElement.innerText.split('\n')[0].trim();
        });

        // 進行第一次清洗確認
        const { cleanTitle } = cleanMovieTitle(rawTitle);
        console.log(`🎯 目標電影：${rawTitle} -> 清洗後：${cleanTitle}`);

        await ticketBtn.click();
        await page.waitForSelector('button:has-text("影城")', { timeout: 20000 });

        const venueButtons = await page.$$('button:has-text("影城")');
        console.log(`🎯 找到 ${venueButtons.length} 間影城，開始處理格式...`);

        for (let i = 0; i < venueButtons.length; i++) {
            const btns = await page.$$('button:has-text("影城")');
            const venueName = await btns[i].innerText();
            
            console.log(`🎬 處理中: ${venueName}`);
            await btns[i].click();
            await page.waitForTimeout(2500); 

            const showtimes = await page.evaluate(() => {
                const nodes = Array.from(document.querySelectorAll('div.text-lg'));
                return nodes.map(node => {
                    const time = node.innerText.split('~')[0].trim();
                    const parent = node.closest('div'); 
                    const infoNode = parent.parentElement.innerText;
                    // 這裡簡單抓取版本關鍵字
                    let ver = "數位";
                    if (/4DX/i.test(infoNode)) ver = "4DX";
                    else if (/3D/i.test(infoNode)) ver = "3D";
                    else if (/SCREENX/i.test(infoNode)) ver = "ScreenX";
                    else if (/Dolby/i.test(infoNode)) ver = "Dolby";
                    
                    return { time, ver };
                }).filter(t => t.time.includes(':'));
            });

            if (showtimes.length > 0) {
                // 產生該電影在該影城的所有版本清單 (去重)
                const versions = [...new Set(showtimes.map(s => s.ver))];

                // 構建與威秀一致的物件結構
                finalOutput.push({
                    cinema: venueName,
                    movies: [{
                        title: cleanTitle,
                        versions: versions,
                        showtimes: showtimes
                    }]
                });
            }
        }

        // 儲存結果
        fs.writeFileSync(join(__dirname, 'showtimes_check.json'), JSON.stringify(finalOutput, null, 4));
        console.log(`\n🏁 格式同步完成！輸出已存為 Array 格式。`);

    } catch (err) {
        console.error("🔥 抓取失敗:", err.message);
    }

    await browser.close();
}

runUnifiedCrawl();