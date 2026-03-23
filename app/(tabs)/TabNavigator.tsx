import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CalendarClock, Gift, Home, Ticket } from 'lucide-react-native'; // 引入 Ticket 圖示
import React from 'react';
import { Platform, useColorScheme } from 'react-native';

// 匯入各個分頁組件
import CinemaScheduleScreen from './CinemaScheduleScreen';
import CinemaScreen from './CinemaScreen';
import MovieBonusScreen from './MovieBonusScreen';
import MovieSelectScreen from './MovieSelectScreen';
import TicketRecordScreen from './TicketRecordScreen';

// 定義導航參數類型
export type RootStackParamList = {
  MovieSelect: undefined;
  CinemaDetail: { movie: string; version: string };
};

export type RootTabParamList = {
  MainStack: undefined;
  Bonus: undefined;
  Schedules: undefined;
  TicketRecord: undefined; // 1. 在這裡新增類型定義
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MovieSelect" component={MovieSelectScreen} />
      <Stack.Screen name="CinemaDetail" component={CinemaScreen} />
    </Stack.Navigator>
  );
}

export default function TabNavigator() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tab.Navigator
      initialRouteName="MainStack"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDark ? '#BB86FC' : '#6200EE',
        tabBarInactiveTintColor: isDark ? '#666' : '#999',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 88 : 75,
          paddingTop: 10,
          backgroundColor: isDark ? '#1F1F1F' : '#FFFFFF',
          borderTopWidth: 0,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
        },
      }}
    >
      <Tab.Screen 
        name="MainStack" 
        component={HomeStack} 
        options={{
          title: '找電影',
          tabBarIcon: ({ color }) => <Home color={color} size={24} strokeWidth={2.5} />,
        }}
      />

      <Tab.Screen 
        name="Schedules" 
        component={CinemaScheduleScreen} 
        options={{
          title: '影城規律',
          tabBarIcon: ({ color }) => <CalendarClock color={color} size={24} strokeWidth={2.5} />,
        }}
      />
      
      <Tab.Screen 
        name="Bonus" 
        component={MovieBonusScreen} 
        options={{
          title: '特典情報',
          tabBarIcon: ({ color }) => <Gift color={color} size={24} strokeWidth={2.5} />,
        }}
      />

      {/* 2. 修改這裡的 name 為 TicketRecord，避免重複 */}
      <Tab.Screen 
        name="TicketRecord" 
        component={TicketRecordScreen} 
        options={{
          title: '電影票蒐藏',
          tabBarIcon: ({ color }) => <Ticket color={color} size={24} strokeWidth={2.5} />,
        }}
      />
    </Tab.Navigator>
  );
}