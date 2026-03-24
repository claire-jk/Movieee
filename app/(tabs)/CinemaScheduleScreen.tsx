import { ZenKurenaido_400Regular, useFonts } from '@expo-google-fonts/zen-kurenaido';
import { Ionicons } from '@expo/vector-icons'; // 修正導入路徑
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';

// 影城資料
const cinemaSchedules = [
  { name: '威秀影城 VIESHOW', color: '#FFD700', url: 'https://www.vscinemas.com.tw/' },
  { name: '秀泰影城 SHOWTIME', color: '#005BAB', url: 'https://www.showtimes.com.tw/' },
  { name: '美麗華影城 MIRAMAR', color: '#E60012', url: 'https://www.miramarcinemas.tw/' },
];

const scheduleDetails = {
  '威秀影城 VIESHOW': [
    { type: '週五上映電影', time: '週三 12:00 ~ 18:00' },
    { type: '週三上映電影', time: '週一 20:00 ~ 22:00' },
  ],
  '秀泰影城 SHOWTIME': [
    { type: '一般新片 (週五)', time: '週三 10:00 ~ 10:30' },
    { type: '當週完整場次', time: '週三或週四 中午' },
  ],
  '美麗華影城 MIRAMAR': [
    { type: '週五上映新片', time: '週三 18:00 前後' },
  ]
};

export default function CinemaTicketScheduleScreen() {
  const [notifyTime, setNotifyTime] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [fontsLoaded] = useFonts({ ZenKurenaido_400Regular });

  const onChangeTime = (event: any, selectedTime?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedTime) {
      setNotifyTime(selectedTime);
      Alert.alert("提醒設定", "時間已記錄。注意：SDK 53 於 Expo Go 環境下不支援通知彈窗。");
    }
  };

  const theme = {
    bg: isDark ? '#121212' : '#F8FAFB',
    card: isDark ? '#1E1E1E' : '#FFFFFF',
    text: isDark ? '#E0E0E0' : '#2D3436',
    sub: isDark ? '#888888' : '#636E72',
    accent: '#FF6B6B',
    font: 'ZenKurenaido_400Regular'
  };

  if (!fontsLoaded) return null;

  const textStyle = { fontFamily: theme.font, color: theme.text };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header 部分 - 增加 paddingTop 解決太靠上的問題 */}
      <View style={styles.header}>
        <Text style={[styles.title, textStyle]}>🎫 影城售票時程</Text>
        <Text style={[styles.subtitle, textStyle, { color: theme.sub }]}>掌握全台影城更新規律</Text>
      </View>

      {/* 設定提醒卡片 - 更現代的陰影感 */}
      <View style={styles.timerWrapper}>
        <TouchableOpacity 
          activeOpacity={0.8}
          style={[styles.timerCard, { backgroundColor: theme.card }]} 
          onPress={() => setShowPicker(true)}
        >
          <View style={[styles.iconCircle, { backgroundColor: theme.accent + '15' }]}>
            <Ionicons name="notifications-outline" size={22} color={theme.accent} />
          </View>
          <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={[styles.timerLabel, textStyle, { color: theme.sub }]}>我的預計搶票時間</Text>
            <Text style={[styles.timerValue, textStyle]}>
              {notifyTime ? notifyTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '點擊設定時間'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D1D1D1" />
        </TouchableOpacity>
      </View>

      {showPicker && (
        <DateTimePicker 
          value={notifyTime || new Date()} 
          mode="time" 
          is24Hour={true} 
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onChangeTime} 
        />
      )}

      <FlatList
        data={cinemaSchedules}
        keyExtractor={item => item.name}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            {/* 左側彩色條裝飾 */}
            <View style={[styles.sideIndicator, { backgroundColor: item.color }]} />
            
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cinemaName, textStyle]}>{item.name}</Text>
                <Ionicons name="ellipsis-horizontal" size={18} color="#E0E0E0" />
              </View>

              <View style={styles.divider} />

              {scheduleDetails[item.name as keyof typeof scheduleDetails].map((s, i) => (
                <View key={i} style={styles.scheduleRow}>
                  <View style={styles.typeBadge}>
                    <Text style={[styles.rowType, textStyle, { color: theme.sub }]}>{s.type}</Text>
                  </View>
                  <Text style={[styles.rowTime, textStyle]}>{s.time}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Text style={[styles.footerText, textStyle, { color: theme.sub }]}>
          ※ 時間僅供參考，實際請以影城官網為準
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    paddingHorizontal: 28, 
    paddingTop: Platform.OS === 'android' ? 45 : 20, // 解決標題太靠上的問題
    paddingBottom: 20,
  },
  title: { fontSize: 28, fontWeight: '600', letterSpacing: 1.5 },
  subtitle: { fontSize: 13, marginTop: 6, opacity: 0.8 },
  
  timerWrapper: { paddingHorizontal: 20, marginBottom: 15 },
  timerCard: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  timerLabel: { fontSize: 11, marginBottom: 3 },
  timerValue: { fontSize: 18, fontWeight: '700' },

  listContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    borderRadius: 26,
    marginBottom: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2
  },
  sideIndicator: { width: 5 },
  cardContent: { flex: 1, padding: 22 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cinemaName: { fontSize: 18, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#F1F1F1', marginBottom: 15 },
  
  scheduleRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 12, 
    alignItems: 'center' 
  },
  typeBadge: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  rowType: { fontSize: 12 },
  rowTime: { fontSize: 13, fontWeight: '500' },
  
  footer: { paddingVertical: 20, alignItems: 'center', opacity: 0.6 },
  footerText: { fontSize: 10, fontStyle: 'italic' }
});