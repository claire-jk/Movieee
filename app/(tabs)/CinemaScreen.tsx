import { useFonts, ZenKurenaido_400Regular } from '@expo-google-fonts/zen-kurenaido';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

// --- Firebase ---
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from './firebaseConfig';

const { width, height } = Dimensions.get('window');

type VersionKey = '2D' | '3D' | 'IMAX' | '4DX';
type TicketType = '全票' | '學生票' | '愛心票';

export default function CinemaScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  
  const movieTitle = params.movieTitle as string || "";
  const versionParam = (params.version as string) || '2D';

  const [fontsLoaded] = useFonts({ ZenKurenaido: ZenKurenaido_400Regular });

  const [cinemas, setCinemas] = useState<any[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [ticketType, setTicketType] = useState<TicketType>('全票');
  const [selectedCinema, setSelectedCinema] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme = {
    bg: isDark ? '#0A0A0B' : '#F0F2F5',
    card: isDark ? '#1A1A1C' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1C1C1E',
    subText: isDark ? '#A0A0A5' : '#636366',
    primary: isDark ? '#D0BCFF' : '#6750A4', // 柔和的發光色
    border: isDark ? '#333335' : '#E5E5EA',
    accent: '#FF2D55',
    glow: isDark ? 'rgba(208, 188, 255, 0.3)' : 'rgba(103, 80, 164, 0.15)', // 發光陰影色
  };

  useEffect(() => {
    prepareData();
  }, [movieTitle, versionParam]);

  const prepareData = async () => {
    setLoading(true);
    await getLocation();
    await fetchCinemas();
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCinemas();
    setRefreshing(false);
  }, [movieTitle, versionParam]);

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
    const searchVersion = versionParam === '2D' ? '數位' : versionParam;
    if (!movieTitle) return;

    try {
      const qCinema = query(collection(db, 'cinemas'));
      const cinemaSnap = await getDocs(qCinema);
      const cinemaInfoMap = cinemaSnap.docs.reduce((acc, doc) => {
        acc[doc.id] = doc.data();
        return acc;
      }, {} as any);

      const qShowtimes = query(collection(db, 'realtime_showtimes'));
      const showtimeSnap = await getDocs(qShowtimes);
      
      const combinedData = showtimeSnap.docs.map(doc => {
        const showData = doc.data();
        const cinemaBase = cinemaInfoMap[doc.id] || {};
        const movieInCinema = showData.movies?.find((m: any) => {
          if (!m?.title) return false;
          const cleanCrawlTitle = m.title.replace(/\s/g, '').toLowerCase();
          const cleanTargetTitle = movieTitle.replace(/\s/g, '').toLowerCase();
          return cleanCrawlTitle.includes(cleanTargetTitle) || cleanTargetTitle.includes(cleanCrawlTitle);
        });

        let filteredTimes: string[] = [];
        if (movieInCinema && movieInCinema.showtimes) {
          filteredTimes = movieInCinema.showtimes
            .filter((s: any) => s.ver.includes(searchVersion))
            .map((s: any) => s.time);
        }

        return {
          id: doc.id,
          ...cinemaBase,
          name: showData.cinemaName || cinemaBase.name || "未知影城",
          currentShowtimes: filteredTimes,
        };
      }).filter(c => c.currentShowtimes.length > 0);

      setCinemas(combinedData);
    } catch (error) {
      console.error("❌ Firebase 讀取失敗:", error);
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
    const b = base || 290;
    if (ticketType === '學生票') return b - 20;
    if (ticketType === '愛心票') return Math.floor(b / 2);
    return b;
  };

  const sortedCinemas = cinemas
    .map((c) => {
      // 💡 關鍵修正：從 c.location 中取出 lat 和 lng
      const cinemaLat = c.location?.lat || c.lat; // 兼容舊版與新版 location 物件
      const cinemaLng = c.location?.lng || c.lng;

      return {
        ...c,
        distance: location && cinemaLat 
          ? getDistance(location.latitude, location.longitude, cinemaLat, cinemaLng) 
          : 999,
      };
    })
    .sort((a, b) => a.distance - b.distance);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={[styles.headerCard, { backgroundColor: theme.card, borderColor: theme.border, shadowColor: theme.glow }]}>
        <Text style={[styles.title, { color: theme.text }]}>🎬 {movieTitle}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.versionBadge, { backgroundColor: theme.primary + '30' }]}>
            <Text style={[styles.versionText, { color: theme.primary }]}>{versionParam}</Text>
          </View>
          <Text style={[styles.subtitle, { color: theme.subText }]}> 附近共有 {cinemas.length} 間戲院</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {(['全票', '學生票', '愛心票'] as TicketType[]).map((t) => (
          <TouchableOpacity
            key={t}
            activeOpacity={0.7}
            style={[
              styles.tag, 
              { backgroundColor: theme.card, borderColor: theme.border },
              ticketType === t && { backgroundColor: theme.primary, borderColor: theme.primary, shadowColor: theme.primary }
            ]}
            onPress={() => setTicketType(t)}
          >
            <Text style={[styles.tagText, { color: ticketType === t ? (isDark ? '#000' : '#fff') : theme.text }]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <Text style={[styles.sectionTitle, { color: theme.subText }]}>附近的戲院 ｜ 距離排序</Text>
    </View>
  );

  if (!fontsLoaded || loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ marginTop: 15, color: theme.subText, fontFamily: 'ZenKurenaido' }}>探測中...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: theme.text }]}>選擇戲院</Text>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={sortedCinemas}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.cinemaCard, { backgroundColor: theme.card, borderColor: theme.border, shadowColor: theme.glow }]}
            onPress={() => {
              setSelectedCinema(item);
              setModalVisible(true);
            }}
          >
            <View style={styles.cardMain}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cinemaName, { color: theme.text }]}>{item.name}</Text>
                <View style={styles.infoRow}>
                  <Ionicons name="navigate-outline" size={14} color={theme.primary} />
                  <Text style={[styles.info, { color: theme.subText }]}>
                    {item.city} ｜ {item.distance < 500 ? `${item.distance.toFixed(1)} km` : '計算中'}
                  </Text>
                </View>
              </View>
              <View style={styles.priceTag}>
                <Text style={[styles.priceValue, { color: theme.primary }]}>
                  <Text style={styles.currency}>$</Text>{getPrice(item.prices?.[versionParam as VersionKey])}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* --- 時刻表 Modal (含捲動功能) --- */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{flex: 1}} onPress={() => setModalVisible(false)} />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{selectedCinema?.name}</Text>
              <Text style={[styles.modalSubtitle, { color: theme.subText }]}>今日放映時刻表</Text>
            </View>
            
            {/* 💡 這裡是關鍵：將場次放在 ScrollView 裡 */}
            <ScrollView 
              showsVerticalScrollIndicator={false} 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollPadding}
            >
              <View style={styles.sessionGrid}>
                {selectedCinema?.currentShowtimes?.map((time: string, index: number) => (
                  <TouchableOpacity 
                    key={`${time}-${index}`} 
                    style={[styles.sessionBtn, { backgroundColor: theme.primary + '15', borderColor: theme.primary }]}
                  >
                    <Text style={[styles.sessionText, { color: theme.primary }]}>{time}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={[styles.closeBtn, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]} 
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.closeText, { color: theme.text }]}>返回列表</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  headerContainer: { paddingTop: 10 },
  
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 10,
    paddingHorizontal: 15,
  },
  backButton: { padding: 8 },
  navTitle: { fontSize: 18, fontFamily: 'ZenKurenaido' },

  headerCard: {
    padding: 24,
    borderRadius: 28,
    marginBottom: 20,
    borderWidth: 1,
    elevation: 8,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  title: { fontSize: 26, fontFamily: 'ZenKurenaido', marginBottom: 12 },
  badgeRow: { flexDirection: 'row', alignItems: 'center' },
  versionBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, marginRight: 8 },
  versionText: { fontSize: 13 },
  subtitle: { fontSize: 14, fontFamily: 'ZenKurenaido' },
  sectionTitle: { fontSize: 13, fontFamily: 'ZenKurenaido', marginBottom: 15, marginLeft: 5, letterSpacing: 1, opacity: 0.8 },

  tabRow: { flexDirection: 'row', marginBottom: 25, gap: 10 },
  tag: { 
    flex: 1, 
    paddingVertical: 12, 
    borderRadius: 18, 
    borderWidth: 1, 
    alignItems: 'center',
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  tagText: { fontFamily: 'ZenKurenaido', fontSize: 15 },

  cinemaCard: {
    padding: 22,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 6,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  cardMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cinemaName: { fontSize: 20, fontFamily: 'ZenKurenaido', marginBottom: 8},
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  info: { fontSize: 13, fontFamily: 'ZenKurenaido', marginLeft: 6 },
  priceTag: { alignItems: 'flex-end' },
  currency: { fontSize: 16, marginRight: 2 },
  priceValue: { fontSize: 28, fontWeight: '900' },

  // Modal 樣式優化
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { 
    padding: 25, 
    borderTopLeftRadius: 40, 
    borderTopRightRadius: 40, 
    maxHeight: height * 0.75, // 限制高度以啟用內部滾動
    minHeight: 450,
  },
  modalHandle: { width: 45, height: 5, borderRadius: 10, alignSelf: 'center', marginBottom: 20, opacity: 0.4 },
  modalHeader: { marginBottom: 20, alignItems: 'center' },
  modalTitle: { fontSize: 24, fontFamily: 'ZenKurenaido',  marginBottom: 6 },
  modalSubtitle: { fontSize: 15, fontFamily: 'ZenKurenaido', letterSpacing: 1 },
  
  // 💡 時刻表滾動區域
  modalScrollView: { marginVertical: 10 },
  modalScrollPadding: { paddingBottom: 20 },
  
  sessionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-start' },
  sessionBtn: { 
    width: (width - 76) / 3, 
    paddingVertical: 18, 
    borderRadius: 20, 
    borderWidth: 1.5, 
    alignItems: 'center',
    elevation: 2,
  },
  sessionText: { fontSize: 18 },
  closeBtn: { marginTop: 10, padding: 18, borderRadius: 22, alignItems: 'center' },
  closeText: { fontSize: 16, fontFamily: 'ZenKurenaido'},
});