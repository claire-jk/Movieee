import fs from 'fs';
import { dirname, join } from 'path';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';

chromium.use(stealth());
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 清理電影名稱，移除版本標籤與分級資訊
 */
function cleanMovieTitle(fullTitle) {
    const cleanTitle = fullTitle.replace(/\(.*?\)/g, '')
        .replace(/3D|4DX|IMAX|SCREENX|數位|英|日|國|分級|普遍級|保護級|輔12級|輔15級|限制級/gi, '')
        .replace(/\s+/g, ' ').trim();
    return cleanTitle;
}

async function runUnifiedCrawl() {
    // 開啟瀏覽器 (headless: false 方便觀察，若要背景執行可改為 true)
    const browser = await chromium.launch({ headless: false }); 
    let page = await browser.newPage();
    const cinemaMap = new Map();

    try {
        console.log("🌐 正在進入秀泰電影列表...");
        await page.goto('https://www.showtimes.com.tw/programs', { waitUntil: 'networkidle' });
        await page.waitForSelector('text="線上訂票"', { timeout: 15000 });
        
        const ticketCount = await page.locator('text="線上訂票"').count();
        console.log(`🎬 總計偵測到 ${ticketCount} 部電影，開始解析場次...`);

        // 這裡設定 i < ticketCount 跑全部，測試時可以改小數字
        for (let i = 0; i < ticketCount; i++) {
            
            // 🛠️ 防當機機制：每 15 部電影重開一次頁面，釋放記憶體
            if (i > 0 && i % 15 === 0) {
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
                
                // 取得電影原始名稱並清理
                const rawTitle = await btn.evaluate(el => el.closest('div').parentElement.innerText.split('\n')[0].trim());
                const cleanTitle = cleanMovieTitle(rawTitle);

                console.log(`\n🎯 [${i + 1}/${ticketCount}] 處理中: ${cleanTitle}`);
                await btn.click();

                // 等待影城選單按鈕出現
                try {
                    await page.waitForSelector('button:has-text("影城")', { timeout: 6000 });
                } catch (e) {
                    console.log(`  ⏩ 無影城場次資訊，跳過`);
                    continue; 
                }

                // 取得所有影城名稱
                const cinemas = await page.$$eval('button', btns =>
                    btns.map(b => b.innerText.trim()).filter(t => t.includes('影城'))
                );

                for (let cinemaName of cinemas) {
                    console.log(`    🏢 進入影城: ${cinemaName}`);
                    
                    // 模擬點擊影城
                    await page.getByRole('button', { name: cinemaName, exact: true }).click();
                    
                    // 重要：等待場次卡片渲染完成
                    await page.waitForTimeout(1500); 

                    // 🛠️ 直接從場次卡片解析「廳別 | 版本」與「時間」
                    const extractedShowtimes = await page.evaluate(() => {
                        // 找到所有包含時間格式 (00:00) 且有分隔符號 | 的元素
                        const cards = Array.from(document.querySelectorAll('div, button, a')).filter(el => 
                            el.innerText && el.innerText.includes('|') && /\d{2}:\d{2}/.test(el.innerText)
                        );

                        return cards.map(card => {
                            const fullText = card.innerText.trim();
                            const lines = fullText.split('\n');
                            
                            let version = "數位"; // 預設
                            let time = "";

                            // 1. 提取版本 (找包含 | 的那一行)
                            const infoLine = lines.find(l => l.includes('|'));
                            if (infoLine) {
                                // 取得 | 後面的文字，例如 "2D 英語"
                                const parts = infoLine.split('|');
                                if (parts[1]) version = parts[1].trim();
                            }

                            // 2. 提取時間 (找符合 00:00 格式的那一行)
                            const timeLine = lines.find(l => /\d{2}:\d{2}/.test(l));
                            if (timeLine) {
                                // 處理 "11:00 ~ 12:38" 取前面
                                time = timeLine.split('~')[0].trim();
                            }

                            return { version, time };
                        }).filter(item => item.time !== ""); 
                    });

                    // 將解析結果整理進 Map
                    extractedShowtimes.forEach(item => {
                        if (!cinemaMap.has(cinemaName)) {
                            cinemaMap.set(cinemaName, { cinema: cinemaName, movies: [] });
                        }
                        const cinemaData = cinemaMap.get(cinemaName);
                        let movieEntry = cinemaData.movies.find(m => m.title === cleanTitle);
                        
                        if (!movieEntry) {
                            movieEntry = { title: cleanTitle, versions: [] };
                            cinemaData.movies.push(movieEntry);
                        }

                        let versionGroup = movieEntry.versions.find(v => v.name === item.version);
                        if (!versionGroup) {
                            versionGroup = { name: item.version, showtimes: [] };
                            movieEntry.versions.push(versionGroup);
                        }
                        
                        // 避免存入重複時間
                        if (!versionGroup.showtimes.includes(item.time)) {
                            versionGroup.showtimes.push(item.time);
                        }
                    });
                }
            } catch (innerErr) {
                console.error(`  ❌ 第 ${i+1} 部發生錯誤:`, innerErr.message);
            }
            
            // 稍微休息避免過快被封鎖
            await page.waitForTimeout(800);
        }

        // 輸出 JSON 檔案
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