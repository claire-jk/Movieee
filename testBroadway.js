import axios from 'axios';

async function testBroadway() {
    console.log('🔍 正在本地端測試百老匯 API...');
    
    try {
        const url = 'https://www.broadway-cineplex.com.tw/News/GetSPNews';
        
        const response = await axios.get(url, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://www.broadway-cineplex.com.tw/news.html'
            }
        });

        // 核心邏輯：從 JSON 結構中提取資料
        const newsGroups = response.data.newsdata || [];
        const extractedItems = [];

        newsGroups.forEach(group => {
            // 遍歷 object1, object2, object3
            ['object1', 'object2', 'object3'].forEach(key => {
                const item = group[key];
                if (item && item.title) {
                    // 只過濾出標題包含「特典」或有《》括號的
                    if (item.title.includes('特典') || item.title.includes('《')) {
                        extractedItems.push({
                            標題: item.title.trim(),
                            日期: item.releaseDate,
                            圖片網址: item.img1
                        });
                    }
                }
            });
        });

        if (extractedItems.length > 0) {
            console.log(`✅ 成功！抓到 ${extractedItems.length} 筆特典資料：`);
            console.table(extractedItems); // 以漂亮的表格顯示在終端機
        } else {
            console.log('⚠️ 抓取成功但沒找到符合條件的特典，請檢查 JSON 內容。');
            console.log('原始資料範例：', newsGroups[0]);
        }

    } catch (err) {
        console.error('❌ 抓取失敗，原因：', err.message);
    }
}

testBroadway();