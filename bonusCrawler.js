import axios from 'axios';
import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function runCrawler() {
  console.log('🚀 鎖定百老匯 GetSPNews API 進行抓取...');

  try {
    // 💡 根據你的截圖，這是正確的 API 網址
    const url = 'https://www.broadway-cineplex.com.tw/G_API/Home/GetSPNews'; 
    
    const response = await axios.post(url, {}, { // 注意：通常這種命名方式的 API 可能是 POST
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.broadway-cineplex.com.tw/news.html',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 20000
    });

    // 如果 POST 不行，試試 GET (有些 API 雖然截圖寫 xhr 但兩者都吃)
    let newsData = response.data;
    
    // 檢查回傳資料格式，有時候是在 response.data.data 裡面
    const list = Array.isArray(newsData) ? newsData : (newsData.data || []);
    
    console.log(`📊 API 回傳原始筆數: ${list.length}`);

    const officialData = list.filter(item => {
      // 根據截圖中看到的標題，過濾出特典
      const title = item.Subject || item.title || '';
      return title.includes('特典') || title.includes('《') || title.includes('贈');
    }).map(item => ({
      // 百老匯 API 欄位通常是大寫開頭，請根據實際回傳調整
      title: item.Subject || item.title,
      img: item.Poster || item.image,
      date: item.PostDate || item.date || '2026-03-23'
    }));

    console.log(`✅ 過濾出 ${officialData.length} 個相關特典`);

    if (officialData.length > 0) {
      const batch = db.batch();
      const currentOfficialIds = [];

      officialData.forEach(item => {
        const docId = item.title.replace(/[\/\\#?\[\]]/g, '_');
        currentOfficialIds.push(docId);

        const movieTitle = item.title.match(/《(.+?)》/)?.[1] || item.title;
        const res = {
          movieTitle,
          bonusName: item.title,
          cinema: '百老匯',
          image: item.img.startsWith('http') ? item.img : `https://www.broadway-cineplex.com.tw${item.img}`,
          startDate: item.date,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        batch.set(db.collection('specials').doc(docId), res, { merge: true });
        console.log(`📍 已準備同步: ${item.title}`);
      });

      // 同步刪除
      const allDocs = await db.collection('specials').where('cinema', '==', '百老匯').get();
      allDocs.forEach(doc => {
        if (!currentOfficialIds.includes(doc.id)) {
          batch.delete(doc.ref);
        }
      });

      await batch.commit();
      console.log('🎉 恭喜！百老匯資料已透過真實 API 同步完成。');
    } else {
      console.log('⚠️ 雖然 API 有回應，但沒找到符合條件的「特典」字眼，請檢查 API 回傳內容。');
      console.log('回傳樣例：', JSON.stringify(list[0])); // 列印一筆樣例方便除錯
    }

  } catch (err) {
    console.error('❌ API 請求失敗:', err.message);
    process.exit(1);
  }
}

runCrawler();