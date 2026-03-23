import express from 'express';
import admin from 'firebase-admin';
import fs from 'fs';
import fetch from 'node-fetch';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// ===== 1. Firebase 初始化 =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serviceAccountPath = join(__dirname, 'serviceAccount.json');

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// ===== 2. 威秀影城代碼 =====
const cinemas = [
    { id: "tp_xinyi", name: "台北信義威秀影城", code: "TP" },
    { id: "tp_qsquare", name: "台北京站威秀影城", code: "QS" },
    { id: "tp_ximen", name: "台北西門威秀影城", code: "XM" },
    { id: "tp_muvie", name: "MUVIE CINEMAS 台北松仁", code: "MU" },
    { id: "ntp_banqiao", name: "板橋大遠百威秀影城", code: "BC" }
];

// ===== 3. 解析 API =====
function parseShowtimes(text) {
    if (!text) return [];

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    const results = [];
    let currentMovie = null;

    lines.forEach(line => {
        const isTime = /^\d{2}:\d{2}$/.test(line);
        const isFormat = ["2D", "3D", "IMAX", "GOLD CLASS"].includes(line);

        if (!isTime && !isFormat) {
            currentMovie = {
                title: line,
                showtimes: []
            };
            results.push(currentMovie);
        }

        if (isTime && currentMovie) {
            currentMovie.showtimes.push({
                time: line
            });
        }
    });

    return results.filter(m => m.showtimes.length > 0);
}

// ===== 4. 抓單一影城（直接打 API）=====
async function fetchCinema(cinema) {
    try {
        console.log(`\n🌐 抓取: ${cinema.name}`);

        const res = await fetch('https://www.vscinemas.com.tw/ShowTimes/GetShowTimes/', {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
            },
            body: `CinemaCode=${cinema.code}`
        });

        const text = await res.text();

        console.log("📦 API片段:", text.slice(0, 100));

        const movies = parseShowtimes(text);

        console.log(`🎬 抓到 ${movies.length} 部電影`);

        if (movies.length === 0) {
            return { success: false };
        }

        // ===== 存 Firestore =====
        await db.collection('cinemas').doc(cinema.id).set({
            cinemaId: cinema.id,
            cinemaName: cinema.name,
            movieCount: movies.length,
            movies,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            success: true,
            count: movies.length,
            movies
        };

    } catch (err) {
        console.error(`❌ ${cinema.name} 失敗:`, err.message);
        return { success: false, error: err.message };
    }
}

// ===== 5. 更新全部影城 =====
async function updateAllCinemas() {
    const results = [];

    for (const cinema of cinemas) {
        const result = await fetchCinema(cinema);
        results.push({
            cinema: cinema.name,
            success: result.success,
            count: result.count || 0
        });
    }

    return results;
}

// ===== 6. API Server =====
const app = express();

// 查全部影城
app.get('/api/cinemas', async (req, res) => {
    const snapshot = await db.collection('cinemas').get();
    const data = snapshot.docs.map(doc => doc.data());

    res.json(data);
});

// 查單一影城
app.get('/api/cinema/:id', async (req, res) => {
    const doc = await db.collection('cinemas').doc(req.params.id).get();

    if (!doc.exists) {
        return res.json({ success: false });
    }

    res.json({
        success: true,
        data: doc.data()
    });
});

// 手動更新資料
app.get('/api/update', async (req, res) => {
    const result = await updateAllCinemas();
    res.json(result);
});

// ===== 7. 啟動 =====
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`🚀 API 伺服器啟動: http://localhost:${PORT}`);
});