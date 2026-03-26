import { useFonts, ZenKurenaido_400Regular } from '@expo-google-fonts/zen-kurenaido';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
// 引入 Moti 動畫庫
import { MotiView } from 'moti';
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
    bg: isDark ? '#0F0F12' : '#F8F9FB',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    text: isDark ? '#F2F2F7' : '#1C1C1E',
    subText: isDark ? '#8E8E93' : '#636366',
    primary: isDark ? '#D0BCFF' : '#6750A4', 
    border: isDark ? '#333335' : '#E5E5EA',
    accent: '#FF375F',
    glowColor: isDark ? 'rgba(208, 188, 255, 0.3)' : 'rgba(103, 80, 164, 0.1)',
  };

  // ... (邏輯函數 prepareData, fetchCinemas 等保持不變)
  useEffect(() => { prepareData(); }, [movieTitle, versionParam]);
  const prepareData = async () => { setLoading(true); await getLocation(); await fetchCinemas(); setLoading(false); };
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchCinemas(); setRefreshing(false); }, [movieTitle, versionParam]);
  const getLocation = async () => { try { let { status } = await Location.requestForegroundPermissionsAsync(); if (status !== 'granted') return; let loc = await Location.getCurrentPositionAsync({}); setLocation(loc.coords); } catch (e) { console.warn("無法取得位置資訊"); } };
  const normalizeVersion = (ver: string) => { const v = ver.toUpperCase(); if (v.includes('IMAX')) return 'IMAX'; if (v.includes('4DX')) return '4DX'; if (v.includes('SCREENX')) return 'ScreenX'; if (v.includes('DOLBY')) return 'Dolby Cinema'; if (v.includes('3D')) return '數位 3D'; if (v.includes('LIVE')) return 'LIVE'; return '數位 2D'; };
  const fetchCinemas = async () => { if (!movieTitle) return; try { const qCinema = query(collection(db, 'cinemas')); const cinemaSnap = await getDocs(qCinema); const cinemaInfoMap = cinemaSnap.docs.reduce((acc, doc) => { acc[doc.id] = doc.data(); return acc; }, {} as any); const qShowtimes = query(collection(db, 'realtime_showtimes')); const showtimeSnap = await getDocs(qShowtimes); const combinedData = showtimeSnap.docs.map(doc => { const showData = doc.data(); const cinemaBase = cinemaInfoMap[doc.id] || {}; const movieInCinema = showData.movies?.find((m: any) => { if (!m?.title) return false; const cleanCrawlTitle = m.title.replace(/\s/g, '').toLowerCase(); const cleanTargetTitle = movieTitle.replace(/\s/g, '').toLowerCase(); return cleanCrawlTitle.includes(cleanTargetTitle) || cleanTargetTitle.includes(cleanCrawlTitle); }); let filteredTimes: {time: string, ver: string}[] = []; if (movieInCinema && movieInCinema.showtimes) { filteredTimes = movieInCinema.showtimes.filter((s: any) => normalizeVersion(s.ver) === normalizeVersion(versionParam) ); } return { id: doc.id, ...cinemaBase, name: showData.cinemaName || cinemaBase.name || "未知影城", currentShowtimes: filteredTimes.map(s => s.time), }; }).filter(c => c.currentShowtimes.length > 0); setCinemas(combinedData); } catch (error) { console.error("❌ Firebase 讀取失敗:", error); } };
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => { const R = 6371; const dLat = ((lat2 - lat1) * Math.PI) / 180; const dLon = ((lon2 - lon1) * Math.PI) / 180; const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); };
  const getPrice = (cinemaItem: any) => { const priceObj = cinemaItem?.price || {}; const targetKey = normalizeVersion(versionParam); const base = priceObj[targetKey] || priceObj['數位 2D'] || 300; if (ticketType === '學生票') return base - 20; if (ticketType === '愛心票') return Math.floor(base / 2); return base; };

  const sortedCinemas = cinemas.map((c) => ({ ...c, distance: location && c.location?.lat ? getDistance(location.latitude, location.longitude, c.location.lat, c.location.lng) : 999, })).sort((a, b) => a.distance - b.distance);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* 🎬 電影標題卡 - 添加呼吸動畫 */}
      <MotiView 
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 15 }}
        style={[styles.headerCard, { 
          backgroundColor: theme.card, 
          borderColor: theme.primary,
          shadowColor: theme.primary,
          shadowOpacity: isDark ? 0.3 : 0.1
        }]}
      >
        <Text style={[styles.title, { color: theme.text }]}>🎬 {movieTitle}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.versionBadge, { backgroundColor: theme.primary + '30' }]}>
            <Text style={[styles.versionText, { color: theme.primary }]}>{normalizeVersion(versionParam)}</Text>
          </View>
          <Text style={[styles.subtitle, { color: theme.subText }]}> 附近共有 {cinemas.length} 間戲院</Text>
        </View>
      </MotiView>

      <View style={styles.tabRow}>
        {(['全票', '學生票', '愛心票'] as TicketType[]).map((t, index) => (
          <MotiView
            key={t}
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 200 + index * 100 }}
            style={{ flex: 1 }}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                styles.tag, 
                { backgroundColor: theme.card, borderColor: theme.border },
                ticketType === t && { backgroundColor: theme.primary, borderColor: theme.primary }
              ]}
              onPress={() => setTicketType(t)}
            >
              <Text style={[styles.tagText, { color: ticketType === t ? '#FFF' : theme.text }]}>{t}</Text>
            </TouchableOpacity>
          </MotiView>
        ))}
      </View>
    </View>
  );

  if (!fontsLoaded || loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ loop: true, duration: 1000 }}
        >
          <Text style={{ marginTop: 15, color: theme.subText, fontFamily: 'ZenKurenaido', letterSpacing: 2 }}>
            尋找場次中...
          </Text>
        </MotiView>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        renderItem={({ item, index }) => (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: index * 100 }} // 階梯式入場
          >
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.cinemaCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => { setSelectedCinema(item); setModalVisible(true); }}
            >
              <View style={styles.cardMain}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cinemaName, { color: theme.text }]}>{item.name}</Text>
                  <View style={styles.infoRow}>
                    <Text style={[styles.info, { color: theme.subText }]}>
                      {item.city} ｜ {item.distance < 500 ? `${item.distance.toFixed(1)} km` : '距離未知'}
                    </Text>
                  </View>
                </View>
                <View style={styles.priceContainer}>
                  <Text style={[styles.priceValue, { color: theme.primary }]}>
                    <Text style={styles.currency}>$</Text>{getPrice(item)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.subText} style={{marginLeft: 4}} />
                </View>
              </View>
            </TouchableOpacity>
          </MotiView>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{flex: 1}} onPress={() => setModalVisible(false)} />
          
          <MotiView 
            from={{ translateY: height }}
            animate={{ translateY: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            style={[styles.modalContent, { backgroundColor: theme.card }]}
          >
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{selectedCinema?.name}</Text>
              <View style={[styles.modalBadge, { backgroundColor: theme.primary + '15' }]}>
                <Text style={{color: theme.primary, fontSize: 13, fontFamily: 'ZenKurenaido'}}>{normalizeVersion(versionParam)}</Text>
              </View>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScrollView}>
              <View style={styles.sessionGrid}>
                {selectedCinema?.currentShowtimes?.map((time: string, index: number) => (
                  <MotiView
                    key={`${time}-${index}`}
                    from={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 50 }}
                  >
                    <TouchableOpacity 
                      style={[styles.sessionBtn, { backgroundColor: theme.bg, borderColor: theme.border }]}
                    >
                      <Text style={[styles.sessionText, { color: theme.text }]}>{time}</Text>
                    </TouchableOpacity>
                  </MotiView>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={[styles.closeBtn, { backgroundColor: theme.primary }]} 
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.closeText, { color: '#FFF' }]}>返回列表</Text>
            </TouchableOpacity>
          </MotiView>
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
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  navTitle: { fontSize: 20, fontFamily: 'ZenKurenaido' },

  headerCard: {
    padding: 24,
    borderRadius: 32,
    marginBottom: 25,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 8,
  },
  title: { fontSize: 28, fontFamily: 'ZenKurenaido', marginBottom: 12, lineHeight: 36 },
  badgeRow: { flexDirection: 'row', alignItems: 'center' },
  versionBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, marginRight: 8 },
  versionText: { fontSize: 13, fontFamily: 'ZenKurenaido', fontWeight: '700' },
  subtitle: { fontSize: 15, fontFamily: 'ZenKurenaido', opacity: 0.8 },
  
  tabRow: { flexDirection: 'row', marginBottom: 25, gap: 10 },
  tag: { 
    paddingVertical: 14, 
    borderRadius: 18, 
    borderWidth: 1, 
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  tagText: { fontSize: 16, fontFamily: 'ZenKurenaido', fontWeight: '600' },

  cinemaCard: {
    padding: 22,
    borderRadius: 26,
    marginBottom: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  cardMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cinemaName: { fontSize: 21, fontFamily: 'ZenKurenaido', marginBottom: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  info: { fontSize: 14, fontFamily: 'ZenKurenaido', opacity: 0.7 },
  priceContainer: { flexDirection: 'row', alignItems: 'center' },
  currency: { fontSize: 14, fontFamily: 'ZenKurenaido', marginRight: 1 },
  priceValue: { fontSize: 28, fontFamily: 'ZenKurenaido' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { 
    padding: 28, 
    borderTopLeftRadius: 50, 
    borderTopRightRadius: 50, 
    height: height * 0.7, 
    elevation: 20,
  },
  modalHandle: { width: 45, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 25, opacity: 0.2 },
  modalHeader: { marginBottom: 30, alignItems: 'center' },
  modalTitle: { fontSize: 26, fontFamily: 'ZenKurenaido', marginBottom: 10, textAlign: 'center' },
  modalBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  
  modalScrollView: { flex: 1 },
  sessionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' },
  sessionBtn: { 
    width: (width - 84) / 3, 
    paddingVertical: 18, 
    borderRadius: 20, 
    borderWidth: 1.5, 
    alignItems: 'center',
  },
  sessionText: { fontSize: 19, fontFamily: 'ZenKurenaido', fontWeight: '600' },
  closeBtn: { marginTop: 20, padding: 20, borderRadius: 24, alignItems: 'center', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 },
  closeText: { fontSize: 19, fontFamily: 'ZenKurenaido', fontWeight: 'bold', letterSpacing: 1 },
});