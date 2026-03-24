// view.js
import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccount.json', 'utf8'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function showResults() {
    const snapshot = await db.collection('realtime_showtimes').get();
    if (snapshot.empty) {
        console.log('📭 資料庫還是空的，再給威秀一點時間睡覺。');
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`\n🎬 影城：${data.cinemaName} (${data.showDate})`);
        data.movies.forEach(m => {
            console.log(`   🎥 ${m.title} | 時刻：${m.times.join(', ')}`);
        });
    });
}

showResults();