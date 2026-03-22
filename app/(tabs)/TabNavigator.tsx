// index.tsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CalendarClock, Home } from 'lucide-react-native';
import React from 'react';

// 匯入頁面
import CinemaScheduleScreen from './CinemaScheduleScreen';
import CinemaScreen from './CinemaScreen';
import MovieSelectScreen from './MovieSelectScreen';

// 定義類型
export type RootStackParamList = {
  MovieSelect: undefined;
  CinemaDetail: { movie: string; version: string }; // 接收首頁傳來的參數
};

export type RootTabParamList = {
  MainStack: undefined;
  Schedules: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

// --- 1. 定義首頁的堆疊 (包含選電影與影城結果) ---
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MovieSelect" component={MovieSelectScreen} />
      <Stack.Screen name="CinemaDetail" component={CinemaScreen} />
    </Stack.Navigator>
  );
}

// --- 2. 主導航器 ---
export default function TabNavigator() {
  return (
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#6200EE',
          tabBarStyle: { height: 70, paddingBottom: 12 }
        }}
      >
        {/* 只保留兩個 Icon */}
        <Tab.Screen 
          name="MainStack" 
          component={HomeStack} 
          options={{
            title: '找電影',
            tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          }}
        />
        <Tab.Screen 
          name="Schedules" 
          component={CinemaScheduleScreen} 
          options={{
            title: '更新時間',
            tabBarIcon: ({ color, size }) => <CalendarClock color={color} size={size} />,
          }}
        />
      </Tab.Navigator>
  );
}