import axios from 'axios';
import admin from 'firebase-admin';

// 1. 初始化 Firebase (維持原樣)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function runCrawler() {
  console.log('🚀 [百老匯] 嘗試模擬官網 XHR 請求...');

  try {
    // 💡 根據你提供的 Request URL
    const url = 'https://www.broadway-cineplex.com.tw/News/GetSPNews'; 
    
    // 2. 模擬瀏覽器的 Headers (這是防爬蟲的關鍵)
    const response = await axios.get(url, {
      params: {
        // 如果 API 需要帶時間戳防快取，可以在這裡加，通常不用
        _: Date.now() 
      },
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.broadway-cineplex.com.tw/news.html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest', // 關鍵：告訴伺服器這是非同步請求
      },
      timeout: 15000
    });

    // 取得資料
    const list = Array.isArray(response.data) ? response.data : (response.data.data || []);
    console.log(`📊 API 成功回傳筆數: ${list.length}`);

    // 如果抓到 0 筆，印出原始回應檢查格式
    if (list.length === 0) {
      console.log('⚠️ API 回傳內容為空，原始 Response:', JSON.stringify(response.data));
    }

    // 3. 篩選與格式化
    const officialData = list.filter(item => {
      const title = item.Subject || item.Title || '';
      return title.includes('特典') || title.includes('《') || title.includes('贈');
    }).map(item => ({
      title: item.Subject || item.Title,
      img: item.Poster || item.Image,
      date: item.PostDate || item.Date || '2026-03-23'
    }));

    console.log(`✅ 過濾後符合特典條件: ${officialData.length} 筆`);

    // 4. 同步至 Firebase
    if (officialData.length > 0) {
      const batch = db.batch();
      const currentIds = [];

      officialData.forEach(item => {
        const docId = `broadway_${item.title.replace(/[\/\\#?\[\]]/g, '_')}`;
        currentIds.push(docId);

        const movieTitle = item.title.match(/《(.+?)》/)?.[1] || item.title;
        const finalImg = item.img.startsWith('http') ? item.img : `https://www.broadway-cineplex.com.tw${item.img}`;

        batch.set(db.collection('specials').doc(docId), {
          movieTitle,
          bonusName: item.title,
          cinema: '百老匯',
          image: finalImg,
          startDate: item.date.split('T')[0],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      });

      // 清理舊資料
      const oldDocs = await db.collection('specials').where('cinema', '==', '百老匯').get();
      oldDocs.forEach(doc => {
        if (!currentIds.includes(doc.id)) batch.delete(doc.ref);
      });

      await batch.commit();
      console.log('🎉 Firebase 更新成功！');
    }

  } catch (err) {
    console.error('❌ 請求失敗:', err.message);
    if (err.response) {
      console.error('狀態碼:', err.response.status);
    }
  }
}

runCrawler();