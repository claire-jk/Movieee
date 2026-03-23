import admin from 'firebase-admin';
import { createRequire } from 'module';
import puppeteer from 'puppeteer';

const require = createRequire(import.meta.url);
const serviceAccount = require('./serviceAccount.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function runCrawler() {
  console.log('------------------------------------');
  console.log('🎯 [目標] 百老匯影城卡片式佈局抓取');
  console.log('------------------------------------');

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  try {
    await page.goto('https://www.broadway-cineplex.com.tw/news.html', { 
      waitUntil: 'networkidle2' 
    });

    // 💡 根據截圖結構：抓取包含標題與圖片的卡片區塊
    const data = await page.evaluate(() => {
      // 假設卡片容器是 news_item 或類似的 div
      // 我們抓取所有包含「特典」字眼的區塊
      const cards = Array.from(document.querySelectorAll('div, li')).filter(el => 
        el.innerText && el.innerText.includes('特典')
      );

      return cards.map(card => {
        // 標題通常在 h4 或特定的 p 標籤中
        const titleEl = card.querySelector('h4, p, .title');
        const imgEl = card.querySelector('img');
        const dateEl = card.querySelector('.date, span'); // 截圖下方有日期

        return {
          title: titleEl ? titleEl.innerText.trim() : '',
          image: imgEl ? imgEl.src : '',
          date: dateEl ? dateEl.innerText.trim() : ''
        };
      }).filter(item => item.title.includes('特典') && item.image !== '');
    });

    console.log(`📊 成功偵測到 ${data.length} 個特典卡片`);

    const results = data.map(item => ({
      movieTitle: item.title.match(/《(.+?)》/)?.[1] || item.title,
      bonusName: item.title,
      cinema: '百老匯',
      image: item.image,
      startDate: item.date, // 截圖中的日期如 2026-03-18
      createdAt: new Date().toISOString()
    }));

    if (results.length > 0) {
      const batch = db.batch();
      results.forEach(res => {
        const id = res.bonusName.replace(/[\/\\#?\[\]]/g, '_');
        batch.set(db.collection('specials').doc(id), res, { merge: true });
      });
      await batch.commit();
      console.log('🎉 [大功告成] 百老匯特典已更新至 Firebase！');
    }

  } catch (err) {
    console.error('❌ 抓取失敗:', err.message);
  } finally {
    await browser.close();
    process.exit();
  }
}

runCrawler();