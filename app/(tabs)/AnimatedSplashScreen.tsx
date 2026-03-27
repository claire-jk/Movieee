import { Ionicons } from '@expo/vector-icons';
import { MotiText, MotiView } from 'moti';
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, useColorScheme, View } from 'react-native';

const { width } = Dimensions.get('window');

interface Props {
  onFinish: () => void;
  appIsReady: boolean;
}

export default function AnimatedSplashScreen({ onFinish, appIsReady }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [exit, setExit] = useState(false);

  const theme = {
    bg1: isDark ? '#0F0F10' : '#F8F9FB',
    bg2: isDark ? '#1A1A1C' : '#FFFFFF',
    logo: '#FF6B6B',
    glow: 'rgba(255,107,107,0.25)',
    text: isDark ? '#FFFFFF' : '#2D3436',
  };

  // ✅ 控制離場動畫
  useEffect(() => {
    if (appIsReady) {
      const timer = setTimeout(() => {
        setExit(true);
        setTimeout(onFinish, 600); // 等動畫結束再關
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [appIsReady]);

  return (
    <MotiView
      style={[styles.container]}
      from={{ opacity: 1 }}
      animate={{ opacity: exit ? 0 : 1 }}
      transition={{ duration: 500 }}
    >
      {/* 🎨 漸層背景（用兩層做假漸層） */}
      <View style={[styles.bgLayer, { backgroundColor: theme.bg1 }]} />
      <View style={[styles.bgOverlay, { backgroundColor: theme.bg2 }]} />

      {/* 🌟 光暈擴散 */}
      <MotiView
        from={{ scale: 0.6, opacity: 0.3 }}
        animate={{ scale: 1.8, opacity: 0 }}
        transition={{
          type: 'timing',
          duration: 2000,
          loop: true,
        }}
        style={[styles.glow, { backgroundColor: theme.glow }]}
      />

      {/* 🎬 LOGO */}
      <MotiView
        from={{ opacity: 0, scale: 0.5, rotate: '0deg' }}
        animate={{
          opacity: 1,
          scale: exit ? 0.8 : 1,
          rotate: exit ? '10deg' : '0deg',
        }}
        transition={{
          type: 'spring',
          damping: 10,
          stiffness: 120,
        }}
      >
        {/* 呼吸動畫 */}
        <MotiView
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            loop: true,
            duration: 2000,
          }}
          style={[styles.logoCircle, { backgroundColor: theme.glow }]}
        >
          <Ionicons name="film" size={90} color={theme.logo} />
        </MotiView>
      </MotiView>

      {/* ✍️ 文字動畫 */}
      <MotiText
        from={{ opacity: 0, translateY: 20 }}
        animate={{
          opacity: exit ? 0 : 1,
          translateY: exit ? -10 : 0,
        }}
        transition={{
          type: 'timing',
          duration: 800,
          delay: 400,
        }}
        style={[styles.text, { color: theme.text }]}
      >
        Moviegoer
      </MotiText>

      {/* ✨ 副標 */}
      <MotiText
        from={{ opacity: 0 }}
        animate={{ opacity: exit ? 0 : 0.6 }}
        transition={{
          delay: 800,
          duration: 1000,
        }}
        style={[styles.subText, { color: theme.text }]}
      >
        Find · Track · Book 🎟️
      </MotiText>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },

  bgLayer: {
    ...StyleSheet.absoluteFillObject,
  },

  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6,
  },

  glow: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
  },

  logoCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    justifyContent: 'center',
    alignItems: 'center',

    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },

  text: {
    marginTop: 35,
    fontSize: 30,
    fontWeight: 'bold',
    letterSpacing: 3,
  },

  subText: {
    marginTop: 10,
    fontSize: 14,
    letterSpacing: 1,
  },
});