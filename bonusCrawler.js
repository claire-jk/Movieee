import axios from 'axios';
import admin from 'firebase-admin';

// 初始化 Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function runCrawler() {
  console.log('🚀 正在透過 GetSPNews API 抓取百老匯特典...');

  try {
    // 💡 這是從你的截圖中偵測到的真實 API 路徑
    const url = 'https://www.broadway-cineplex.com.tw/G_API/Home/GetSPNews'; 
    
    const response = await axios.post(url, {}, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.broadway-cineplex.com.tw/news.html',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 20000
    });

    // 取得資料列表 (百老匯 API 通常回傳陣列)
    const list = Array.isArray(response.data) ? response.data : (response.data.data || []);
    console.log(`📊 API 成功回傳 ${list.length} 筆原始資料`);

    // 篩選標題包含「特典」、「《」或「贈」的項目
    const officialData = list.filter(item => {
      const title = item.Subject || ''; // 百老匯 API 標題欄位通常是 Subject
      return title.includes('特典') || title.includes('《') || title.includes('贈');
    }).map(item => ({
      title: item.Subject,
      // 組合完整圖片網址，API 回傳通常是相對路徑
      img: item.Poster.startsWith('http') ? item.Poster : `https://www.broadway-cineplex.com.tw${item.Poster}`,
      date: item.PostDate ? item.PostDate.split('T')[0] : '2026-03-23'
    }));

    console.log(`✅ 篩選出 ${officialData.length} 個符合條件的特典`);

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
          image: item.img,
          startDate: item.date,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        batch.set(db.collection('specials').doc(docId), res, { merge: true });
        console.log(`📍 準備同步: ${item.title}`);
      });

      // 清理已下架項目
      const allDocs = await db.collection('specials').where('cinema', '==', '百老匯').get();
      allDocs.forEach(doc => {
        if (!currentOfficialIds.includes(doc.id)) {
          batch.delete(doc.ref);
        }
      });

      await batch.commit();
      console.log('🎉 [大功告成] 特典資料已成功更新至 Firebase！');
    }

  } catch (err) {
    console.error('❌ 抓取失敗:', err.message);
    process.exit(1);
  }
}

runCrawler();