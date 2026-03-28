import admin from 'firebase-admin';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = join(__dirname, 'serviceAccount.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ 找不到金鑰檔案！請確認檔案已放在：${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// 影城底稿清單
const cinemas = [
  { "id": "tp_xinyi", "vieshowId": "1", "name": "台北信義威秀影城", "city": "台北市", "lat": 25.0354, "lng": 121.5671,"數位 2D": 360,"數位 3D": 430,"4DX": 550,"MX4D":620,"LIVE":1450},
  { "id": "tp_qsquare", "vieshowId": "12", "name": "台北京站威秀影城", "city": "台北市", "lat": 25.0494, "lng": 121.5172,"數位 2D": 360,"數位 3D": 420,"LIVE":1450},
  { "id": "tp_ximen", "vieshowId": "116", "name": "台北西門威秀影城", "city": "台北市", "lat": 25.0448, "lng": 121.5069,"數位 2D": 320,"LIVE":1450},
  { "id": "tp_muvie", "vieshowId": "123", "name": "MUVIE CINEMAS 台北松仁", "city": "台北市", "lat": 25.0357, "lng": 121.5685,"數位 2D": 370,"數位 3D": 450,"4DX": 550,"LIVE":1450},
  { "id": "tp_lalaport", "vieshowId": "141", "name": "台北南港LaLaport威秀影城", "city": "台北市", "lat": 25.0558, "lng": 121.6163,"數位 2D": 360,"LIVE":1450 },
  { "id": "ntp_banqiao", "vieshowId": "26", "name": "板橋大遠百威秀影城", "city": "新北市", "lat": 25.0134, "lng": 121.4650,"數位 2D": 350,"數位 3D": 410,"IMAX": 510,"LIVE":1450},
  { "id": "ntp_zhonghe", "vieshowId": "129", "name": "中和環球威秀影城", "city": "新北市", "lat": 25.0016, "lng": 121.4746,"數位 2D": 330,"數位 3D": 400},
  { "id": "ntp_linkou", "vieshowId": "65", "name": "林口MITSUI OUTLET PARK威秀影城", "city": "新北市", "lat": 25.0701, "lng": 121.3621,"數位 2D": 320,"數位 3D": 390,"4DX": 520,"MX4D":590,"LIVE":1450 },
  { "id": "ntp_xindian", "vieshowId": "139", "name": "新店裕隆城威秀影城", "city": "新北市", "lat": 24.9781, "lng": 121.5452,"數位 2D": 340,"數位 3D": 410,"IMAX": 450,"LIVE":1450 },
  { "id": "ty_tonlin", "vieshowId": "84", "name": "桃園統領威秀影城", "city": "桃園市", "lat": 24.9920, "lng": 121.3120,"數位 2D": 330,"數位 3D": 400,"LIVE":1450 },
  { "id": "ty_taozhidao", "vieshowId": "144", "name": "桃園桃知道威秀影城", "city": "桃園市", "lat": 25.0159, "lng": 121.3005,"數位 2D": 330,"數位 3D": 400 },
  { "id": "hc_feba", "vieshowId": "36", "name": "新竹大遠百威秀影城", "city": "新竹市", "lat": 24.8016, "lng": 120.9642,"數位 2D": 330,"數位 3D": 400,"4DX": 530,"IMAX": 530,"MX4D":600,"LIVE":1450 },
  { "id": "hc_bigcity", "vieshowId": "39", "name": "新竹巨城威秀影城", "city": "新竹市", "lat": 24.8105, "lng": 120.9752,"數位 2D": 340,"數位 3D": 410,"4DX": 420,"IMAX": 420,"MX4D":480,"LIVE":1450 },
  { "id": "tc_feba", "vieshowId": "32", "name": "台中大遠百威秀影城", "city": "台中市", "lat": 24.1645, "lng": 120.6438,"數位 2D": 330,"數位 3D": 390,"4DX": 400,"IMAX": 400,"MX4D":460,"LIVE":1450 },
  { "id": "tc_tiger", "vieshowId": "30", "name": "台中 Tiger City 威秀影城", "city": "台中市", "lat": 24.1627, "lng": 120.6366 ,"數位 2D": 330,"數位 3D": 390,"4DX": 400,"IMAX": 400,"MX4D":460,"LIVE":1450},
  { "id": "tc_taroko", "vieshowId": "115", "name": "台中大魯閣新時代威秀影城", "city": "台中市", "lat": 24.1362, "lng": 120.6872,"數位 2D": 330,"數位 3D": 390,"4DX": 340,"IMAX": 340,"LIVE":1450 },
  { "id": "tn_feba", "vieshowId": "43", "name": "台南大遠百威秀影城", "city": "台南市", "lat": 22.9961, "lng": 120.2096,"數位 2D": 300,"數位 3D": 360,"4DX": 500,"IMAX": 500,"MX4D":560 ,"LIVE":1450},
  { "id": "tn_focus", "vieshowId": "126", "name": "台南 FOCUS 威秀影城", "city": "台南市", "lat": 22.9966, "lng": 120.2089,"數位 2D": 300,"數位 3D": 360 },
  { "id": "tn_tsmall", "vieshowId": "60", "name": "台南南紡威秀影城", "city": "台南市", "lat": 22.9904, "lng": 120.2335,"數位 2D": 320,"數位 3D": 380,"4DX": 390,"IMAX": 390,"MX4D":450,"LIVE":1450 },
  { "id": "kh_feba", "vieshowId": "48", "name": "高雄大遠百威秀影城", "city": "高雄市", "lat": 22.6141, "lng": 120.3045,"數位 2D": 320,"數位 3D": 380,"4DX": 390,"IMAX": 430,"MX4D":580,"LIVE":1450 },
  { "id": "hl_paradisio", "vieshowId": "105", "name": "花蓮新天堂樂園威秀影城", "city": "花蓮縣", "lat": 23.9317, "lng": 121.5976,"數位 2D": 290,"數位 3D": 340,"4DX": 380,"IMAX": 380 },
  { "id": "st_keelung", "showtimesId": "1002", "name": "基隆秀泰影城", "city": "基隆市", "lat": 25.1311, "lng": 121.7445,"數位 2D": 400,"4DX": 610,"IMAX": 530,"ScreenX":520,"Dolby Cinema":500,"LIVE":1450 },
  { "id": "st_today", "showtimesId": "1004", "name": "台北欣欣秀泰影城", "city": "台北市", "lat": 25.0531, "lng": 121.5262,"數位 2D": 330,"4DX": 610,"ScreenX":430,"LIVE":1450 },
  { "id": "st_dome", "showtimesId": "1085", "name": "台北大巨蛋秀泰影城", "city": "台北市", "lat": 25.0441, "lng": 121.5606,"數位 2D": 400,"4DX": 610,"IMAX": 530,"ScreenX":520,"Dolby Cinema":500,"LIVE":1450 },
  { "id": "st_shulin", "showtimesId": "1069", "name": "樹林秀泰影城", "city": "新北市", "lat": 24.9918, "lng": 121.4251,"數位 2D": 330,"4DX": 610,"IMAX": 400,"ScreenX":430,"LIVE":1450  },
  { "id": "st_tucheng", "showtimesId": "1071", "name": "土城秀泰影城", "city": "新北市", "lat": 24.9821, "lng": 121.4468,"數位 2D": 330,"4DX": 610,"IMAX": 530,"ScreenX":450,"LIVE":1450  },
  { "id": "st_taichung_station", "showtimesId": "1054", "name": "台中站前秀泰影城", "city": "台中市", "lat": 24.1415, "lng": 120.6903,"數位 2D": 340,"IMAX": 410,"ScreenX":460,"LIVE":1450 },
  { "id": "st_wenxin", "showtimesId": "1067", "name": "台中文心秀泰影城", "city": "台中市", "lat": 24.1237, "lng": 120.6416,"數位 2D": 340,"IMAX": 410,"ScreenX":460,"LIVE":1450 },
  { "id": "st_lihpaio", "showtimesId": "1076", "name": "台中麗寶秀泰影城", "city": "台中市", "lat": 24.3312, "lng": 120.6981,"數位 2D": 340,"LIVE":1450 },
  { "id": "st_beigang", "showtimesId": "1078", "name": "雲林北港秀泰影城", "city": "雲林縣", "lat": 23.5702, "lng": 120.2981,"數位 2D": 310,"LIVE":1450 },
  { "id": "st_chiayi", "showtimesId": "1034", "name": "嘉義秀泰影城", "city": "嘉義市", "lat": 23.4862, "lng": 120.4476,"數位 2D": 310,"IMAX": 380,"ScreenX":420,"LIVE":1450  },
  { "id": "st_rende", "showtimesId": "1079", "name": "台南仁德秀泰影城", "city": "台南市", "lat": 22.9515, "lng": 120.2223,"數位 2D": 310,"LIVE":1450  },
  { "id": "st_gangshan", "showtimesId": "1081", "name": "高雄岡山秀泰影城", "city": "高雄市", "lat": 22.7845, "lng": 120.2965,"數位 2D": 330,"IMAX": 400,"ScreenX":450,"LIVE":1450 },
  { "id": "st_dream_mall", "showtimesId": "1083", "name": "高雄夢時代秀泰影城", "city": "高雄市", "lat": 22.5951, "lng": 120.3069,"數位 2D": 330,"IMAX": 370,"ScreenX":430,"LIVE":1450 },
  { "id": "st_hualien", "showtimesId": "1074", "name": "花蓮秀泰影城", "city": "花蓮縣", "lat": 23.9881, "lng": 121.6072,"數位 2D": 310,"LIVE":1450  },
  { "id": "st_taitung", "showtimesId": "1029", "name": "台東秀泰影城", "city": "台東縣", "lat": 22.7523, "lng": 121.1481,"數位 2D": 310,"LIVE":1450  },
  { "id": "broadway_taipei", "name": "百老匯公館店", "city": "台北市", "lat": 25.0145, "lng": 121.5364,"數位 2D": 250,"數位 3D": 400,"IMAX": 330,"LIVE":1450 },
  { "id": "broadway_zhubei", "name": "百老匯竹北店", "city": "新竹縣", "lat": 24.8035, "lng": 120.9680,"數位 2D": 300,"數位 3D": 400,"IMAX": 330,"LIVE":1450 },
  { "id": "miramar_dazhi", "name": "美麗華大直影城", "city": "台北市", "lat": 25.0837, "lng": 121.5577,"數位 2D": 350,"數位 3D": 410,"4DX": 610,"IMAX": 490,"Dolby Cinema":460,"LIVE":1450  }
];

async function uploadAndCleanupData() {
  const collectionRef = db.collection('cinemas');
  console.log("📤 開始同步影城底稿並清理舊格式...");

  for (const cinema of cinemas) {
    try {
      let brand = 'unknown';
      if (cinema.id.startsWith('st_')) {
        brand = 'showtimes';
      } else if (cinema.id.startsWith('broadway_')) {
        brand = 'broadway';
      } else if (cinema.id.startsWith('miramar_')) {
        brand = 'miramar';
      } else {
        brand = 'vieshow';
      }

      await collectionRef.doc(cinema.id).set({
        name: cinema.name,
        city: cinema.city || "未知城市",
        location: {
          lat: cinema.lat,
          lng: cinema.lng
        },
        price:{
          "數位 2D":cinema["數位 2D"] || null,
          "數位 3D":cinema["數位 3D"] || null,
          "4DX":cinema["4DX"] || null,
          "IMAX":cinema["IMAX"] || null,
          "MX4D":cinema["MX4D"] || null,
          "ScreenX":cinema["ScreenX"] || null,
          "Dolby Cinema":cinema["Dolby Cinema"] || null,
          "LIVE":cinema["LIVE"] || null
        },

        lat: admin.firestore.FieldValue.delete(),
        lng: admin.firestore.FieldValue.delete(),
        
        internalId: cinema.vieshowId || cinema.showtimesId || "", 
        brand: brand, 
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true }); 
      
      console.log(`✅ 已修正: ${cinema.name} (${brand})`);
    } catch (error) {
      console.error(`❌ 失敗: ${cinema.name}`, error);
    }
  }

  console.log("\n🏁 結構轉換與清理全部完成！");
  process.exit();
}

uploadAndCleanupData();