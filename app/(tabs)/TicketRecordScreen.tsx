import { useFonts, ZenKurenaido_400Regular } from '@expo-google-fonts/zen-kurenaido';
import * as ImagePicker from 'expo-image-picker';
import {
    EmailAuthProvider,
    getAuth,
    linkWithCredential,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from 'firebase/auth';
import { addDoc, collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import {
    AlertCircle, Calendar, Camera, CheckCircle2, Film,
    Lock, LogOut, Mail, UserPlus, X
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Animated, Dimensions, FlatList, Image,
    Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity,
    TouchableWithoutFeedback, useColorScheme, View
} from 'react-native';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from './firebaseConfig';

const { width } = Dimensions.get('window');

export default function TicketRecordScreen() {
    const [fontsLoaded] = useFonts({ ZenKurenaido_400Regular });
    const auth = getAuth();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    // 動態顏色配置
    const Colors = {
        bg: isDark ? '#121212' : '#FAF9F6',
        card: isDark ? '#1E1E1E' : '#FFFFFF',
        text: isDark ? '#FFFFFF' : '#333333',
        subText: isDark ? '#AAAAAA' : '#999999',
        inputBg: isDark ? '#2C2C2C' : '#F8F8F8',
        border: isDark ? '#383838' : '#F0F0F0',
        primary: '#FF2D55',
        overlay: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.7)',
    };

    // 狀態
    const [user, setUser] = useState(auth.currentUser);
    const [image, setImage] = useState<string | null>(null);
    const [movieTitle, setMovieTitle] = useState('');
    const [note, setNote] = useState('');
    const [watchDate, setWatchDate] = useState(new Date());
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const [selectedLog, setSelectedLog] = useState<any>(null);
    const [detailVisible, setDetailVisible] = useState(false);

    // 帳號/登入相關
    const [authModalVisible, setAuthModalVisible] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authMode, setAuthMode] = useState<'login' | 'upgrade'>('upgrade');
    const [isProcessingAuth, setIsProcessingAuth] = useState(false);

    // Toast
    const [toastConfig, setToastConfig] = useState({ visible: false, message: '', type: 'success' });
    const translateY = useRef(new Animated.Value(-100)).current;

    // 監聽登入狀態
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currUser) => {
            setUser(currUser);
        });
        return unsubscribe;
    }, []);

    // 獲取資料
    useEffect(() => {
        if (!user) {
            setLogs([]);
            return;
        }
        const q = query(collection(db, "movieLogs"), where("uid", "==", user.uid), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [user]);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToastConfig({ visible: true, message, type });
        Animated.spring(translateY, { toValue: 60, useNativeDriver: true, tension: 20, friction: 5 }).start();
        setTimeout(() => {
            Animated.timing(translateY, { toValue: -100, duration: 300, useNativeDriver: true }).start(() => {
                setToastConfig(prev => ({ ...prev, visible: false }));
            });
        }, 3000);
    };

    const handleAuthAction = async () => {
        if (!email || !password) return showToast("請完整填寫欄位", "error");
        setIsProcessingAuth(true);
        try {
            if (authMode === 'upgrade' && user?.isAnonymous) {
                const credential = EmailAuthProvider.credential(email, password);
                await linkWithCredential(user, credential);
                showToast("帳號升級成功！");
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                showToast("歡迎回來！");
            }
            setAuthModalVisible(false);
            setEmail(''); setPassword('');
        } catch (error: any) {
            let msg = "執行失敗";
            if (error.code === 'auth/email-already-in-use') msg = "此 Email 已被註冊";
            if (error.code === 'auth/wrong-password') msg = "密碼錯誤";
            showToast(msg, "error");
        } finally {
            setIsProcessingAuth(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            showToast("已成功登出");
        } catch (e) {
            showToast("登出失敗", "error");
        }
    };

    const saveLog = async () => {
        if (!image || !movieTitle || !user) return;
        setUploading(true);
        try {
            const data = new FormData();
            data.append('file', { uri: image, type: 'image/jpeg', name: 'movie.jpg' } as any);
            data.append('upload_preset', 'movie_app');
            data.append('cloud_name', 'dgoq8r2pq');

            const response = await fetch('https://api.cloudinary.com/v1_1/dgoq8r2pq/image/upload', { method: 'POST', body: data });
            const result = await response.json();
            
            await addDoc(collection(db, "movieLogs"), {
                uid: user.uid,
                title: movieTitle,
                photoUrl: result.secure_url,
                note: note,
                watchDate: `${watchDate.getFullYear()}/${(watchDate.getMonth()+1).toString().padStart(2,'0')}/${watchDate.getDate().toString().padStart(2,'0')}`,
                createdAt: new Date(),
            });

            setImage(null); setMovieTitle(''); setNote('');
            showToast("紀錄收藏成功！");
        } catch (e) {
            showToast("儲存失敗", "error");
        } finally {
            setUploading(false);
        }
    };

    if (!fontsLoaded) return <ActivityIndicator style={{ flex: 1, backgroundColor: Colors.bg }} />;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: Colors.bg }]} edges={['top']}>
            
            {/* Toast */}
            <Animated.View style={[styles.toastContainer, { transform: [{ translateY }], backgroundColor: toastConfig.type === 'success' ? '#4BB543' : '#FF3B30' }]}>
                {toastConfig.type === 'success' ? <CheckCircle2 color="#FFF" size={20} /> : <AlertCircle color="#FFF" size={20} />}
                <Text style={styles.toastText}>{toastConfig.message}</Text>
            </Animated.View>

            {/* 登入 / 註冊升級 Modal */}
            <Modal animationType="slide" transparent visible={authModalVisible} onRequestClose={() => setAuthModalVisible(false)}>
                <View style={[styles.modalOverlay, { backgroundColor: Colors.overlay }]}>
                    <View style={[styles.upgradeContainer, { backgroundColor: Colors.card }]}>
                        <View style={styles.upgradeHeader}>
                            <UserPlus size={24} color={Colors.primary} />
                            <Text style={[styles.upgradeTitle, { color: Colors.text }]}>
                                {authMode === 'upgrade' ? '升級帳號' : '會員登入'}
                            </Text>
                            <TouchableOpacity onPress={() => setAuthModalVisible(false)}><X color={Colors.subText} size={24} /></TouchableOpacity>
                        </View>
                        
                        <View style={[styles.roundedInputWrapper, { backgroundColor: Colors.inputBg, borderColor: Colors.border }]}>
                            <Mail size={18} color={Colors.primary} />
                            <TextInput 
                                style={[styles.upgradeInput, { color: Colors.text }]} 
                                placeholder="電子信箱" 
                                placeholderTextColor={Colors.subText} 
                                value={email} 
                                onChangeText={setEmail} 
                                autoCapitalize="none" 
                            />
                        </View>
                        <View style={[styles.roundedInputWrapper, { backgroundColor: Colors.inputBg, borderColor: Colors.border }]}>
                            <Lock size={18} color={Colors.primary} />
                            <TextInput 
                                style={[styles.upgradeInput, { color: Colors.text }]} 
                                placeholder="密碼" 
                                placeholderTextColor={Colors.subText} 
                                value={password} 
                                onChangeText={setPassword} 
                                secureTextEntry 
                            />
                        </View>

                        <TouchableOpacity style={styles.upgradeBtn} onPress={handleAuthAction} disabled={isProcessingAuth}>
                            {isProcessingAuth ? <ActivityIndicator color="#FFF" /> : <Text style={styles.upgradeBtnText}>確認</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={{ marginTop: 20, alignItems: 'center' }} onPress={() => setAuthMode(authMode === 'login' ? 'upgrade' : 'login')}>
                            <Text style={styles.switchAuthText}>
                                {authMode === 'login' ? '還沒有帳號？去註冊/升級' : '已有正式帳號？點此登入'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* 詳情 Modal */}
            <Modal animationType="fade" transparent visible={detailVisible} onRequestClose={() => setDetailVisible(false)}>
                <View style={[styles.modalOverlay, { backgroundColor: Colors.overlay }]}>
                    <View style={[styles.modalDetailContainer, { backgroundColor: Colors.card }]}>
                        <TouchableOpacity style={styles.closeDetailBtn} onPress={() => setDetailVisible(false)}><X color="#FFF" size={24} /></TouchableOpacity>
                        <ScrollView bounces={false}>
                            <Image source={{ uri: selectedLog?.photoUrl }} style={styles.detailImage} />
                            <View style={styles.detailInfo}>
                                <Text style={[styles.detailTitle, { color: Colors.text }]}>{selectedLog?.title}</Text>
                                <View style={styles.detailDateRow}><Calendar size={14} color={Colors.primary} /><Text style={[styles.detailDate, { fontFamily: 'ZenKurenaido_400Regular' }]}>{selectedLog?.watchDate}</Text></View>
                                <View style={[styles.detailDivider, { backgroundColor: Colors.border }]} />
                                <Text style={[styles.detailNote, { color: Colors.text, opacity: 0.8 }]}>{selectedLog?.note || "這場電影沒有留下文字紀錄..."}</Text>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={{ flex: 1 }}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View>
                                    <Text style={[styles.headerTitle, { color: Colors.text }]}>觀影手札</Text>
                                    <Text style={[styles.headerSub, { color: Colors.subText }]}>紀錄每一場光影的感動</Text>
                                </View>
                                <View style={{ flexDirection: 'row' }}>
                                    {user?.isAnonymous ? (
                                        <TouchableOpacity style={[styles.anonymousBadge, { backgroundColor: isDark ? '#3D1C22' : '#FFF0F5' }]} onPress={() => { setAuthMode('upgrade'); setAuthModalVisible(true); }}>
                                            <UserPlus size={14} color={Colors.primary} />
                                            <Text style={styles.anonymousText}>註冊備份</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            {!user && (
                                                <TouchableOpacity style={{ marginRight: 15 }} onPress={() => { setAuthMode('login'); setAuthModalVisible(true); }}>
                                                    <Text style={styles.loginBtnText}>登入</Text>
                                                </TouchableOpacity>
                                            )}
                                            {user && (
                                                <TouchableOpacity onPress={handleLogout} style={styles.logoutIcon}>
                                                    <LogOut size={22} color={Colors.subText} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                            {/* 輸入區 */}
                            <View style={[styles.inputCard, { backgroundColor: Colors.card }]}>
                                <TouchableOpacity onPress={async () => {
                                    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [3, 4], quality: 0.6 });
                                    if (!result.canceled) setImage(result.assets[0].uri);
                                }} style={[styles.imagePickerArea, { backgroundColor: isDark ? '#252525' : '#FDF2F4' }]}>
                                    {image ? (
                                        <View style={{ width: '100%', height: '100%' }}>
                                            <Image source={{ uri: image }} style={styles.previewImg} />
                                            <TouchableOpacity style={styles.removeImg} onPress={() => setImage(null)}><X color="#FFF" size={16} /></TouchableOpacity>
                                        </View>
                                    ) : (
                                        <View style={styles.placeholder}>
                                            <Camera color={Colors.primary} size={42} strokeWidth={1} />
                                            <Text style={styles.placeholderText}>點擊上傳票根或劇照</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <View style={styles.formPadding}>
                                    <View style={[styles.roundedInputWrapper, { backgroundColor: Colors.inputBg, borderColor: Colors.border }]}>
                                        <Film size={18} color={Colors.primary} />
                                        <TextInput style={[styles.modernInput, { color: Colors.text }]} placeholder="電影名稱" placeholderTextColor={Colors.subText} value={movieTitle} onChangeText={setMovieTitle} />
                                    </View>

                                    <TouchableOpacity style={[styles.roundedInputWrapper, { backgroundColor: Colors.inputBg, borderColor: Colors.border }]} onPress={() => setDatePickerVisibility(true)}>
                                        <Calendar size={18} color={Colors.primary} />
                                        <Text style={[styles.modernInput, { color: Colors.text }]}>
                                            {`${watchDate.getFullYear()}/${(watchDate.getMonth()+1).toString().padStart(2,'0')}/${watchDate.getDate().toString().padStart(2,'0')}`}
                                        </Text>
                                        <Text style={styles.editLabel}>修改</Text>
                                    </TouchableOpacity>

                                    <TextInput style={[styles.modernNoteInput, { backgroundColor: Colors.inputBg, color: Colors.text, borderColor: Colors.border }]} placeholder="寫下此刻的心得..." placeholderTextColor={Colors.subText} multiline value={note} onChangeText={setNote} />

                                    <TouchableOpacity onPress={saveLog} disabled={uploading || !image || !movieTitle} style={[styles.mainSaveBtn, { opacity: (image && movieTitle) ? 1 : 0.5 }]}>
                                        {uploading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.mainSaveBtnText}>收藏這段光影</Text>}
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* 列表區 */}
                            <Text style={[styles.listTitle, { color: Colors.text }]}>時光長廊</Text>
                            {logs.length === 0 ? (
                                <Text style={styles.emptyText}>尚無紀錄，開始你的第一場電影吧！</Text>
                            ) : (
                                <FlatList
                                    data={logs}
                                    keyExtractor={(item) => item.id}
                                    horizontal
                                    contentContainerStyle={styles.horizontalList}
                                    showsHorizontalScrollIndicator={false}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity activeOpacity={0.9} onPress={() => { setSelectedLog(item); setDetailVisible(true); }} style={[styles.logCard, { backgroundColor: Colors.card }]}>
                                            <Image source={{ uri: item.photoUrl }} style={styles.logImage} />
                                            <View style={styles.cardInfo}>
                                                <Text style={[styles.cardTitle, { color: Colors.text }]} numberOfLines={1}>{item.title}</Text>
                                                <Text style={[styles.cardDate, { color: Colors.subText }]}>{item.watchDate}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                />
                            )}
                            <View style={{ height: 100 }} />
                        </ScrollView>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>

            <DateTimePickerModal isVisible={isDatePickerVisible} mode="date" onConfirm={(date) => { setWatchDate(date); setDatePickerVisibility(false); }} onCancel={() => setDatePickerVisibility(false)} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 25, paddingVertical: 20 },
    headerTitle: { fontSize: 34, fontFamily: 'ZenKurenaido_400Regular' },
    headerSub: { fontSize: 14, fontFamily: 'ZenKurenaido_400Regular', marginTop: 4 },
    toastContainer: { position: 'absolute', top: 0, left: 20, right: 20, height: 55, borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, zIndex: 9999, elevation: 10 },
    toastText: { color: '#FFF', marginLeft: 10, fontWeight: '600', fontSize: 15, fontFamily: 'ZenKurenaido_400Regular' },
    inputCard: { marginHorizontal: 20, borderRadius: 30, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15 },
    imagePickerArea: { width: '100%', height: 240, justifyContent: 'center', alignItems: 'center' },
    previewImg: { width: '100%', height: '100%', resizeMode: 'cover' },
    removeImg: { position: 'absolute', top: 15, right: 15, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 6 },
    placeholder: { justifyContent: 'center', alignItems: 'center' },
    placeholderText: { marginTop: 10, color: '#FF2D55', fontFamily: 'ZenKurenaido_400Regular', fontSize: 15 },
    formPadding: { padding: 20 },
    roundedInputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 15, paddingHorizontal: 15, height: 50, marginBottom: 12, borderWidth: 1 },
    modernInput: { flex: 1, marginLeft: 10, fontSize: 16, fontFamily: 'ZenKurenaido_400Regular' },
    modernNoteInput: { borderRadius: 15, padding: 15, fontSize: 16, fontFamily: 'ZenKurenaido_400Regular', height: 80, textAlignVertical: 'top', borderWidth: 1 },
    mainSaveBtn: { backgroundColor: '#FF2D55', marginTop: 15, height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    mainSaveBtnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', fontFamily: 'ZenKurenaido_400Regular' },
    listTitle: { fontSize: 22, marginLeft: 25, marginTop: 30, marginBottom: 15, fontFamily: 'ZenKurenaido_400Regular' },
    horizontalList: { paddingLeft: 25, paddingVertical: 10 },
    logCard: { marginRight: 15, width: 140, borderRadius: 20, overflow: 'hidden', elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
    logImage: { width: '100%', height: 180, resizeMode: 'cover' },
    cardInfo: { padding: 10 },
    cardTitle: { fontSize: 14, fontFamily: 'ZenKurenaido_400Regular' },
    cardDate: { fontSize: 11, marginTop: 4, fontFamily: 'ZenKurenaido_400Regular' },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalDetailContainer: { width: width * 0.9, height: '80%', borderRadius: 30, overflow: 'hidden' },
    closeDetailBtn: { position: 'absolute', top: 20, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 20 },
    detailImage: { width: '100%', height: 300 },
    detailInfo: { padding: 25 },
    detailTitle: { fontSize: 28, fontFamily: 'ZenKurenaido_400Regular' },
    detailDateRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
    detailDate: { marginLeft: 6, fontSize: 14, color: '#FF2D55' },
    detailDivider: { height: 1, marginVertical: 15, opacity: 0.2 },
    detailNote: { fontSize: 18, lineHeight: 28, fontFamily: 'ZenKurenaido_400Regular' },
    upgradeContainer: { width: width * 0.85, borderRadius: 25, padding: 25, elevation: 20 },
    upgradeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    upgradeTitle: { fontSize: 20, fontFamily: 'ZenKurenaido_400Regular' },
    upgradeInput: { flex: 1, marginLeft: 10, fontSize: 16, fontFamily: 'ZenKurenaido_400Regular' },
    upgradeBtn: { backgroundColor: '#FF2D55', height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
    upgradeBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'ZenKurenaido_400Regular' },
    switchAuthText: { color: '#FF2D55', fontWeight: '600', fontFamily: 'ZenKurenaido_400Regular' },
    loginBtnText: { color: '#FF2D55', fontWeight: '600', fontFamily: 'ZenKurenaido_400Regular' },
    anonymousBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    anonymousText: { marginLeft: 5, color: '#FF2D55', fontSize: 12, fontFamily: 'ZenKurenaido_400Regular'},
    emptyText: { textAlign: 'center', color: '#999999', marginTop: 20, fontFamily: 'ZenKurenaido_400Regular' },
    logoutIcon: { padding: 5 },
    editLabel: { color: '#FF2D55', fontSize: 12, fontFamily: 'ZenKurenaido_400Regular' },
    scrollContent: { paddingBottom: 60 }
});