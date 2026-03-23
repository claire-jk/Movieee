import axios from 'axios';
import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function runCrawler() {
  console.log('🚀 [百老匯] 啟動強化版 API 請求模式...');

  try {
    // 使用你截圖中確定的精準 URL
    const url = 'https://www.broadway-cineplex.com.tw/News/GetSPNews'; 
    
    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive',
        'Referer': 'https://www.broadway-cineplex.com.tw/news.html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        // 有些伺服器會檢查 Cookie，雖然我們沒帶，但加上這行能提高成功率
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 15000
    });

    // 檢查回傳的內容類型
    console.log('📡 回傳內容類型:', response.headers['content-type']);

    // 取得資料
    const list = Array.isArray(response.data) ? response.data : (response.data.data || []);
    
    if (list.length === 0) {
      console.log('⚠️ 警告：API 回傳了空陣列。');
      console.log('原始 Response 內容前 100 字:', JSON.stringify(response.data).substring(0, 100));
      return; // 終止執行，避免誤刪 Firebase 資料
    }

    console.log(`📊 API 成功抓取 ${list.length} 筆原始資料`);

    const officialData = list.filter(item => {
      const title = item.Subject || '';
      return title.includes('特典') || title.includes('《') || title.includes('贈');
    }).map(item => ({
      title: item.Subject,
      img: item.Poster.startsWith('http') ? item.Poster : `https://www.broadway-cineplex.com.tw${item.Poster}`,
      date: item.PostDate ? item.PostDate.split('T')[0] : '2026-03-23'
    }));

    console.log(`✅ 篩選出符合條件的特典共 ${officialData.length} 筆`);

    if (officialData.length > 0) {
      const batch = db.batch();
      const currentIds = [];

      officialData.forEach(item => {
        const docId = `broadway_${item.title.replace(/[\/\\#?\[\]]/g, '_')}`;
        currentIds.push(docId);

        const movieTitle = item.title.match(/《(.+?)》/)?.[1] || item.title;
        
        batch.set(db.collection('specials').doc(docId), {
          movieTitle,
          bonusName: item.title,
          cinema: '百老匯',
          image: item.img,
          startDate: item.date,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        
        console.log(`📍 已加入 Batch: ${item.title}`);
      });

      // 清理邏輯：只針對「百老匯」且不在本次名單內的進行刪除
      const oldDocs = await db.collection('specials').where('cinema', '==', '百老匯').get();
      oldDocs.forEach(doc => {
        if (!currentIds.includes(doc.id)) {
          batch.delete(doc.ref);
          console.log(`🗑️ 移除過期特典: ${doc.id}`);
        }
      });

      await batch.commit();
      console.log('🎉 Firebase 同步完成！');
    }

  } catch (err) {
    console.error('❌ 請求失敗:', err.message);
    if (err.response) {
      console.error('錯誤狀態碼:', err.response.status);
      console.error('錯誤 Response:', JSON.stringify(err.response.data).substring(0, 200));
    }
  }
}

runCrawler();