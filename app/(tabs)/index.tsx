import { useFonts, ZenKurenaido_400Regular } from '@expo-google-fonts/zen-kurenaido';
import * as SplashScreen from 'expo-splash-screen';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AnimatedSplashScreen from './AnimatedSplashScreen';
import TabNavigator from './TabNavigator';


SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Index() {
    const [authInitialized, setAuthInitialized] = useState(false);
    const [splashAnimationComplete, setSplashAnimationComplete] = useState(false);
    const [fontsLoaded] = useFonts({ ZenKurenaido_400Regular });

    const isAppReady = authInitialized && fontsLoaded;

    useEffect(() => {

        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setAuthInitialized(true);
            } else {
                signInAnonymously(auth).then(() => setAuthInitialized(true));
            }
        });

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