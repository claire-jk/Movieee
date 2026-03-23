import axios from 'axios';
import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function runCrawler() {
  // 💡 故意改掉標題，用來確認 GitHub 有沒有抓到最新版
  console.log('🚀 [版本檢查] 這是我剛才更新的 V3 版本！');

  try {
    const url = 'https://www.broadway-cineplex.com.tw/News/GetSPNews';
    const response = await axios.get(url, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.broadway-cineplex.com.tw/news.html'
      }
    });

    console.log('📡 API 原始回傳長度:', JSON.stringify(response.data).length);
    
    // 如果長度太短 (例如小於 100)，代表被擋住了
    if (JSON.stringify(response.data).length < 100) {
        console.log('⚠️ 警告：回傳內容異常短小，可能是被封鎖了。內容：', response.data);
    }

    const newsGroups = response.data.newsdata || [];
    const officialData = [];

    newsGroups.forEach(group => {
      ['object1', 'object2', 'object3'].forEach(key => {
        const item = group[key];
        if (item && item.title) {
          if (item.title.includes('特典') || item.title.includes('《')) {
            officialData.push({
              title: item.title.trim(),
              img: item.img1,
              date: item.releaseDate
            });
          }
        }
      });
    });

    console.log(`✅ 最終找到 ${officialData.length} 筆資料`);

    if (officialData.length > 0) {
      const batch = db.batch();
      officialData.forEach(item => {
        const docId = `broadway_${item.title.replace(/[\/\\#?\[\]]/g, '_')}`;
        batch.set(db.collection('specials').doc(docId), {
          movieTitle: item.title.match(/《(.+?)》/)?.[1] || item.title,
          bonusName: item.title,
          cinema: '百老匯',
          image: item.img,
          startDate: item.date,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      });
      await batch.commit();
      console.log('🎉 Firebase 同步成功！');
    }
  } catch (err) {
    console.error('❌ 抓取錯誤:', err.message);
  }
}

runCrawler();