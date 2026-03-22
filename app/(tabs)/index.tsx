import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CalendarClock, Home } from 'lucide-react-native';
import React from 'react';

// 匯入頁面組件
import CinemaScheduleScreen from './CinemaScheduleScreen';
import CinemaScreen from './CinemaScreen';
import MovieSelectScreen from './MovieSelectScreen';

// 定義導航參數類型
export type RootStackParamList = {
  MovieSelect: undefined;
  CinemaDetail: { movie: string; version: string };
};

export type RootTabParamList = {
  HomeTab: undefined;
  Schedules: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

// 首頁的堆疊導航：處理選電影到影城列表的跳轉
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MovieSelect" component={MovieSelectScreen} />
      <Stack.Screen name="CinemaDetail" component={CinemaScreen} />
    </Stack.Navigator>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6200EE',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          height: 70,
          paddingBottom: 12,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          elevation: 10,
        }
      }}
    >
      <Tab.Screen 
        name="HomeTab" 
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