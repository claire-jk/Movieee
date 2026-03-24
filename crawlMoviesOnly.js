import fs from 'fs';
import { dirname, join } from 'path';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';

chromium.use(stealth());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runFastInfoCrawler() {
    const browser = await chromium.launch({ headless: false }); 
    const page = await browser.newPage();
    let finalMovieData = [];

    console.log("🌐 正在連線至電影總覽頁面...");

    page.on('response', async (res) => {
        // 只要網址有 bootstrap 且是 JSON
        if (res.url().includes('bootstrap') && !res.url().endsWith('.js')) {
            try {
                const json = await res.json();
                if (json.payload && json.payload.programs) {
                    finalMovieData = json.payload.programs.map(p => ({
                        id: p.id,
                        title: p.name,
                        engTitle: p.nameEng,
                        date: p.datePublished,
                        duration: p.duration,
                        category: p.category,
                        description: p.description
                    }));
                    console.log(`✅ 成功！一次抓到 ${finalMovieData.length} 部電影的詳細完整資訊！`);
                }
            } catch (e) {}
        }
    });

    await page.goto('https://www.showtimes.com.tw/programs', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000); // 給他一點時間下載

    if (finalMovieData.length > 0) {
        fs.writeFileSync(join(__dirname, 'movies_info_final.json'), JSON.stringify(finalMovieData, null, 4));
        console.log(`\n🏁 任務完成！請檢查 movies_info_final.json`);
    } else {
        console.log("❌ 還是沒抓到，可能 API 關鍵字變了。");
    }

    await browser.close();
}

runFastInfoCrawler();