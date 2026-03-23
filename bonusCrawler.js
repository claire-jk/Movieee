import axios from 'axios';
import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function runCrawler() {
  console.log('🚀 [百老匯] 啟動 Debug 模式抓取...');

  try {
    const url = 'https://www.broadway-cineplex.com.tw/News/GetSPNews';
    
    const response = await axios.get(url, {
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': 'https://www.broadway-cineplex.com.tw/news.html',
            'Accept': 'application/json, text/javascript, */*; q=0.01'
        },
        timeout: 15000
    });

    // 🕵️ DEBUG: 檢查 API 到底回傳了什麼
    console.log('📡 回傳狀態碼:', response.status);
    console.log('📡 回傳資料類型:', typeof response.data);
    
    // 如果資料是字串，可能被擋掉回傳了 HTML 或空字串
    if (typeof response.data === 'string') {
        console.log('⚠️ 注意：回傳的是字串而非 JSON，前 100 字為:', response.data.substring(0, 100));
    }

    const newsGroups = response.data.newsdata || [];
    console.log(`📊 newsdata 陣列長度: ${newsGroups.length}`);

    const officialData = [];

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

    console.log(`✅ 最終篩選出 ${officialData.length} 筆特典`);

    // 只有在真的有資料時才寫入 Firebase
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
      });

      await batch.commit();
      console.log('🎉 Firebase 同步完成！');
    } else {
        // 如果是 0 筆，印出其中一組資料來看看結構是否有變
        if (newsGroups.length > 0) {
            console.log('🔎 第一組資料內容:', JSON.stringify(newsGroups[0]));
        }
    }

  } catch (err) {
    console.error('❌ 抓取異常:', err.message);
  }
}

runCrawler();