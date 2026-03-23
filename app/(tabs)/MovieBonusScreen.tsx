import { useFonts, ZenKurenaido_400Regular } from '@expo-google-fonts/zen-kurenaido';
import { arrayUnion, collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList, Image, Modal, SafeAreaView, StatusBar, StyleSheet,
    Text, TextInput,
    TouchableOpacity, useColorScheme, View
} from 'react-native';
import { db } from './firebaseConfig';

const { width } = Dimensions.get('window');

// 💡 庫存顏色與邏輯
const getStatusColor = (state: string) => {
    switch (state) {
        case '庫存充足': return '#00C853';
        case '已領完': return '#FF5252';
        default: return '#9E9E9E';
    }
};

const BonusCard = React.memo(({ item, theme, onReport }: { item: any; theme: any; onReport: any }) => {
    return (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.bonusHeader}>
                <Image source={{ uri: item.image }} style={styles.bonusImage} resizeMode="cover" />
                <View style={styles.bonusInfo}>
                    <View style={styles.cinemaBadge}>
                        <Text style={[styles.cinemaBadgeText, { fontFamily: theme.font }]}>{item.cinema}</Text>
                    </View>
                    <Text numberOfLines={1} style={[styles.movieTitle, { color: theme.text, fontFamily: theme.font }]}>
                        {item.movieTitle}
                    </Text>
                    <Text numberOfLines={2} style={[styles.bonusName, { color: theme.accent, fontFamily: theme.font }]}>
                        {item.bonusName}
                    </Text>
                    <View style={styles.metaInfo}>
                        <Text style={[styles.dateText, { color: theme.subText, fontFamily: theme.font }]}>📅 {item.startDate}</Text>
                    </View>
                </View>
            </View>

            <View style={[styles.statusSection, { backgroundColor: theme.isDark ? '#252525' : '#FAFAFA' }]}>
                <Text style={[styles.statusTitle, { color: theme.subText, fontFamily: theme.font }]}>即時庫存狀況</Text>
                
                {item.status.length > 0 ? (
                    item.status.slice(-2).reverse().map((st: any, idx: number) => (
                        <View key={idx} style={styles.statusRow}>
                            <Text numberOfLines={1} style={[styles.cinemaText, { color: theme.text, fontFamily: theme.font }]}>{st.cinema}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(st.state) }]}>
                                <Text style={[styles.statusBadgeText, { fontFamily: theme.font }]}>{st.state}</Text>
                            </View>
                            <Text style={[styles.timeText, { color: theme.subText, fontFamily: theme.font }]}>{st.time}</Text>
                        </View>
                    ))
                ) : (
                    <Text style={[styles.emptyStatusText, { fontFamily: theme.font }]}>目前尚無回報</Text>
                )}

                <TouchableOpacity 
                    activeOpacity={0.7}
                    style={[styles.reportButton, { backgroundColor: theme.accent }]}
                    onPress={() => onReport(item)}
                >
                    <Text style={[styles.reportButtonText, { fontFamily: theme.font }]}>我要求報庫存</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
});

export default function MovieBonusScreen() {
    const [bonuses, setBonuses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [reportCinema, setReportCinema] = useState('');

    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const [fontsLoaded] = useFonts({ ZenKurenaido_400Regular });

    const theme = useMemo(() => ({
        isDark,
        bg: isDark ? '#121212' : '#F8F9FB',
        card: isDark ? '#1E1E1E' : '#FFFFFF',
        text: isDark ? '#E0E0E0' : '#2D3436',
        subText: isDark ? '#888888' : '#636E72',
        accent: '#FF2D55',
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
        if (!reportCinema.trim()) return Alert.alert("提示", "請輸入影城名稱");
        
        const now = new Date();
        const timeString = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
        
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
            Alert.alert("成功", "感謝您的回報！");
        } catch (e) {
            Alert.alert("錯誤", "回報失敗，請檢查網路");
        }
    };

    const handleReport = useCallback((item: any) => {
        setSelectedItem(item);
        setModalVisible(true);
    }, []);

    const renderItem = useCallback(({ item }: { item: any }) => (
        <BonusCard item={item} theme={theme} onReport={handleReport} />
    ), [theme, handleReport]);

    if (!fontsLoaded || loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', backgroundColor: theme.bg }]}>
                <ActivityIndicator size="large" color={theme.accent} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            <View style={styles.header}>
                <View>
                    <Text style={[styles.title, { color: theme.text, fontFamily: theme.font }]}>特典情報站</Text>
                    <Text style={[styles.subtitle, { color: theme.subText, fontFamily: theme.font }]}>即時回報與自動同步</Text>
                </View>
                <View style={[styles.countBadge, { backgroundColor: theme.accent }]}>
                    <Text style={styles.countText}>{bonuses.length}</Text>
                </View>
            </View>

            <FlatList
                data={bonuses}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                initialNumToRender={5}
            />

            <Modal visible={modalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.text, fontFamily: theme.font }]}>回報庫存</Text>
                        <Text style={[styles.selectedMovieText, { color: theme.accent, fontFamily: theme.font }]}>
                            {selectedItem?.movieTitle}
                        </Text>
                        
                        <TextInput
                            style={[styles.input, { color: theme.text, borderColor: theme.subText, fontFamily: theme.font }]}
                            placeholder="輸入影城名稱 (例如: 信義威秀)"
                            placeholderTextColor={theme.subText}
                            value={reportCinema}
                            onChangeText={setReportCinema}
                        />

                        <View style={styles.reportActionRow}>
                            <TouchableOpacity 
                                style={[styles.stateBtn, { backgroundColor: '#00C853' }]}
                                onPress={() => submitReport('庫存充足')}
                            >
                                <Text style={[styles.stateBtnText, { fontFamily: theme.font }]}>🟢 尚有</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.stateBtn, { backgroundColor: '#FF5252' }]}
                                onPress={() => submitReport('已領完')}
                            >
                                <Text style={[styles.stateBtnText, { fontFamily: theme.font }]}>🔴 已無</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                            <Text style={[styles.closeBtnText, { fontFamily: theme.font }]}>取消</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 34, fontWeight: 'bold' },
    subtitle: { fontSize: 14, opacity: 0.7 },
    countBadge: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
    countText: { color: '#FFF', fontWeight: 'bold' },
    listContainer: { paddingHorizontal: 20, paddingBottom: 30 },
    card: { borderRadius: 24, marginBottom: 20, elevation: 4, shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
    bonusHeader: { flexDirection: 'row', padding: 18 },
    bonusImage: { width: 100, height: 140, borderRadius: 16 },
    bonusInfo: { flex: 1, marginLeft: 16, justifyContent: 'space-between' },
    cinemaBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#636E72', borderRadius: 8 },
    cinemaBadgeText: { color: '#FFF', fontSize: 10 },
    movieTitle: { fontSize: 18, fontWeight: '700' },
    bonusName: { fontSize: 14 },
    metaInfo: { flexDirection: 'row' },
    dateText: { fontSize: 11 },
    statusSection: { padding: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    statusTitle: { fontSize: 12, marginBottom: 12, fontWeight: 'bold' },
    emptyStatusText: { fontSize: 12, textAlign: 'center', marginVertical: 10, opacity: 0.5 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    cinemaText: { flex: 1, fontSize: 14 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 10 },
    statusBadgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
    timeText: { fontSize: 11 },
    reportButton: { marginTop: 10, padding: 15, borderRadius: 18, alignItems: 'center' },
    reportButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 30, alignItems: 'center' },
    modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
    selectedMovieText: { fontSize: 16, marginBottom: 20, textAlign: 'center' },
    input: { width: '100%', borderWidth: 1.5, borderRadius: 15, padding: 15, marginBottom: 20, fontSize: 16 },
    reportActionRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 20 },
    stateBtn: { flex: 0.48, padding: 18, borderRadius: 15, alignItems: 'center' },
    stateBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
    closeBtn: { padding: 10 },
    closeBtnText: { fontSize: 16, color: '#888' }
});