import { useFonts, ZenKurenaido_400Regular } from '@expo-google-fonts/zen-kurenaido';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

// --- 引入 Firebase ---
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from './firebaseConfig';

type VersionKey = '2D' | '3D' | 'IMAX' | '4DX';
type TicketType = '全票' | '學生票' | '愛心票';

export default function CinemaScreen() {
  const params = useLocalSearchParams();
  
  // 🚩 修正接收邏輯：優先從 movieTitle 抓取，若無則嘗試解析 movie 物件
  const movieTitle = params.movieTitle as string || (params.movie ? JSON.parse(params.movie as string).title : "");
  const version = (params.version as VersionKey) || '2D';

  const [fontsLoaded] = useFonts({
    ZenKurenaido: ZenKurenaido_400Regular,
  });

  const [cinemas, setCinemas] = useState<any[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [ticketType, setTicketType] = useState<TicketType>('全票');
  const [selectedCinema, setSelectedCinema] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme = {
    bg: isDark ? '#121212' : '#F5F5F7',
    card: isDark ? '#1E1E1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1D1D1F',
    subText: isDark ? '#AAAAAA' : '#86868B',
    primary: '#FF4081',
    border: isDark ? '#333333' : '#E5E5E5',
  };

  useEffect(() => {
    prepareData();
  }, [movieTitle]); // 當標題變更時重新抓取

  const prepareData = async () => {
    await getLocation();
    await fetchCinemas();
  };

  const getLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    } catch (e) {
      console.warn("無法取得位置資訊");
    }
  };

  const fetchCinemas = async () => {
    console.log(`🔥 開始抓取資料，搜尋目標：[${movieTitle}]`);
    if (!movieTitle) {
      console.warn("⚠️ 警告：沒有接收到電影標題參數！");
      setLoading(false);
      return;
    }

    try {
      // 1. 抓取戲院基本資訊 (包含經緯度)
      const qCinema = query(collection(db, 'cinemas'));
      const cinemaSnap = await getDocs(qCinema);
      const cinemaInfoMap = cinemaSnap.docs.reduce((acc, doc) => {
        acc[doc.id] = doc.data();
        return acc;
      }, {} as any);

      // 2. 抓取爬蟲存入的即時場次 (realtime_showtimes)
      const qShowtimes = query(collection(db, 'realtime_showtimes'));
      const showtimeSnap = await getDocs(qShowtimes);
      
      const searchTitleClean = movieTitle.replace(/\s/g, '').toLowerCase();

const combinedData = showtimeSnap.docs.map(doc => {
    const showData = doc.data();
    const cinemaBase = cinemaInfoMap[doc.id] || {};
    
    const currentMovieData = showData.movies?.find((m: any) => {
      if (!m?.title || !movieTitle) return false;

      // 🚩 進階清洗：移除括號內的文字 (例如移除 (3D 數位 英) 和 (普遍級))
      const cleanCrawlTitle = m.title.replace(/\s/g, '').replace(/\([^)]*\)/g, '').toLowerCase();
      const cleanTargetTitle = movieTitle.replace(/\s/g, '').replace(/\([^)]*\)/g, '').toLowerCase();

      return cleanCrawlTitle.includes(cleanTargetTitle) || cleanTargetTitle.includes(cleanCrawlTitle);
    });

    return {
      id: doc.id,
      ...cinemaBase,
      name: showData.cinemaName || cinemaBase.name || "未知影城",
      currentShowtimes: currentMovieData ? currentMovieData.times : [],
    };
  }).filter(c => c.currentShowtimes.length > 0);

      console.log(`✅ 匹配成功，共 ${combinedData.length} 間戲院有場次`);
      setCinemas(combinedData);

    } catch (error) {
      console.error("❌ Firebase 讀取失敗:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const getPrice = (base: number) => {
    const b = base || 290; // 預設票價
    if (ticketType === '學生票') return b - 20;
    if (ticketType === '愛心票') return Math.floor(b / 2);
    return b;
  };

  const sortedCinemas = cinemas
    .map((c) => ({
      ...c,
      distance: location && c.lat ? getDistance(location.latitude, location.longitude, c.lat, c.lng) : 999,
    }))
    .sort((a, b) => a.distance - b.distance);

  if (!fontsLoaded || loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ marginTop: 10, color: theme.subText, fontFamily: 'ZenKurenaido' }}>讀取時刻表中...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      <View style={[styles.headerCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.title, { color: theme.text }]}>🎬 {movieTitle}</Text>
        <Text style={[styles.subtitle, { color: theme.primary }]}>{version} 版本 ｜ 附近戲院</Text>
      </View>

      <View style={styles.tabRow}>
        {(['全票', '學生票', '愛心票'] as TicketType[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tag, { borderColor: theme.border }, ticketType === t && { backgroundColor: theme.primary, borderColor: theme.primary }]}
            onPress={() => setTicketType(t)}
          >
            <Text style={[styles.tagText, { color: ticketType === t ? '#fff' : theme.text }]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={sortedCinemas}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={{ color: theme.subText, fontFamily: 'ZenKurenaido', marginTop: 50 }}>
              目前選取的地區暫無此電影場次
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => {
              setSelectedCinema(item);
              setModalVisible(true);
            }}
          >
            <View style={styles.cardMain}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cinemaName, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.info, { color: theme.subText }]}>
                  📍 {item.city} ｜ {item.distance < 500 ? `${item.distance.toFixed(1)} km` : '計算中'}
                </Text>
              </View>
              <Text style={styles.priceText}>
                ${getPrice(item.prices?.[version])}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{flex: 1}} onPress={() => setModalVisible(false)} />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>{selectedCinema?.name}</Text>
            
            <View style={styles.sessionGrid}>
              {selectedCinema?.currentShowtimes?.map((time: string) => (
                <TouchableOpacity key={time} style={[styles.sessionBtn, { borderColor: theme.primary }]}>
                  <Text style={[styles.sessionText, { color: theme.primary }]}>{time}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: isDark ? '#333' : '#F0F0F0' }]} onPress={() => setModalVisible(false)}>
              <Text style={[styles.closeText, { color: isDark ? '#fff' : '#000' }]}>返回</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerCard: { padding: 20, borderRadius: 20, marginBottom: 20, elevation: 2 },
  title: { fontSize: 20, fontFamily: 'ZenKurenaido', marginBottom: 5 },
  subtitle: { fontSize: 14, fontFamily: 'ZenKurenaido', fontWeight: 'bold' },
  tabRow: { flexDirection: 'row', marginBottom: 20, gap: 10 },
  tag: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  tagText: { fontFamily: 'ZenKurenaido', fontSize: 14 },
  card: { padding: 20, borderRadius: 18, marginBottom: 15, borderWidth: 1 },
  cardMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cinemaName: { fontSize: 18, fontFamily: 'ZenKurenaido', marginBottom: 4 },
  info: { fontSize: 13, fontFamily: 'ZenKurenaido' },
  priceText: { fontSize: 20, color: '#FF4081', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30, minHeight: 350 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 20, fontFamily: 'ZenKurenaido', textAlign: 'center', marginBottom: 20 },
  sessionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  sessionBtn: { width: '28%', paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center', marginBottom: 10 },
  sessionText: { fontSize: 16, fontWeight: 'bold' },
  closeBtn: { marginTop: 25, padding: 16, borderRadius: 15, alignItems: 'center' },
  closeText: { fontSize: 16, fontFamily: 'ZenKurenaido' },
});