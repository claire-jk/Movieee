import axios from 'axios';
import admin from 'firebase-admin';

// ✅ 讀取 GitHub Secrets
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function runCrawler() {
  console.log('🚀 [版本檢查] 正式執行 broadwayRunner.js V3 (特典爬蟲)');

  try {
    const url = 'https://www.broadway-cineplex.com.tw/News/GetSPNews';
    const response = await axios.get(url, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.broadway-cineplex.com.tw/news.html'
      }
    });

    const newsGroups = response.data.newsdata || [];
    const officialData = [];

    // 🏆 攤平結構：從 object1, object2, object3 提取
    newsGroups.forEach(group => {
      ['object1', 'object2', 'object3'].forEach(key => {
        const item = group[key];
        if (item && item.title) {
          const t = item.title.trim();
          if (t.includes('特典') || t.includes('《')) {
            officialData.push({
              title: t,
              img: item.img1,
              date: item.releaseDate
            });
          }
        }
      });
    });

    console.log(`📊 找到符合條件的特典共 ${officialData.length} 筆`);

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
        
        console.log(`📍 準備同步到 Firebase: ${item.title}`);
      });

      // 清理舊資料：確保只留下官網目前還有的
      const oldDocs = await db.collection('specials').where('cinema', '==', '百老匯').get();
      oldDocs.forEach(doc => {
        if (!currentIds.includes(doc.id)) {
          batch.delete(doc.ref);
          console.log(`🗑️ 移除過期特典: ${doc.id}`);
        }
      });

      await batch.commit();
      console.log('🎉 [大功告成] 百老匯特典牆更新成功！');
    }

  } catch (err) {
    console.error('❌ 抓取失敗:', err.message);
  }
}

runCrawler();