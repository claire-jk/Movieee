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
import { db } from './firebaseConfig'; // 確保路徑跳兩層回到根目錄

type VersionKey = '2D' | '3D' | 'IMAX' | '4DX';
type TicketType = '全票' | '學生票' | '愛心票';

export default function CinemaScreen() {
  const params = useLocalSearchParams();
  const movie = params.movie ? JSON.parse(params.movie as string) : null;
  const version = (params.version as VersionKey) || '2D';

  // 🎨 使用 Google Fonts 套件 (不再需要 require ttf 檔案)
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
  }, []);

  const prepareData = async () => {
    await getLocation();
    await fetchCinemas();
  };

  const getLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    let loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
  };

    const fetchCinemas = async () => {
    console.log("🔥 開始抓取資料...");
    try {
        const q = query(collection(db, 'cinemas'));
        const querySnapshot = await getDocs(q);
        
        console.log("📊 抓到的文檔數量:", querySnapshot.size);
        
        if (querySnapshot.empty) {
        console.warn("⚠️ Firebase 中 'cinemas' 集合是空的！");
        }

        const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
        }));
        
        console.log("✅ 成功處理資料:", data.length, "筆");
        setCinemas(data);
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
    const b = base || 280;
    if (ticketType === '學生票') return b - 40;
    if (ticketType === '愛心票') return b - 80;
    return b;
  };

  const sortedCinemas = cinemas
    .map((c) => ({
      ...c,
      distance: location && c.lat ? getDistance(location.latitude, location.longitude, c.lat, c.lng) : 999,
    }))
    .sort((a, b) => a.distance - b.distance);

  // 確保字體載入中顯示 Loading
  if (!fontsLoaded || loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      <View style={[styles.headerCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.title, { color: theme.text }]}>🎬 {movie?.title}</Text>
        <Text style={[styles.subtitle, { color: theme.primary }]}>{version} 版本 ｜ 全台戲院</Text>
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
                  📍 {item.city} ｜ {item.distance < 900 ? `${item.distance.toFixed(1)} km` : '定位中'}
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
              {selectedCinema?.showtimes?.map((time: string) => (
                <TouchableOpacity key={time} style={[styles.sessionBtn, { borderColor: theme.primary }]}>
                  <Text style={[styles.sessionText, { color: theme.primary }]}>{time}</Text>
                </TouchableOpacity>
              )) || <Text style={{color: theme.subText, fontFamily: 'ZenKurenaido'}}>暫無今日場次</Text>}
            </View>

            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: isDark ? '#333' : '#F0F0F0' }]} onPress={() => setModalVisible(false)}>
              <Text style={[styles.closeText, { color: isDark ? '#fff' : '#000' }]}>關閉</Text>
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
  title: { fontSize: 22, fontFamily: 'ZenKurenaido', marginBottom: 5 },
  subtitle: { fontSize: 16, fontFamily: 'ZenKurenaido', fontWeight: 'bold' },
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
  modalTitle: { fontSize: 22, fontFamily: 'ZenKurenaido', textAlign: 'center', marginBottom: 20 },
  sessionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  sessionBtn: { width: '28%', paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center', marginBottom: 10 },
  sessionText: { fontSize: 16, fontWeight: 'bold' },
  closeBtn: { marginTop: 25, padding: 16, borderRadius: 15, alignItems: 'center' },
  closeText: { fontSize: 16, fontFamily: 'ZenKurenaido' },
});

