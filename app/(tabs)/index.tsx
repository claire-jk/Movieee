import { useFonts, ZenKurenaido_400Regular } from '@expo-google-fonts/zen-kurenaido';
import * as SplashScreen from 'expo-splash-screen';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AnimatedSplashScreen from './AnimatedSplashScreen';
import TabNavigator from './TabNavigator';

// 💡 必須在組件外部調用
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Index() {
    const [authInitialized, setAuthInitialized] = useState(false);
    const [splashAnimationComplete, setSplashAnimationComplete] = useState(false);
    const [fontsLoaded] = useFonts({ ZenKurenaido_400Regular });

    const isAppReady = authInitialized && fontsLoaded;

    useEffect(() => {
        // Firebase 邏輯
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setAuthInitialized(true);
            } else {
                signInAnonymously(auth).then(() => setAuthInitialized(true));
            }
        });

        // 💡 關鍵：當 isAppReady 成立時，主動隱藏原生 Splash
        if (isAppReady) {
            const hideNativeSplash = async () => {
                try {
                    console.log("🛠️ [System] 正在隱藏原生啟動圖...");
                    await SplashScreen.hideAsync();
                } catch (e) {
                    console.warn("隱藏 Splash 失敗:", e);
                }
            };
            hideNativeSplash();
        }

        return () => unsubscribe();
    }, [isAppReady]);

    // 如果字體沒載入，不要回傳 null，回傳一個空 View 確保架構穩定
    if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#000' }} />;

    return (
        <View style={styles.container}>
            {/* 底層內容 */}
            {isAppReady ? (
                <TabNavigator />
            ) : (
                <View style={{ flex: 1, backgroundColor: '#000' }} /> // 佔位符
            )}

            {/* 自定義動畫層 */}
            {!splashAnimationComplete && (
                <AnimatedSplashScreen 
                    appIsReady={isAppReady} 
                    onFinish={() => {
                        console.log("✅ [UI] 自定義動畫移除");
                        setSplashAnimationComplete(true);
                    }} 
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
});