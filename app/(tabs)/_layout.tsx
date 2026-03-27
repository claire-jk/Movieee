import { Stack } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  // 使用 Stack 來承載頁面，這會徹底殺掉原本帶有 X 方塊的預設 TabBar
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        // 確保背景色不會閃白，可以跟隨你的主題
        contentStyle: { backgroundColor: 'transparent' } 
      }} 
    />
  );
}