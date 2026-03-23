import axios from 'axios';
import admin from 'firebase-admin';

// 1. 初始化 Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function runCrawler() {
  console.log('🚀 [百老匯] 啟動正式 API 抓取同步任務...');

  try {
    const url = 'https://www.broadway-cineplex.com.tw/News/GetSPNews';
    
    // 使用剛才測試成功的 Header 設定
    const response = await axios.get(url, {
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': 'https://www.broadway-cineplex.com.tw/news.html'
        },
        timeout: 15000
    });

    const newsGroups = response.data.newsdata || [];
    const officialData = [];

    // 2. 執行剛才測試成功的「攤平」與「過濾」邏輯
    newsGroups.forEach(group => {
      ['object1', 'object2', 'object3'].forEach(key => {
        const item = group[key];
        if (item && item.title) {
          const t = item.title.trim();
          // 過濾條件：標題含「特典」或《》
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

    console.log(`📊 成功過濾出 ${officialData.length} 筆特典資料`);

    // 3. 同步至 Firebase
    if (officialData.length > 0) {
      const batch = db.batch();
      const currentIds = [];

      officialData.forEach(item => {
        // 使用標題做唯一 ID (清理特殊符號)
        const docId = `broadway_${item.title.replace(/[\/\\#?\[\]]/g, '_')}`;
        currentIds.push(docId);

        // 提取電影片名
        const movieTitle = item.title.match(/《(.+?)》/)?.[1] || item.title;

        batch.set(db.collection('specials').doc(docId), {
          movieTitle,
          bonusName: item.title,
          cinema: '百老匯',
          image: item.img,
          startDate: item.date,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        
        console.log(`📍 準備同步: ${item.title}`);
      });

      // 4. 清理已下架項目 (選配：如果官網沒了，Firebase 也刪除)
      const oldDocs = await db.collection('specials').where('cinema', '==', '百老匯').get();
      oldDocs.forEach(doc => {
        if (!currentIds.includes(doc.id)) {
          batch.delete(doc.ref);
          console.log(`🗑️ 移除過期特典: ${doc.id}`);
        }
      });

      await batch.commit();
      console.log('🎉 [大功告成] 百老匯特典已完美同步至 Firebase！');
    } else {
      console.log('⚠️ 沒抓到任何符合條件的特典，略過更新。');
    }

  } catch (err) {
    console.error('❌ 執行失敗:', err.message);
    process.exit(1);
  }
}

runCrawler();