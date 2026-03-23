import axios from 'axios';
import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function runCrawler() {
  console.log('🚀 [Debug 模式] 開始抓取百老匯...');

  try {
    const url = 'https://www.broadway-cineplex.com.tw/News/GetSPNews';
    
    const response = await axios.get(url, {
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': 'https://www.broadway-cineplex.com.tw/news.html'
        }
    });

    // --- 🕵️ 重點 Debug 區段 ---
    console.log('📡 API 回傳狀態碼:', response.status);
    
    // 把原始資料轉成字串印出來 (只印前 500 個字，避免 Log 太長)
    const rawData = JSON.stringify(response.data);
    console.log('📥 原始回傳內容 (前500字):', rawData.substring(0, 500));

    if (!response.data.newsdata) {
        console.log('❌ 錯誤：回傳格式中找不到 newsdata 欄位！');
        return;
    }
    // --- End Debug ---

    const newsGroups = response.data.newsdata;
    const officialData = [];

    newsGroups.forEach(group => {
      ['object1', 'object2', 'object3'].forEach(key => {
        const item = group[key];
        if (item && item.title) {
          if (item.title.includes('特典') || item.title.includes('《')) {
            officialData.push({ title: item.title });
          }
        }
      });
    });

    console.log(`📊 最終篩選結果筆數: ${officialData.length}`);

  } catch (err) {
    console.error('❌ 請求徹底失敗:', err.message);
    if (err.response) {
        console.log('🚫 伺服器回傳錯誤內容:', JSON.stringify(err.response.data));
    }
  }
}

runCrawler();