//售票時程頁面
import { ZenKurenaido_400Regular, useFonts } from '@expo-google-fonts/zen-kurenaido';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useIsFocused } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { AnimatePresence, MotiView } from 'moti';
import React, { useMemo, useState } from 'react';
import {
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

const cinemaSchedules = [
  { id: '1', name: '威秀影城 VIESHOW', color: '#ffd900', icon: 'film', url: 'https://www.vscinemas.com.tw/ShowTimes/' },
  { id: '2', name: '秀泰影城 SHOWTIME', color: '#005bab', icon: 'videocam', url: 'https://www.showtimes.com.tw/programs' },
  { id: '3', name: '美麗華影城 MIRAMAR', color: '#e60013', icon: 'sparkles', url: 'https://www.miramarcinemas.tw/Timetable/Index?cinema=standard' },
  { id: '4', name: '百老匯影城 BROADWAY', color: '#5856d6', icon: 'easel', url: 'https://www.broadway-cineplex.com.tw/book.html?obj=Taipei' },
];

const scheduleDetails = {
  '威秀影城 VIESHOW': [
    { type: '週五新片', time: '週三 12:00 ~ 18:00' },
    { type: '週三新片', time: '週一 20:00 ~ 22:00' },
  ],
  '秀泰影城 SHOWTIME': [
    { type: '一般新片', time: '週三 10:00 ~ 10:30' },
    { type: '完整場次', time: '週三或週四 中午' },
  ],
  '美麗華影城 MIRAMAR': [
    { type: '週五新片', time: '週三 18:00 前後' },
  ],
  '百老匯影城 BROADWAY': [
    { type: '週五新片', time: '週三 16:00 ~ 18:00' },
    { type: '場次更換', time: '每週三 下午' },
  ],
};

export default function CinemaTicketScheduleScreen() {
  const isFocused = useIsFocused(); // 2. 監聽頁面是否在前台
  const [notifyTime, setNotifyTime] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: '' });
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [fontsLoaded] = useFonts({ ZenKurenaido: ZenKurenaido_400Regular });

  const theme = useMemo(() => ({
    bg: isDark ? '#0A0A0B' : '#F2F5F9',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#2D3436',
    sub: isDark ? '#A0A0A5' : '#636E72',
    primary: '#FF6B6B',
    font: 'ZenKurenaido'
  }), [isDark]);

  const showCustomToast = (msg: string) => {
    setToast({ visible: true, msg });
    setTimeout(() => setToast({ visible: false, msg: '' }), 2500);
  };

  const handleOpenBrowser = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: theme.card,
        enableBarCollapsing: true,
      });
    } catch (error) {
      showCustomToast("無法開啟瀏覽器");
    }
  };

  const onChangeTime = (event: any, selectedTime?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedTime) {
      setNotifyTime(selectedTime);
      const timeStr = selectedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      showCustomToast(`✨ 提醒已設定：${timeStr}`);
    }
  };

  const cancelTime = () => {
    setNotifyTime(null);
    showCustomToast("🚫 提醒已成功移除");
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* 自定義圓角 Toast */}
      <AnimatePresence>
        {toast.visible && (
          <MotiView
            from={{ opacity: 0, translateY: -100, scale: 0.8 }}
            animate={{ opacity: 1, translateY: 0, scale: 1 }}
            exit={{ opacity: 0, translateY: -100, scale: 0.8 }}
            style={[styles.toastContainer, { backgroundColor: theme.card, shadowColor: '#000' }]}
          >
            <Text style={[styles.toastText, { color: theme.text, fontFamily: theme.font }]}>
              {toast.msg}
            </Text>
          </MotiView>
        )}
      </AnimatePresence>
      
      {/* 標題動畫：每次進入時從上方滑入 */}
      <MotiView 
        from={{ opacity: 0, translateY: -20 }} 
        animate={{ 
          opacity: isFocused ? 1 : 0, 
          translateY: isFocused ? 0 : -20 
        }} 
        transition={{ type: 'timing', duration: 500 }}
        style={styles.header}
      >
        <Text style={[styles.title, { color: theme.text, fontFamily: theme.font }]}>🎫 售票時程</Text>
        <Text style={[styles.subtitle, { color: theme.sub, fontFamily: theme.font }]}>點擊卡片直接前往官網訂票</Text>
      </MotiView>

      {/* 提醒卡片動畫 */}
      <View style={styles.timerWrapper}>
        <MotiView 
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ 
            opacity: isFocused ? 1 : 0, 
            scale: isFocused ? (notifyTime ? 1.02 : 1) : 0.9 
          }}
          transition={{ type: 'spring', delay: 100 }}
          style={[styles.timerCard, { backgroundColor: theme.card }]}
        >
          <TouchableOpacity style={styles.timerMain} onPress={() => setShowPicker(true)}>
            <View style={[styles.iconCircle, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="alarm-outline" size={24} color={theme.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={[styles.timerLabel, { color: theme.sub, fontFamily: theme.font }]}>我的搶票提醒</Text>
              <Text style={[styles.timerValue, { color: theme.text, fontFamily: theme.font }]}>
                {notifyTime ? notifyTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '尚未設定時間'}
              </Text>
            </View>
          </TouchableOpacity>

          <AnimatePresence>
            {notifyTime && (
              <MotiView from={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0 }}>
                <TouchableOpacity onPress={cancelTime} style={styles.cancelBtn}>
                  <Ionicons name="close-circle" size={26} color={theme.sub} />
                </TouchableOpacity>
              </MotiView>
            )}
          </AnimatePresence>
        </MotiView>
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

      {/* 列表動畫：卡片依序滑入 */}
      <FlatList
        data={cinemaSchedules}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item, index }) => (
          <TouchableOpacity activeOpacity={0.8} onPress={() => handleOpenBrowser(item.url)}>
            <MotiView
              from={{ opacity: 0, translateY: 30 }}
              animate={{ 
                opacity: isFocused ? 1 : 0, 
                translateY: isFocused ? 0 : 30 
              }}
              transition={{ 
                type: 'timing',
                duration: 500,
                delay: isFocused ? 200 + index * 100 : 0 // 進入時有交錯延遲
              }}
              style={[styles.card, { backgroundColor: theme.card }]}
            >
              <View style={[styles.sideIndicator, { backgroundColor: item.color }]} />
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <View style={styles.nameRow}>
                    <Ionicons name={item.icon as any} size={18} color={item.color} style={{marginRight: 8}} />
                    <Text style={[styles.cinemaName, { color: theme.text, fontFamily: theme.font }]}>{item.name}</Text>
                  </View>
                  <Ionicons name="open-outline" size={18} color={theme.sub} />
                </View>

                <View style={[styles.divider, { backgroundColor: isDark ? '#333' : '#F0F0F0' }]} />

                {(scheduleDetails[item.name as keyof typeof scheduleDetails] || []).map((s, i) => (
                  <View key={i} style={styles.scheduleRow}>
                    <View style={styles.typeBadge}>
                      <Text style={[styles.typeText, { color: theme.sub, fontFamily: theme.font }]}>● {s.type}</Text>
                    </View>
                    <Text style={[styles.timeText, { color: theme.text, fontFamily: theme.font }]}>{s.time}</Text>
                  </View>
                ))}
              </View>
            </MotiView>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 28, paddingTop: 50, paddingBottom: 25 },
  title: { fontSize: 32, letterSpacing: 1 },
  subtitle: { fontSize: 15, marginTop: 6 },
  toastContainer: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    zIndex: 999,
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 50,
    elevation: 10,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.1)',
  },
  toastText: { fontSize: 16, textAlign: 'center' },
  timerWrapper: { paddingHorizontal: 20, marginBottom: 25 },
  timerCard: {
    padding: 18,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  timerMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  timerLabel: { fontSize: 12 },
  timerValue: { fontSize: 22 },
  cancelBtn: { padding: 5 },
  listContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    borderRadius: 30,
    marginBottom: 20,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 3,
    shadowOpacity: 0.05,
    shadowRadius: 15,
  },
  sideIndicator: { width: 6, marginVertical: 15, borderRadius: 10, marginLeft: 4 },
  cardContent: { flex: 1, padding: 22 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cinemaName: { fontSize: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  divider: { height: 1.5, marginBottom: 18, borderRadius: 1 },
  scheduleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' },
  typeBadge: { backgroundColor: 'rgba(0,0,0,0.04)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  typeText: { fontSize: 13 },
  timeText: { fontSize: 15 },
});