import { useFonts, ZenKurenaido_400Regular } from '@expo-google-fonts/zen-kurenaido';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import {
    FlatList,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme,
    View
} from 'react-native';

// 影城資料
const cinemaSchedules = [
  {
    name: '威秀影城 VIESHOW',
    color: '#FFD700',
    schedule: [
      { type: '週五上映電影', time: '週三 12:00 ~ 18:00 開放' },
      { type: '週三上映電影', time: '週一 20:00 ~ 22:00 開放' },
      { type: '週四上映電影', time: '週二 20:00 ~ 22:00 開放' },
    ],
  },
  {
    name: '秀泰影城 SHOWTIME',
    color: '#005BAB',
    schedule: [
      { type: '一般新片 (週五)', time: '週三 10:00 ~ 10:30 開放' },
      { type: '當週完整場次', time: '週三或週四 中午後' },
    ],
  },
  {
    name: '美麗華影城 MIRAMAR',
    color: '#E60012',
    schedule: [
      { type: '週五上映新片', time: '週三 18:00 前後' },
      { type: '週三/四特殊上映', time: '週一或週二 晚上' },
    ],
  },
];

export default function CinemaTicketScheduleScreen() {
  const [notifyTime, setNotifyTime] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // 載入 Google 字體
  const [fontsLoaded] = useFonts({ ZenKurenaido_400Regular });

  const onChangeTime = (event: any, selectedTime?: Date) => {
    setShowPicker(Platform.OS === 'ios'); 
    if (selectedTime) {
      setNotifyTime(selectedTime);
      // 此處已移除通知排程邏輯
    }
  };

  // 主題配色設定
  const theme = {
    bg: isDark ? '#121212' : '#F8F9FA',
    card: isDark ? '#1E1E1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#2D3436',
    subText: isDark ? '#AAAAAA' : '#636E72',
    accent: isDark ? '#BB86FC' : '#6200EE',
    font: fontsLoaded ? 'ZenKurenaido_400Regular' : undefined
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text, fontFamily: theme.font }]}>🎫 售票時間表</Text>
        <Text style={[styles.subtitle, { color: theme.subText, fontFamily: theme.font }]}>純淨版：僅供時間規律參考</Text>
      </View>

      {/* 提醒時間顯示按鈕 (僅顯示數值，無推播功能) */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.alarmButton, { backgroundColor: theme.accent }]}
        onPress={() => setShowPicker(true)}
      >
        <View style={styles.alarmIconBox}>
          <Ionicons name="time" size={24} color={theme.accent} />
        </View>
        <View style={styles.alarmContent}>
          <Text style={[styles.alarmLabel, { fontFamily: theme.font }]}>設定我的搶票時間</Text>
          <Text style={[styles.alarmStatus, { fontFamily: theme.font }]}>
            {notifyTime ? `${notifyTime.getHours()}:${notifyTime.getMinutes().toString().padStart(2, '0')}` : '點擊選擇時間'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#FFF" />
      </TouchableOpacity>

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
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={[styles.colorSideBar, { backgroundColor: item.color }]} />
            <Text style={[styles.cinemaName, { color: theme.text, fontFamily: theme.font }]}>{item.name}</Text>
            {item.schedule.map((s, idx) => (
              <View key={idx} style={styles.row}>
                <Text style={[styles.typeText, { color: theme.subText, fontFamily: theme.font }]}>{s.type}</Text>
                <Text style={[styles.timeText, { color: theme.text, fontFamily: theme.font }]}>{s.time}</Text>
              </View>
            ))}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingBottom: 16 },
  title: { fontSize: 32, fontWeight: 'bold' },
  subtitle: { fontSize: 16, marginTop: 4 },
  listContainer: { padding: 20, paddingBottom: 60 },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  colorSideBar: {
    position: 'absolute',
    left: 0,
    top: 25,
    bottom: 25,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  cinemaName: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  typeText: { fontSize: 13, flex: 1 },
  timeText: { fontSize: 13, flex: 1.5, textAlign: 'right' },
  alarmButton: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 4,
  },
  alarmIconBox: {
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 15,
  },
  alarmContent: { flex: 1, marginLeft: 15 },
  alarmLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  alarmStatus: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
});