import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import TabNavigator from './TabNavigator';

/**
 * Expo Router 進入點
 * 負責：處理匿名登入初始化、渲染底部導航
 */
export default function Index() {
    const [initializing, setInitializing] = React.useState(true);

    useEffect(() => {
        const auth = getAuth();
        
        // 監聽登入狀態變化
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
                // 如果沒有使用者，執行匿名登入
                signInAnonymously(auth)
                    .then(() => {
                        console.log("✅ [Auth] 匿名帳號已自動開啟");
                    })
                    .catch((error) => {
                        console.error("❌ [Auth] 匿名登入失敗:", error);
                    })
                    .finally(() => setInitializing(false));
            } else {
                console.log("👤 [Auth] 當前使用者 UID:", user.uid);
                setInitializing(false);
            }
        });

        // 組件卸載時取消監聽
        return unsubscribe;
    }, []);

    // 讀取中畫面（可根據需求自定義）
    if (initializing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF4081" />
            </View>
        );
    }

    return <TabNavigator />;
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
});