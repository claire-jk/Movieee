//戲院列表頁面
import { useFonts, ZenKurenaido_400Regular } from '@expo-google-fonts/zen-kurenaido';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'; // 修正：改用 React Navigation
import * as Location from 'expo-location';
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

import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { RootStackParamList } from './TabNavigator'; // 匯入型別

const { width, height } = Dimensions.get('window');

type TicketType = '全票' | '學生票' | '愛心票';

type CinemaScreenRouteProp = RouteProp<RootStackParamList, 'CinemaDetail'>;

export default function CinemaScreen() {
  const navigation = useNavigation();
  const route = useRoute<CinemaScreenRouteProp>();
  

  const { movieTitle, version: versionParam = '2D' } = route.params || {};

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

  // 取得經緯度
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

  // 標準化電影版本名稱
  const normalizeVersion = (ver: string) => {
    if (!ver) return '數位 2D';
    const v = ver.toUpperCase();
    if (v.includes('IMAX')) return 'IMAX';
    if (v.includes('4DX')) return '4DX';
    if (v.includes('SCREENX')) return 'ScreenX';
    if (v.includes('DOLBY')) return 'Dolby Cinema';
    if (v.includes('3D')) return '數位 3D';
    if (v.includes('LIVE')) return 'LIVE';
    return '數位 2D';
  };

  // 從 Firebase 抓取並過濾戲院場次
  const fetchCinemas = async () => {
    console.log("--- 偵錯資訊 ---");
    console.log("當前收到的電影標題:", movieTitle);
    console.log("當前請求的版本:", versionParam);

    if (!movieTitle) {
      console.warn("⚠️ 警告：movieTitle 是空的，無法搜尋戲院！");
      setCinemas([]);
      return;
    }

    try {
      const cinemaSnap = await getDocs(collection(db, 'cinemas'));
      const cinemaInfoMap = cinemaSnap.docs.reduce((acc, doc) => {
        acc[doc.id] = doc.data();
        return acc;
      }, {} as any);

      const showtimeSnap = await getDocs(collection(db, 'realtime_showtimes'));
      const targetVer = normalizeVersion(versionParam);

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
            .filter((s: any) => normalizeVersion(s.ver) === targetVer)
            .map((s: any) => s.time);
        }

        return {
          id: doc.id,
          ...cinemaBase,
          name: showData.cinemaName || cinemaBase.name || "未知影城",
          currentShowtimes: filteredTimes,
          city: cinemaBase.city || "未知區域"
        };
      }).filter(c => c.currentShowtimes.length > 0);

      console.log(`✅ 成功找到 ${combinedData.length} 間匹配戲院`);
      setCinemas(combinedData);
    } catch (error) {
      console.error("❌ Firebase 讀取失敗:", error);
    }
  };

  // 計算距離與票價
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const getPrice = (cinemaItem: any) => {
    const priceObj = cinemaItem?.price || {};
    const targetKey = normalizeVersion(versionParam);
    const base = priceObj[targetKey] || priceObj['數位 2D'] || 300;
    if (ticketType === '學生票') return base - 20;
    if (ticketType === '愛心票') return Math.floor(base / 2);
    return base;
  };

  const sortedCinemas = cinemas.map((c) => ({
    ...c,
    distance: location && c.location?.lat ? getDistance(location.latitude, location.longitude, c.location.lat, c.location.lng) : 999,
  })).sort((a, b) => a.distance - b.distance);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <MotiView 
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={[styles.headerCard, { backgroundColor: theme.card, borderColor: theme.primary }]}
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
        {(['全票', '學生票', '愛心票'] as TicketType[]).map((t) => (
          <TouchableOpacity
            key={t}
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
        ))}
      </View>
    </View>
  );

  if (!fontsLoaded || loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ marginTop: 15, color: theme.subText, fontFamily: 'ZenKurenaido' }}>搜尋戲院中...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: theme.text }]}>選擇戲院</Text>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={sortedCinemas}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        renderItem={({ item, index }) => (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: index * 100 }}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.cinemaCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => { setSelectedCinema(item); setModalVisible(true); }}
            >
              <View style={styles.cardMain}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cinemaName, { color: theme.text }]}>{item.name}</Text>
                  <Text style={[styles.info, { color: theme.subText }]}>
                    {item.city} ｜ {item.distance < 500 ? `${item.distance.toFixed(1)} km` : '距離未知'}
                  </Text>
                </View>
                <View style={styles.priceContainer}>
                  <Text style={[styles.priceValue, { color: theme.primary }]}>
                    <Text style={styles.currency}>$</Text>{getPrice(item)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.subText} />
                </View>
              </View>
            </TouchableOpacity>
          </MotiView>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{flex: 1}} onPress={() => setModalVisible(false)} />
          <MotiView 
            from={{ translateY: height }}
            animate={{ translateY: 0 }}
            style={[styles.modalContent, { backgroundColor: theme.card }]}
          >
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>{selectedCinema?.name}</Text>
            
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScrollView}>
              <View style={styles.sessionGrid}>
                {selectedCinema?.currentShowtimes?.map((time: string, index: number) => (
                  <View key={`${time}-${index}`} style={[styles.sessionBtn, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                    <Text style={[styles.sessionText, { color: theme.text }]}>{time}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={[styles.closeBtn, { backgroundColor: theme.primary }]} 
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeText}>返回列表</Text>
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
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingBottom: 15, paddingHorizontal: 20 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  navTitle: { fontSize: 20, fontFamily: 'ZenKurenaido' },
  headerContainer: { paddingTop: 10 },
  headerCard: { padding: 24, borderRadius: 32, marginBottom: 25, borderWidth: 1.5, shadowRadius: 10, shadowOpacity: 0.1, elevation: 5 },
  title: { fontSize: 28, fontFamily: 'ZenKurenaido', marginBottom: 12 },
  badgeRow: { flexDirection: 'row', alignItems: 'center' },
  versionBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, marginRight: 8 },
  versionText: { fontSize: 13, fontFamily: 'ZenKurenaido', fontWeight: 'bold' },
  subtitle: { fontSize: 15, fontFamily: 'ZenKurenaido' },
  tabRow: { flexDirection: 'row', marginBottom: 25, gap: 10 },
  tag: { flex: 1, paddingVertical: 14, borderRadius: 18, borderWidth: 1, alignItems: 'center' },
  tagText: { fontSize: 16, fontFamily: 'ZenKurenaido', fontWeight: '600' },
  cinemaCard: { padding: 22, borderRadius: 26, marginBottom: 16, borderWidth: 1 },
  cardMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cinemaName: { fontSize: 21, fontFamily: 'ZenKurenaido', marginBottom: 6 },
  info: { fontSize: 14, fontFamily: 'ZenKurenaido' },
  priceContainer: { flexDirection: 'row', alignItems: 'center' },
  currency: { fontSize: 14, fontFamily: 'ZenKurenaido' },
  priceValue: { fontSize: 28, fontFamily: 'ZenKurenaido', marginLeft: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { padding: 28, borderTopLeftRadius: 50, borderTopRightRadius: 50, height: height * 0.7 },
  modalHandle: { width: 45, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 25, opacity: 0.2 },
  modalTitle: { fontSize: 24, fontFamily: 'ZenKurenaido', marginBottom: 20, textAlign: 'center' },
  modalScrollView: { flex: 1 },
  sessionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  sessionBtn: { width: (width - 80) / 3, paddingVertical: 15, borderRadius: 15, borderWidth: 1, alignItems: 'center' },
  sessionText: { fontSize: 18, fontFamily: 'ZenKurenaido' },
  closeBtn: { marginTop: 20, padding: 20, borderRadius: 24, alignItems: 'center' },
  closeText: { fontSize: 18, color: '#FFF', fontFamily: 'ZenKurenaido', fontWeight: 'bold' },
});