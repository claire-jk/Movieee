import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { CalendarClock, Gift, Home, Ticket } from 'lucide-react-native';
import { MotiView } from 'moti';
import React from 'react';
import { Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CinemaScheduleScreen from './CinemaScheduleScreen';
import CinemaScreen from './CinemaScreen';
import MovieBonusScreen from './MovieBonusScreen';
import MovieSelectScreen from './MovieSelectScreen';
import TicketRecordScreen from './TicketRecordScreen';

export type RootStackParamList = {
  MovieSelect: undefined;
  CinemaDetail: { movieTitle: string; version: string }; 
};

export type RootTabParamList = {
  MainStack: undefined;
  Bonus: undefined;
  Schedules: undefined;
  TicketRecord: undefined;
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

function TabIcon({ icon: Icon, label, focused, color }: any) {
  return (
    <MotiView
      animate={{
        scale: focused ? 1.1 : 1,
        translateY: focused ? 0 : 2, 
      }}
      transition={{ type: 'spring', damping: 15 }}
      style={styles.iconWrapper}
    >
      {/* Active 背景圈圈 */}
      {focused && (
        <MotiView
          from={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          style={styles.activeBg}
        />
      )}

      {/* Icon 本體 */}
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Icon color={color} size={22} strokeWidth={focused ? 2.4 : 2} />
      </View>

      {/* Label 文字 */}
      <Text
        style={[
          styles.label,
          {
            color,
            opacity: focused ? 1 : 0.7,
            fontFamily: 'ZenKurenaido_400Regular', 
          },
        ]}
      >
        {label}
      </Text>
    </MotiView>
  );
}

export default function TabNavigator() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets(); 

  const theme = {
    active: '#FF6B6B',
    inactive: isDark ? '#8E8E93' : '#7A7A7A',
  };

  const bottomMargin = Platform.OS === 'ios' 
    ? (insets.bottom > 0 ? insets.bottom : 20) 
    : 16; 

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: bottomMargin,
          left: 20,
          right: 20,
          height: 70,
          borderRadius: 35,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarBackground: () => (
          <BlurView
            tint={isDark ? 'dark' : 'light'}
            intensity={80}
            style={StyleSheet.absoluteFill}
          />
        ),
      }}
    >
      <Tab.Screen
        name="MainStack"
        component={HomeStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={Home}
              label="找電影"
              focused={focused}
              color={focused ? theme.active : theme.inactive}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Schedules"
        component={CinemaScheduleScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={CalendarClock}
              label="影城"
              focused={focused}
              color={focused ? theme.active : theme.inactive}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Bonus"
        component={MovieBonusScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={Gift}
              label="特典"
              focused={focused}
              color={focused ? theme.active : theme.inactive}
            />
          ),
        }}
      />

      <Tab.Screen
        name="TicketRecord"
        component={TicketRecordScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={Ticket}
              label="收藏"
              focused={focused}
              color={focused ? theme.active : theme.inactive}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
  },
  label: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  activeBg: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,107,107,0.15)',
    top: 5,
  },
});