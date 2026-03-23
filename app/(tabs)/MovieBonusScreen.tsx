import { ZenKurenaido_400Regular, useFonts } from '@expo-google-fonts/zen-kurenaido';
import { arrayUnion, collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    Image,
    Modal,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useColorScheme
} from 'react-native';
import { db } from './firebaseConfig';

const { width, height } = Dimensions.get('window');

// 💡 庫存顏色邏輯
const getStatusColor = (state: string) => {
    switch (state) {
        case '庫存充足': return '#27ae60aa';
        case '已領完': return '#c0392baa';
        default: return '#7f8c8d';
    }
};

// 🎥 特典卡片組件
const BonusCard = React.memo(({ item, theme, onReport, onImagePress }: any) => {
    return (
        <View style={[
            styles.card, 
            { 
                backgroundColor: theme.card, 
                shadowColor: theme.isDark ? '#FFFFFF20' : '#00000015', // 微光顏色
                borderColor: theme.isDark ? '#FFFFFF10' : '#00000005',
                borderWidth: 0.8
            }
        ]}>
            <View style={styles.bonusHeader}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => onImagePress(item.image)}>
                    <Image source={{ uri: item.image }} style={styles.bonusImage} resizeMode="cover" />
                    <View style={styles.zoomIcon}>
                        <Text style={{ fontSize: 10, fontFamily: theme.font }}>🔍 點擊放大</Text>
                    </View>
                </TouchableOpacity>
                
                <View style={styles.bonusInfo}>
                    <View style={styles.infoTopRow}>
                        <View style={[styles.cinemaBadge, { backgroundColor: theme.badge }]}>
                            <Text style={[styles.cinemaBadgeText, { fontFamily: theme.font }]}>{item.cinema}</Text>
                        </View>
                    </View>
                    
                    <Text numberOfLines={1} style={[styles.movieTitle, { color: theme.text, fontFamily: theme.font }]}>
                        {item.movieTitle}
                    </Text>
                    <Text numberOfLines={2} style={[styles.bonusName, { color: theme.subText, fontFamily: theme.font }]}>
                        {item.bonusName}
                    </Text>
                </View>
            </View>

            <View style={[styles.statusSection, { backgroundColor: theme.isDark ? '#232326' : '#F9F9FB' }]}>
                <View style={styles.statusHeaderRow}>
                    <Text style={[styles.statusTitle, { color: theme.text, fontFamily: theme.font }]}>📍 即時庫存回報</Text>
                    <Text style={[styles.statusHint, { color: theme.subText, fontFamily: theme.font }]}>最新兩筆</Text>
                </View>
                
                {item.status && item.status.length > 0 ? (
                    item.status.slice(-2).reverse().map((st: any, idx: number) => (
                        <View key={idx} style={styles.statusRow}>
                            <View style={[styles.dot, { backgroundColor: getStatusColor(st.state) }]} />
                            <View style={{ flex: 1 }}>
                                <Text numberOfLines={1} style={[styles.cinemaText, { color: theme.text, fontFamily: theme.font }]}>{st.cinema}</Text>
                                <Text style={[styles.timeText, { color: theme.subText, fontFamily: theme.font }]}>🕒 回報：{st.time}</Text>
                            </View>
                            <View style={[styles.statusBadge, { borderColor: getStatusColor(st.state), borderWidth: 1 }]}>
                                <Text style={[styles.statusBadgeText, { color: getStatusColor(st.state), fontFamily: theme.font }]}>{st.state}</Text>
                            </View>
                        </View>
                    ))
                ) : (
                    <Text style={[styles.emptyStatusText, { color: theme.subText, fontFamily: theme.font }]}>目前暫無影迷回報</Text>
                )}

                <TouchableOpacity 
                    activeOpacity={0.8}
                    style={[styles.reportButton, { backgroundColor: theme.card, borderColor: theme.accent + '66', borderWidth: 1 }]}
                    onPress={() => onReport(item)}
                >
                    <Text style={[styles.reportButtonText, { color: theme.accent, fontFamily: theme.font }]}>✍️ 回報現場庫存</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
});

export default function MovieBonusScreen() {
    const [bonuses, setBonuses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [imageModalVisible, setImageModalVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState('');
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [reportCinema, setReportCinema] = useState('');
    
    // ✅ 成功訊息動畫控制
    const [showSuccess, setShowSuccess] = useState(false);
    const fadeAnim = useMemo(() => new Animated.Value(0), []);

    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const [fontsLoaded] = useFonts({ ZenKurenaido_400Regular });

    const theme = useMemo(() => ({
        isDark,
        bg: isDark ? '#121212' : '#F4F4F6',
        card: isDark ? '#1E1E1E' : '#FFFFFF',
        text: isDark ? '#E0E0E0' : '#2D3436',
        subText: isDark ? '#888888' : '#636E72',
        accent: isDark ? '#D63031' : '#AE1F23',
        badge: isDark ? '#3D3D3D' : '#636E72',
        font: 'ZenKurenaido_400Regular'
    }), [isDark]);

    useEffect(() => {
        const q = query(collection(db, "specials"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setBonuses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), status: doc.data().status || [] })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // ✅ 自定義成功彈窗邏輯
    const triggerSuccessToast = () => {
        setShowSuccess(true);
        Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.delay(2000),
            Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true })
        ]).start(() => setShowSuccess(false));
    };

    const submitReport = async (state: string) => {
        if (!reportCinema.trim()) return;
        
        const now = new Date();
        const timeString = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        try {
            const docRef = doc(db, "specials", selectedItem.id);
            await updateDoc(docRef, { 
                status: arrayUnion({ 
                    cinema: reportCinema, 
                    state: state,
                    time: timeString 
                }) 
            });
            setModalVisible(false);
            setReportCinema('');
            triggerSuccessToast();
        } catch (e) {
            console.error(e);
        }
    };

    const handleImagePress = useCallback((uri: string) => {
        setSelectedImage(uri);
        setImageModalVisible(true);
    }, []);

    if (!fontsLoaded || loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', backgroundColor: theme.bg }]}>
                <ActivityIndicator size="large" color={theme.accent} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            
            {/* ✅ 美化後的成功訊息欄 */}
            {showSuccess && (
                <Animated.View style={[styles.successToast, { opacity: fadeAnim, backgroundColor: theme.card, borderColor: theme.accent + '44' }]}>
                    <Text style={[styles.successToastText, { color: theme.text, fontFamily: theme.font }]}>
                        ✨ 感謝您的熱心回報！
                    </Text>
                </Animated.View>
            )}

            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.header}>
                    <View>
                        <Text style={[styles.title, { color: theme.text, fontFamily: theme.font }]}>特典情報站</Text>
                        <Text style={[styles.subtitle, { color: theme.subText, fontFamily: theme.font }]}>即時庫存分享系統</Text>
                    </View>
                    <View style={[styles.countBadge, { backgroundColor: theme.badge }]}>
                        <Text style={[styles.countText, { fontFamily: theme.font }]}>{bonuses.length}</Text>
                    </View>
                </View>

                <FlatList
                    data={bonuses}
                    renderItem={({ item }) => (
                        <BonusCard 
                            item={item} 
                            theme={theme} 
                            onReport={(i: any) => { setSelectedItem(i); setModalVisible(true); }}
                            onImagePress={handleImagePress}
                        />
                    )}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                />
            </SafeAreaView>

            {/* 查看大圖 Modal */}
            <Modal visible={imageModalVisible} transparent={true} animationType="fade">
                <View style={styles.imageFullOverlay}>
                    <TouchableOpacity style={styles.fullImageClose} onPress={() => setImageModalVisible(false)}>
                        <Text style={[styles.fullImageCloseText, { fontFamily: theme.font }]}>✕ 關閉</Text>
                    </TouchableOpacity>
                    <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />
                </View>
            </Modal>

            {/* 回報 Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                        <View style={styles.modalHandle} />
                        <Text style={[styles.modalTitle, { color: theme.text, fontFamily: theme.font }]}>回報現場庫存</Text>
                        <Text style={[styles.selectedMovieText, { color: theme.subText, fontFamily: theme.font }]}>{selectedItem?.movieTitle}</Text>
                        
                        <TextInput
                            style={[styles.input, { 
                                color: theme.text, 
                                borderColor: isDark ? '#3A3A3C' : '#E5E5EA', 
                                backgroundColor: isDark ? '#1A1A1A' : '#F2F2F7',
                                fontFamily: theme.font
                            }]}
                            placeholder="在哪間影城？"
                            placeholderTextColor={theme.subText}
                            value={reportCinema}
                            onChangeText={setReportCinema}
                        />

                        <View style={styles.reportActionRow}>
                            <TouchableOpacity style={[styles.stateBtn, { backgroundColor: '#27ae60cc' }]} onPress={() => submitReport('庫存充足')}>
                                <Text style={[styles.stateBtnText, { fontFamily: theme.font }]}>🟢 還有貨</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.stateBtn, { backgroundColor: '#c0392bcc' }]} onPress={() => submitReport('已領完')}>
                                <Text style={[styles.stateBtnText, { fontFamily: theme.font }]}>🔴 沒貨了</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                            <Text style={[styles.closeBtnText, { color: theme.subText, fontFamily: theme.font }]}>取消返回</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 25, paddingTop: 50, paddingBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    title: { fontSize: 36 },
    subtitle: { fontSize: 13, marginTop: 4 },
    countBadge: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10 },
    countText: { color: '#FFF', fontSize: 12 },
    listContainer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 40 },
    
    // ✅ 亮光效果核心設定
    card: { 
        borderRadius: 24, 
        marginBottom: 20, 
        shadowOpacity: 0.15, 
        shadowRadius: 12, 
        shadowOffset: { width: 0, height: 0 }, 
        elevation: 5,
        overflow: 'visible' 
    },
    bonusHeader: { flexDirection: 'row', padding: 18 },
    bonusImage: { width: 100, height: 145, borderRadius: 15 },
    zoomIcon: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(255,255,255,0.6)', padding: 3, borderRadius: 4 },
    bonusInfo: { flex: 1, marginLeft: 16 },
    infoTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    cinemaBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    cinemaBadgeText: { color: '#FFF', fontSize: 11 },
    movieTitle: { fontSize: 19, fontWeight: '700', marginBottom: 6 },
    bonusName: { fontSize: 14, lineHeight: 20 },
    
    statusSection: { padding: 16, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderRadius: 24, borderTopWidth: 0.5, borderColor: 'rgba(120,120,120,0.1)' },
    statusHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    statusTitle: { fontSize: 13 },
    statusHint: { fontSize: 10 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, padding: 10, borderRadius: 12, backgroundColor: 'rgba(150,150,150,0.03)' },
    dot: { width: 6, height: 6, borderRadius: 3, marginRight: 10 },
    cinemaText: { fontSize: 14, fontWeight: '600' },
    timeText: { fontSize: 10, marginTop: 1 }, 
    statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, marginLeft: 10 },
    statusBadgeText: { fontSize: 11, fontWeight: 'bold' },
    emptyStatusText: { fontSize: 12, textAlign: 'center', marginVertical: 8, fontStyle: 'italic' },
    reportButton: { marginTop: 10, padding: 12, borderRadius: 14, alignItems: 'center' },
    reportButtonText: { fontWeight: '600', fontSize: 14 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, alignItems: 'center', paddingBottom: 50 },
    modalHandle: { width: 35, height: 4, backgroundColor: '#8E8E9366', borderRadius: 2, marginBottom: 15 },
    modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
    selectedMovieText: { fontSize: 14, marginBottom: 20, textAlign: 'center' },
    input: { width: '100%', borderWidth: 1, borderRadius: 15, padding: 15, marginBottom: 15, fontSize: 15 },
    reportActionRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 20 },
    stateBtn: { flex: 0.48, padding: 18, borderRadius: 18, alignItems: 'center' },
    stateBtnText: { color: '#FFF', fontSize: 15 },
    closeBtn: { padding: 10 },
    closeBtnText: { fontSize: 15 },

    // ✅ 美化訊息欄樣式
    successToast: {
        position: 'absolute',
        top: 60,
        alignSelf: 'center',
        zIndex: 999,
        paddingHorizontal: 25,
        paddingVertical: 15,
        borderRadius: 25,
        borderWidth: 1,
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    successToastText: { fontSize: 16, fontWeight: '600' },

    imageFullOverlay: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: width, height: height * 0.75 },
    fullImageClose: { position: 'absolute', top: 50, right: 25, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', padding: 10, borderRadius: 20 },
    fullImageCloseText: { color: 'white' }
});