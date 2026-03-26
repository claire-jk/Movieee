//上傳cinemas及其lat lng
import admin from 'firebase-admin';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// 獲取當前檔案目錄
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 使用絕對路徑讀取金鑰，避免找不到檔案
const serviceAccountPath = join(__dirname, 'serviceAccount.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ 找不到金鑰檔案！請確認檔案已放在：${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const cinemas = [
  { "id": "tp_xinyi", "vieshowId": "1", "name": "台北信義威秀影城", "city": "台北市", "lat": 25.0354, "lng": 121.5671 },
  { "id": "tp_qsquare", "vieshowId": "12", "name": "台北京站威秀影城", "city": "台北市", "lat": 25.0494, "lng": 121.5172 },
  { "id": "tp_ximen", "vieshowId": "116", "name": "台北西門威秀影城", "city": "台北市", "lat": 25.0448, "lng": 121.5069 },
  { "id": "tp_muvie", "vieshowId": "123", "name": "MUVIE CINEMAS 台北松仁", "city": "台北市", "lat": 25.0357, "lng": 121.5685 },
  { "id": "tp_lalaport", "vieshowId": "141", "name": "台北南港LaLaport威秀影城", "city": "台北市", "lat": 25.0558, "lng": 121.6163 },
  { "id": "ntp_banqiao", "vieshowId": "26", "name": "板橋大遠百威秀影城", "city": "新北市", "lat": 25.0134, "lng": 121.4650 },
  { "id": "ntp_zhonghe", "vieshowId": "129", "name": "中和環球威秀影城", "city": "新北市", "lat": 25.0016, "lng": 121.4746 },
  { "id": "ntp_linkou", "vieshowId": "65", "name": "林口MITSUI OUTLET PARK威秀影城", "city": "新北市", "lat": 25.0701, "lng": 121.3621 },
  { "id": "ntp_xindian", "vieshowId": "139", "name": "新店裕隆城威秀影城", "city": "新北市", "lat": 24.9781, "lng": 121.5452 },
  { "id": "ty_tonlin", "vieshowId": "84", "name": "桃園統領威秀影城", "city": "桃園市", "lat": 24.9920, "lng": 121.3120 },
  { "id": "ty_taozhidao", "vieshowId": "144", "name": "桃園桃知道威秀影城", "city": "桃園市", "lat": 25.0159, "lng": 121.3005 },
  { "id": "hc_feba", "vieshowId": "36", "name": "新竹大遠百威秀影城", "city": "新竹市", "lat": 24.8016, "lng": 120.9642 },
  { "id": "hc_bigcity", "vieshowId": "39", "name": "新竹巨城威秀影城", "city": "新竹市", "lat": 24.8105, "lng": 120.9752 },
  { "id": "tc_feba", "vieshowId": "32", "name": "台中大遠百威秀影城", "city": "台中市", "lat": 24.1645, "lng": 120.6438 },
  { "id": "tc_tiger", "vieshowId": "30", "name": "台中 Tiger City 威秀影城", "city": "台中市", "lat": 24.1627, "lng": 120.6366 },
  { "id": "tc_taroko", "vieshowId": "115", "name": "台中大魯閣新時代威秀影城", "city": "台中市", "lat": 24.1362, "lng": 120.6872 },
  { "id": "tn_feba", "vieshowId": "43", "name": "台南大遠百威秀影城", "city": "台南市", "lat": 22.9961, "lng": 120.2096 },
  { "id": "tn_focus", "vieshowId": "126", "name": "台南 FOCUS 威秀影城", "city": "台南市", "lat": 22.9966, "lng": 120.2089 },
  { "id": "tn_tsmall", "vieshowId": "60", "name": "台南南紡威秀影城", "city": "台南市", "lat": 22.9904, "lng": 120.2335 },
  { "id": "kh_feba", "vieshowId": "48", "name": "高雄大遠百威秀影城", "city": "高雄市", "lat": 22.6141, "lng": 120.3045 },
  { "id": "hl_paradisio", "vieshowId": "105", "name": "花蓮新天堂樂園威秀影城", "city": "花蓮縣", "lat": 23.9317, "lng": 121.5976 },
  { "id": "st_keelung", "showtimesId": "1002", "name": "基隆秀泰影城", "city": "基隆市", "lat": 25.1311, "lng": 121.7445 },
  { "id": "st_today", "showtimesId": "1004", "name": "台北欣欣秀泰影城", "city": "台北市", "lat": 25.0531, "lng": 121.5262 },
  { "id": "st_dome", "showtimesId": "1085", "name": "台北大巨蛋秀泰影城", "city": "台北市", "lat": 25.0441, "lng": 121.5606 },
  { "id": "st_shulin", "showtimesId": "1069", "name": "樹林秀泰影城", "city": "新北市", "lat": 24.9918, "lng": 121.4251 },
  { "id": "st_tucheng", "showtimesId": "1071", "name": "土城秀泰影城", "city": "新北市", "lat": 24.9821, "lng": 121.4468 },
  { "id": "st_taichung_station", "showtimesId": "1054", "name": "台中站前秀泰影城", "city": "台中市", "lat": 24.1415, "lng": 120.6903 },
  { "id": "st_wenxin", "showtimesId": "1067", "name": "台中文心秀泰影城", "city": "台中市", "lat": 24.1237, "lng": 120.6416 },
  { "id": "st_lihpaio", "showtimesId": "1076", "name": "台中麗寶秀泰影城", "city": "台中市", "lat": 24.3312, "lng": 120.6981 },
  { "id": "st_beigang", "showtimesId": "1078", "name": "雲林北港秀泰影城", "city": "雲林縣", "lat": 23.5702, "lng": 120.2981 },
  { "id": "st_chiayi", "showtimesId": "1034", "name": "嘉義秀泰影城", "city": "嘉義市", "lat": 23.4862, "lng": 120.4476 },
  { "id": "st_rende", "showtimesId": "1079", "name": "台南仁德秀泰影城", "city": "台南市", "lat": 22.9515, "lng": 120.2223 },
  { "id": "st_gangshan", "showtimesId": "1081", "name": "高雄岡山秀泰影城", "city": "高雄市", "lat": 22.7845, "lng": 120.2965 },
  { "id": "st_dream_mall", "showtimesId": "1083", "name": "高雄夢時代秀泰影城", "city": "高雄市", "lat": 22.5951, "lng": 120.3069 },
  { "id": "st_hualien", "showtimesId": "1074", "name": "花蓮秀泰影城", "city": "花蓮縣", "lat": 23.9881, "lng": 121.6072 },
  { "id": "st_taitung", "showtimesId": "1029", "name": "台東秀泰影城", "city": "台東縣", "lat": 22.7523, "lng": 121.1481 },
{ "id": "broadway_taipei", "name": "百老匯公館店", "city": "台北市", "lat": 25.0145, "lng": 121.5364 },
  { "id": "broadway_zhubei", "name": "百老匯竹北店", "city": "新竹縣", "lat": 24.8035, "lng": 120.9680 }
];

async function uploadData() {
  const collectionRef = db.collection('cinemas');
  console.log("📤 開始上傳影城底稿...");

  for (const cinema of cinemas) {
    try {
      // 更加精確的品牌標註邏輯
      let brand = 'unknown';
      if (cinema.vieshowId || cinema.id.includes('tp') || cinema.id.includes('ntp')) {
        brand = 'vieshow';
      } else if (cinema.showtimesId) {
        brand = 'showtimes';
      } else if (cinema.id.startsWith('broadway')) {
        brand = 'broadway';
      }

      await collectionRef.doc(cinema.id).set({
        name: cinema.name,
        city: cinema.city || "未知城市", // 防止城市漏填導致崩潰
        lat: cinema.lat,
        lng: cinema.lng,
        internalId: cinema.vieshowId || cinema.showtimesId || "", 
        brand: brand, 
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true }); // 使用 merge 避免覆蓋掉現有欄位
      
      console.log(`✅ 已新增: ${cinema.name} (${brand})`);
    } catch (error) {
      console.error(`❌ 失敗: ${cinema.name}`, error);
    }
  }

  console.log("🏁 全部完成！現在去 Firebase 看看吧。");
  process.exit();
}

uploadData();