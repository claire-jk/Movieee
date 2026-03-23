import admin from 'firebase-admin';
import puppeteer from 'puppeteer';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function runCrawler() {
  console.log('🚀 開始執行「終極偽裝」同步任務...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled' // 隱藏自動化特徵
    ]
  });
  const page = await browser.newPage();

  // 💡 偽裝成真正的電腦瀏覽器
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

  try {
    await page.setViewport({ width: 1280, height: 2000 });
    
    // 前往網頁並等待網路完全安靜下來
    await page.goto('https://www.broadway-cineplex.com.tw/news.html', { 
      waitUntil: 'networkidle0', // 等待所有資源加載完畢
      timeout: 60000 
    });

    // 額外多等 3 秒，確保 AJAX 內容跑完
    await new Promise(r => setTimeout(r, 3000));

    const officialData = await page.evaluate(() => {
      const results = [];
      const seenTitles = new Set();
      
      // 💡 策略：抓取所有圖片，然後往上找它們的父容器
      const images = document.querySelectorAll('img');
      
      images.forEach(img => {
        const src = img.src;
        if (!src || !src.startsWith('http')) return;

        // 往上找最近的容器 (可能是 li 或 div)
        const container = img.closest('li, .item, .news_list_item, div[class*="item"]');
        if (!container) return;

        const text = container.innerText || '';
        const title = text.split('\n').find(line => line.trim().length > 2) || '';
        const dateMatch = text.match(/\d{4}-\d{2}-\d{2}/);
        const date = dateMatch ? dateMatch[0] : '2026-03-23';

        // 只要包含關鍵字，且標題不重複
        if ((text.includes('特典') || text.includes('《') || text.includes('贈')) && !seenTitles.has(title)) {
          results.push({
            title: title.trim(),
            img: src,
            date: date
          });
          seenTitles.add(title);
        }
      });
      return results;
    });

    console.log(`📊 掃描結束，實際抓到項目數量: ${officialData.length}`);
    
    // 列出所有抓到的標題，方便在 GitHub Actions 日誌檢查
    officialData.forEach((item, index) => {
      console.log(`[${index + 1}] 偵測到: ${item.title}`);
    });

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

      // 同步刪除舊資料
      const allDocs = await db.collection('specials').where('cinema', '==', '百老匯').get();
      allDocs.forEach(doc => {
        if (!currentOfficialIds.includes(doc.id)) {
          console.log(`🗑️ 刪除已下架項目: ${doc.id}`);
          batch.delete(doc.ref);
        }
      });

      await batch.commit();
      console.log('✅ 同步完成！');
    } else {
      // 💡 如果還是 0，把整個網頁的 HTML 印出來 debug (這行很重要)
      const body = await page.evaluate(() => document.body.innerText.substring(0, 500));
      console.log('❌ 依然抓不到資料。網頁開頭內容：', body);
    }
  } catch (err) {
    console.error('❌ 發生錯誤:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runCrawler();