//電影特典庫存回報頁面
import { ZenKurenaido_400Regular, useFonts } from '@expo-google-fonts/zen-kurenaido';
import { arrayUnion, collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { AnimatePresence, MotiView } from 'moti';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    Modal,
    Pressable,
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

const getStatusColor = (state: string) => {
    switch (state) {
        case '庫存充足': return '#2ecc71';
        case '已領完': return '#e74c3c';
        default: return '#95a5a6';
    }
};

const BonusCard = React.memo(({ item, index, theme, onReport, onImagePress }: any) => {
    return (
        <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: index * 100, type: 'timing', duration: 500 }}
            style={[
                styles.card,
                {
                    backgroundColor: theme.card,
                    shadowColor: theme.isDark ? '#000' : '#A0A0A0',
                }
            ]}
        >
            {/* 微光掃過動畫層 */}
            <MotiView
                from={{ translateX: -width }}
                animate={{ translateX: width }}
                transition={{
                    loop: true,
                    duration: 3000,
                    delay: 1000,
                    repeatReverse: false,
                    type: 'timing',
                }}
                style={[
                    styles.shimmerEffect,
                    { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.4)' }
                ]}
            />

            <View style={styles.bonusHeader}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => onImagePress(item.image)} style={styles.imageContainer}>
                    <Image source={{ uri: item.image }} style={styles.bonusImage} resizeMode="cover" />
                    <View style={styles.zoomIcon}>
                        <Text style={[styles.zoomText, { fontFamily: theme.font }]}>🔍 放大</Text>
                    </View>
                </TouchableOpacity>

                <View style={styles.bonusInfo}>
                    <View style={[styles.cinemaBadge, { backgroundColor: theme.accent + '15' }]}>
                        <Text style={[styles.cinemaBadgeText, { color: theme.accent, fontFamily: theme.font }]}>{item.cinema}</Text>
                    </View>
                    <Text numberOfLines={1} style={[styles.movieTitle, { color: theme.text, fontFamily: theme.font }]}>{item.movieTitle}</Text>
                    <Text numberOfLines={2} style={[styles.bonusName, { color: theme.subText, fontFamily: theme.font }]}>{item.bonusName}</Text>
                </View>
            </View>

            <View style={[styles.statusSection, { backgroundColor: theme.isDark ? '#252528' : '#FBFBFC' }]}>
                <View style={styles.statusHeaderRow}>
                    <Text style={[styles.statusTitle, { color: theme.text, fontFamily: theme.font }]}>📍 現場情報</Text>
                    <Text style={[styles.statusHint, { color: theme.subText, fontFamily: theme.font }]}>最新兩筆回報</Text>
                </View>

                {item.status && item.status.length > 0 ? (
                    item.status.slice(-2).reverse().map((st: any, idx: number) => (
                        <View key={idx} style={styles.statusRow}>
                            <MotiView
                                from={{ opacity: 0.4 }}
                                animate={{ opacity: 1 }}
                                transition={{ loop: true, duration: 1000, type: 'timing' }}
                                style={[styles.dot, { backgroundColor: getStatusColor(st.state) }]}
                            />
                            <View style={{ flex: 1 }}>
                                <Text numberOfLines={1} style={[styles.cinemaText, { color: theme.text, fontFamily: theme.font }]}>{st.cinema}</Text>
                                <Text style={[styles.timeText, { color: theme.subText, fontFamily: theme.font }]}>🕒 {st.time}</Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(st.state) + '20' }]}>
                                <Text style={[styles.statusBadgeText, { color: getStatusColor(st.state), fontFamily: theme.font }]}>{st.state}</Text>
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyStatusContainer}>
                        <Text style={[styles.emptyStatusText, { color: theme.subText, fontFamily: theme.font }]}>目前暫無情報，首位回報者就是你！</Text>
                    </View>
                )}

                <TouchableOpacity
                    activeOpacity={0.7}
                    style={[styles.reportButton, { backgroundColor: theme.accent }]}
                    onPress={() => onReport(item)}
                >
                    <Text style={[styles.reportButtonText, { color: '#FFF', fontFamily: theme.font }]}>✍️ 我要回報庫存</Text>
                </TouchableOpacity>
            </View>
        </MotiView>
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
    const [showSuccess, setShowSuccess] = useState(false);

    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const [fontsLoaded] = useFonts({ ZenKurenaido_400Regular });

    const theme = useMemo(() => ({
        isDark,
        bg: isDark ? '#0F0F10' : '#F6F7F9',
        card: isDark ? '#1C1C1E' : '#FFFFFF',
        text: isDark ? '#F2F2F7' : '#1C1C1E',
        subText: isDark ? '#8E8E93' : '#8E8E93',
        accent: '#D63031',
        badge: isDark ? '#3A3A3C' : '#E5E5EA',
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

    const submitReport = async (state: string) => {
        if (!reportCinema.trim()) return;
        const now = new Date();
        const timeString = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        try {
            const docRef = doc(db, "specials", selectedItem.id);
            await updateDoc(docRef, { 
                status: arrayUnion({ cinema: reportCinema, state: state, time: timeString }) 
            });
            setModalVisible(false);
            setReportCinema('');
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2500);
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
            
            <AnimatePresence>
                {showSuccess && (
                    <MotiView 
                        from={{ opacity: 0, translateY: -50 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        exit={{ opacity: 0, translateY: -50 }}
                        style={[styles.successToast, { backgroundColor: theme.card }]}
                    >
                        <Text style={[styles.successToastText, { color: "#2ecc71", fontFamily: 'ZenKurenaido_400Regular '}]}>✨ 感謝回報！情報已更新</Text>
                    </MotiView>
                )}
            </AnimatePresence>

            <SafeAreaView style={{ flex: 1 }}>
                <MotiView 
                    from={{ opacity: 0, translateX: -20 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    style={styles.header}
                >
                    <View>
                        <Text style={[styles.title, { color: theme.text, fontFamily: theme.font }]}>特典情報站</Text>
                        <Text style={[styles.subtitle, { color: theme.subText, fontFamily: theme.font }]}>電影愛好者的即時庫存互助網</Text>
                    </View>
                    <View style={[styles.countBadge, { backgroundColor: theme.accent }]}>
                        <Text style={[styles.countText, { fontFamily: theme.font }]}>{bonuses.length}</Text>
                    </View>
                </MotiView>

                <FlatList
                    data={bonuses}
                    renderItem={({ item, index }) => (
                        <BonusCard 
                            item={item} 
                            index={index}
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

            <Modal visible={imageModalVisible} transparent={true} animationType="fade">
                <Pressable style={styles.imageFullOverlay} onPress={() => setImageModalVisible(false)}>
                    <MotiView from={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={styles.fullImageContainer}>
                        <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />
                        <TouchableOpacity style={styles.fullImageClose} onPress={() => setImageModalVisible(false)}>
                            <Text style={[styles.fullImageCloseText, { fontFamily: theme.font }]}>✕</Text>
                        </TouchableOpacity>
                    </MotiView>
                </Pressable>
            </Modal>

            <Modal visible={modalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <MotiView from={{ translateY: 300 }} animate={{ translateY: 0 }} style={[styles.modalContent, { backgroundColor: theme.card }]}>
                        <View style={styles.modalHandle} />
                        <Text style={[styles.modalTitle, { color: theme.text, fontFamily: theme.font }]}>回報庫存</Text>
                        <Text style={[styles.selectedMovieText, { color: theme.subText, fontFamily: theme.font }]}>{selectedItem?.movieTitle}</Text>
                        
                        <TextInput
                            style={[styles.input, { color: theme.text, borderColor: theme.badge, backgroundColor: theme.isDark ? '#2C2C2E' : '#F2F2F7', fontFamily: theme.font }]}
                            placeholder="輸入影城名稱"
                            placeholderTextColor={theme.subText}
                            value={reportCinema}
                            onChangeText={setReportCinema}
                        />

                        <View style={styles.reportActionRow}>
                            <TouchableOpacity style={[styles.stateBtn, { backgroundColor: '#2ecc71' }]} onPress={() => submitReport('庫存充足')}>
                                <Text style={[styles.stateBtnText, { fontFamily: theme.font }]}>🟢 還有貨</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.stateBtn, { backgroundColor: '#e74c3c' }]} onPress={() => submitReport('已領完')}>
                                <Text style={[styles.stateBtnText, { fontFamily: theme.font }]}>🔴 沒貨了</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                            <Text style={[styles.closeBtnText, { color: theme.subText, fontFamily: theme.font }]}>取消</Text>
                        </TouchableOpacity>
                    </MotiView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 25, paddingTop: 40, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 32 },
    subtitle: { fontSize: 13, marginTop: 2 },
    countBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    countText: { color: '#FFF', fontSize: 14 },
    listContainer: { paddingHorizontal: 16, paddingBottom: 100 },
    
    card: { 
        borderRadius: 28, 
        marginBottom: 20, 
        shadowOpacity: 0.1, 
        shadowRadius: 15, 
        shadowOffset: { width: 0, height: 8 }, 
        elevation: 6,
        borderWidth: 1,
        borderColor: 'rgba(150,150,150,0.1)',
        overflow: 'hidden', // 必須開啟，否則掃光會超出卡片
    },
    // 💡 掃光樣式
    shimmerEffect: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 100,
        transform: [{ skewX: '-20deg' }],
        zIndex: 1,
    },
    bonusHeader: { flexDirection: 'row', padding: 20, zIndex: 2 },
    imageContainer: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
    bonusImage: { width: 90, height: 130, borderRadius: 16 },
    zoomIcon: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
    zoomText: { fontSize: 10, color: '#333' },
    bonusInfo: { flex: 1, marginLeft: 18, justifyContent: 'center' },
    cinemaBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 8 },
    cinemaBadgeText: { fontSize: 11},
    movieTitle: { fontSize: 20,  marginBottom: 6 },
    bonusName: { fontSize: 14, lineHeight: 20 },
    
    statusSection: { padding: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, zIndex: 2 },
    statusHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    statusTitle: { fontSize: 14 },
    statusHint: { fontSize: 11 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, padding: 12, borderRadius: 16, backgroundColor: 'rgba(150,150,150,0.05)' },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
    cinemaText: { fontSize: 15 },
    timeText: { fontSize: 11, marginTop: 2 }, 
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusBadgeText: { fontSize: 12 },
    emptyStatusContainer: { paddingVertical: 15, alignItems: 'center' },
    emptyStatusText: { fontSize: 13, fontStyle: 'italic', opacity: 0.7 },
    reportButton: { marginTop: 10, padding: 16, borderRadius: 18, alignItems: 'center' },
    reportButtonText: {  fontSize: 15 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 30, alignItems: 'center', paddingBottom: 60 },
    modalHandle: { width: 40, height: 5, backgroundColor: '#8E8E9344', borderRadius: 3, marginBottom: 20 },
    modalTitle: { fontSize: 24,  marginBottom: 8 },
    selectedMovieText: { fontSize: 15, marginBottom: 25, textAlign: 'center' },
    input: { width: '100%', borderRadius: 18, padding: 18, marginBottom: 20, fontSize: 16, borderWidth: 1 },
    reportActionRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 25 },
    stateBtn: { flex: 0.48, padding: 20, borderRadius: 20, alignItems: 'center' },
    stateBtnText: { color: '#FFF', fontSize: 16 },
    closeBtn: { padding: 10 },
    closeBtnText: { fontSize: 16 },

    successToast: {
        position: 'absolute',
        top: 60,
        alignSelf: 'center',
        zIndex: 9999,
        paddingHorizontal: 30,
        paddingVertical: 18,
        borderRadius: 30,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 15,
    },
    successToastText: { fontSize: 16, fontWeight: '800' },

    imageFullOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    fullImageContainer: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: width, height: height * 0.8 },
    fullImageClose: { position: 'absolute', top: 50, right: 30, backgroundColor: 'rgba(255,255,255,0.2)', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    fullImageCloseText: { color: 'white', fontSize: 2}
});