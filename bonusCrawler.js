import admin from 'firebase-admin';
import puppeteer from 'puppeteer';

// 💡 改從環境變數讀取憑證，增加安全性
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function runCrawler() {
  console.log('🚀 開始執行每週百老匯特典抓取任務...');

  // 💡 GitHub Actions 必須加上這些 args 才能順利啟動瀏覽器
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // 進入網頁並等待內容載入
    await page.goto('https://www.broadway-cineplex.com.tw/news.html', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });

    // 抓取特典資料
    const data = await page.evaluate(() => {
      // 百老匯的結構通常是 .news_list 裡面的 .item 或 li
      // 這裡採用更精準的選擇器嘗試抓取
      const items = Array.from(document.querySelectorAll('.news_list li, .item, li'));
      
      return items.map(el => {
        const title = el.querySelector('h4, p, .title')?.innerText.trim() || '';
        const img = el.querySelector('img')?.src || '';
        const date = el.querySelector('.date, span')?.innerText.trim() || '';
        return { title, img, date };
      }).filter(item => item.title.includes('特典') && item.img !== '');
    });

    console.log(`📊 找到 ${data.length} 個相關特典`);

    if (data.length > 0) {
      const batch = db.batch();
      
      data.forEach(item => {
        const movieTitle = item.title.match(/《(.+?)》/)?.[1] || item.title;
        const res = {
          movieTitle: movieTitle,
          bonusName: item.title,
          cinema: '百老匯',
          image: item.img,
          startDate: item.date,
          createdAt: new Date().toISOString()
          // 💡 注意：這裡不重置 status，使用 merge: true 就不會覆蓋掉使用者的回報
        };

        // 使用標題作為 ID 避免重複建立
        const docId = item.title.replace(/[\/\\#?\[\]]/g, '_');
        const docRef = db.collection('specials').doc(docId);
        batch.set(docRef, res, { merge: true });
      });

      await batch.commit();
      console.log('✅ Firebase 資料更新成功！');
    }
  } catch (err) {
    console.error('❌ 抓取過程發生錯誤:', err);
    process.exit(1); // 讓 GitHub Action 顯示失敗
  } finally {
    await browser.close();
  }
}

runCrawler();