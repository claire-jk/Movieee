import admin from 'firebase-admin';
import puppeteer from 'puppeteer';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function runCrawler() {
  console.log('🚀 開始執行「深度掃描」同步任務...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    // 設定較大的視窗確保所有內容被渲染
    await page.setViewport({ width: 1280, height: 2000 });
    
    // 進入網頁
    await page.goto('https://www.broadway-cineplex.com.tw/news.html', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });

    // 💡 關鍵：等待網頁渲染完成，不指定特定的 class，改等 img 標籤出現
    await page.waitForSelector('img', { timeout: 10000 });

    // 💡 暴力掃描：直接抓取頁面上所有包含圖片的區塊
    const officialData = await page.evaluate(() => {
      const results = [];
      const seenTitles = new Set();
      
      // 掃描所有的 li, div, a 標籤
      const elements = document.querySelectorAll('li, .item, a, div[style*="background-image"]');
      
      elements.forEach(el => {
        const title = el.innerText?.trim().split('\n')[0] || ''; // 抓第一行當標題
        const imgEl = el.querySelector('img');
        const img = imgEl ? imgEl.src : '';
        const dateMatch = el.innerText?.match(/\d{4}-\d{2}-\d{2}/); // 尋找 YYYY-MM-DD 格式
        const date = dateMatch ? dateMatch[0] : '2026-03-23';

        // 判斷邏輯：有標題、有圖片網址、標題包含關鍵字、且沒抓過
        if (
          (title.includes('特典') || title.includes('《') || title.includes('贈')) && 
          img.startsWith('http') && 
          !seenTitles.has(title)
        ) {
          results.push({ title, img, date });
          seenTitles.add(title);
        }
      });
      return results;
    });

    console.log(`📊 掃描結束，實際抓到項目數量: ${officialData.length}`);
    officialData.forEach(item => console.log(`📍 偵測到: ${item.title}`));

    if (officialData.length > 0) {
      const batch = db.batch();
      const currentOfficialIds = [];

      officialData.forEach(item => {
        const docId = item.title.replace(/[\/\\#?\[\]]/g, '_');
        currentOfficialIds.push(docId);

        const movieTitle = item.title.match(/《(.+?)》/)?.[1] || item.title;
        const res = {
          movieTitle: movieTitle,
          bonusName: item.title,
          cinema: '百老匯',
          image: item.img,
          startDate: item.date,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        batch.set(db.collection('specials').doc(docId), res, { merge: true });
      });

      // 💡 同步刪除邏輯：如果資料庫有「百老匯」的資料但官網沒這筆，就刪除
      const allDocs = await db.collection('specials').where('cinema', '==', '百老匯').get();
      allDocs.forEach(doc => {
        if (!currentOfficialIds.includes(doc.id)) {
          console.log(`🗑️ 官網已下架，刪除: ${doc.id}`);
          batch.delete(doc.ref);
        }
      });

      await batch.commit();
      console.log('✅ 同步完成！');
    } else {
      console.log('❌ 警告：依然抓不到任何資料，請檢查網頁是否擋掉爬蟲。');
    }
  } catch (err) {
    console.error('❌ 發生錯誤:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runCrawler();