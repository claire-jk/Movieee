import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

async function grabYahooData() {
    // 嘗試使用不同的路徑結尾，並改用 https
    const url = 'https://movies.yahoo.com.tw/theater_list.html'; 
    
    try {
        console.log("🌐 正在連線至 Yahoo 電影時刻表 (嘗試繞過偵測)...");
        
        const response = await axios.get(url, {
            headers: {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'accept-language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
                'cache-control': 'no-cache',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
            maxRedirects: 5,
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const results = [];

        // Yahoo 的戲院清單通常包在 .theater_list 區塊中
        $('a[href*="theater_result.html/id="]').each((i, el) => {
            const name = $(el).text().trim();
            const href = $(el).attr('href'); 
            const idMatch = href ? href.match(/id=(\d+)/) : null;
            
            if (idMatch && name && name !== "") {
                results.push({
                    name: name,
                    yahooId: idMatch[1],
                    url: href.startsWith('http') ? href : `https://movies.yahoo.com.tw${href}`
                });
            }
        });

        // 移除重複
        const uniqueResults = Array.from(new Map(results.map(item => [item.yahooId, item])).values());

        if (uniqueResults.length === 0) {
            console.log("⚠️ 抓不到資料。這可能是因為頁面結構改變了。");
            // 偵錯用：印出前 500 個字元看看網頁回傳了什麼
            console.log("網頁內容片段：", response.data.substring(0, 500));
        } else {
            fs.writeFileSync('yahoo_cinemas.json', JSON.stringify(uniqueResults, null, 2));
            console.log(`\n✅ 成功！總共抓到 ${uniqueResults.length} 間戲院。`);
        }
    } catch (error) {
        if (error.response) {
            console.error(`❌ 伺服器錯誤 (${error.response.status}): 可能是網址已變更。`);
        } else {
            console.error('❌ 網路錯誤:', error.message);
        }
    }
}

grabYahooData();