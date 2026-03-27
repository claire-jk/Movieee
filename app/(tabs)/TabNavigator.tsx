import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { CalendarClock, Gift, Home, Ticket } from 'lucide-react-native';
import { MotiView } from 'moti';
import React from 'react';
import { Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';

// screens
import CinemaScheduleScreen from './CinemaScheduleScreen';
import CinemaScreen from './CinemaScreen';
import MovieBonusScreen from './MovieBonusScreen';
import MovieSelectScreen from './MovieSelectScreen';
import TicketRecordScreen from './TicketRecordScreen';

export type RootStackParamList = {
  MovieSelect: undefined;
  CinemaDetail: { movie: string; version: string };
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

// 🎨 Tab Icon
function TabIcon({ icon: Icon, label, focused, color }: any) {
  return (
    <MotiView
      animate={{
        scale: focused ? 1.1 : 1,
        translateY: focused ? 8 : 10, // 🔥 再往下
      }}
      transition={{ type: 'spring', damping: 15 }}
      style={styles.iconWrapper}
    >
      {/* Active 背景 */}
      {focused && (
        <MotiView
          from={{ opacity: 0, scale: 0.85, translateY: 2 }}
          animate={{ opacity: 1, scale: 1, translateY: 2 }} // 🔥 同步下移
          style={styles.activeBg}
        />
      )}

      {/* icon */}
      <View style={{ marginTop: 14 }}>
        <Icon color={color} size={22} strokeWidth={focused ? 2.4 : 2} />
      </View>

      {/* label */}
      <Text
        style={[
          styles.label,
          {
            color,
            opacity: focused ? 1 : 0.8,
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

  const theme = {
    active: '#FF6B6B',
    inactive: isDark ? '#8E8E93' : '#7A7A7A',
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,

        tabBarStyle: {
          position: 'absolute',

          // 🔥 再往下（最重要）
          bottom: Platform.OS === 'ios' ? 6 : 4,

          left: 20,
          right: 20,
          height: 74,
          borderRadius: 32,
          borderTopWidth: 0,
          backgroundColor: 'transparent',

          elevation: 0,
          shadowOpacity: 0,
        },

        tabBarBackground: () => (
          <BlurView
            tint={isDark ? 'dark' : 'light'}
            intensity={90}
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
    width: 65,
    height: 65,
  },

  label: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '400',
  },

  activeBg: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 22,
    backgroundColor: 'rgba(255,107,107,0.12)',
  },
});