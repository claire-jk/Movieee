//電影票根回憶錄
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
    Image as ImageIcon,
    LogOut,
    UserPlus, X
} from 'lucide-react-native';
import { AnimatePresence, MotiText, MotiView } from 'moti';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, Dimensions, FlatList, Image,
    KeyboardAvoidingView, Modal, Platform, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity,
    useColorScheme, View
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

    const Colors = useMemo(() => ({
        bg: isDark ? '#0F0F10' : '#F8F9FA',
        card: isDark ? '#1C1C1E' : '#FFFFFF',
        text: isDark ? '#FFFFFF' : '#2D3436',
        subText: isDark ? '#A0A0A5' : '#636E72',
        inputBg: isDark ? '#252527' : '#F1F3F5',
        border: isDark ? '#3A3A3C' : '#E9ECEF',
        primary: '#FF2D55',
        secondary: '#5856D6',
        overlay: 'rgba(0,0,0,0.85)',
    }), [isDark]);

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
    const [authModalVisible, setAuthModalVisible] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authMode, setAuthMode] = useState<'login' | 'upgrade'>('upgrade');
    const [isProcessingAuth, setIsProcessingAuth] = useState(false);
    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currUser) => setUser(currUser));
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!user) { setLogs([]); return; }
        const q = query(collection(db, "movieLogs"), where("uid", "==", user.uid), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [user]);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ visible: true, message, type });
        setTimeout(() => setToast({ visible: false, message: '', type: 'success' }), 3000);
    };

    const handleAuthAction = async () => {
        if (!email || !password) return showToast("請填寫完整資訊", "error");
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
        } catch (error: any) {
            showToast("認證失敗，請檢查輸入", "error");
        } finally {
            setIsProcessingAuth(false);
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
            showToast("時光已珍藏");
        } catch (e) {
            showToast("珍藏失敗", "error");
        } finally {
            setUploading(false);
        }
    };

    if (!fontsLoaded) return <ActivityIndicator style={{ flex: 1, backgroundColor: Colors.bg }} />;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: Colors.bg }]} edges={['top']}>
            
            {/* 動態 Toast */}
            <AnimatePresence>
                {toast.visible && (
                    <MotiView
                        from={{ opacity: 0, translateY: -50, scale: 0.9 }}
                        animate={{ opacity: 1, translateY: 20, scale: 1 }}
                        exit={{ opacity: 0, translateY: -50, scale: 0.9 }}
                        style={[styles.toast, { backgroundColor: toast.type === 'success' ? '#4BB543' : Colors.primary }]}
                    >
                        {toast.type === 'success' ? <CheckCircle2 color="#FFF" size={20} /> : <AlertCircle color="#FFF" size={20} />}
                        <Text style={styles.toastText}>{toast.message}</Text>
                    </MotiView>
                )}
            </AnimatePresence>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <MotiText 
                                from={{ opacity: 0, transform: [{ translateX: -20 }] }} 
                                animate={{ opacity: 1, transform: [{ translateX: 0 }] }}
                                style={[styles.headerTitle, { color: Colors.text }]}
                            >觀影手札</MotiText>
                            <Text style={[styles.headerSub, { color: Colors.subText }]}>紀錄每一場光影的感動</Text>
                        </View>
                        <TouchableOpacity 
                            onPress={user?.isAnonymous ? () => { setAuthMode('upgrade'); setAuthModalVisible(true); } : (user ? () => signOut(auth) : () => setAuthModalVisible(true))}
                            style={[styles.userBadge, { backgroundColor: Colors.card }]}
                        >
                            {user?.isAnonymous ? <UserPlus size={18} color={Colors.primary} /> : <LogOut size={18} color={Colors.subText} />}
                        </TouchableOpacity>
                    </View>

                    {/* 輸入卡片 - 增強視覺層次 */}
                    <MotiView 
                        from={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'timing', duration: 500 }}
                        style={[styles.inputCard, { backgroundColor: Colors.card, shadowColor: Colors.primary }]}
                    >
                        <TouchableOpacity 
                            activeOpacity={0.8}
                            onPress={async () => {
                                let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [3, 4], quality: 0.6 });
                                if (!result.canceled) setImage(result.assets[0].uri);
                            }} 
                            style={[styles.imagePickerArea, { backgroundColor: isDark ? '#252525' : '#FDF2F4', borderStyle: image ? 'solid' : 'dashed' }]}
                        >
                            {image ? (
                                <View style={styles.fullSize}>
                                    <Image source={{ uri: image }} style={styles.previewImg} />
                                    <TouchableOpacity style={styles.removeImg} onPress={() => setImage(null)}><X color="#FFF" size={16} /></TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.placeholder}>
                                    <Camera color={Colors.primary} size={42} strokeWidth={1} />
                                    <Text style={[styles.placeholderText, { color: Colors.primary }]}>捕捉票根或劇照</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <View style={styles.formPadding}>
                            <View style={[styles.inputRow, { backgroundColor: Colors.inputBg }]}>
                                <Film size={18} color={Colors.primary} />
                                <TextInput 
                                    style={[styles.textInput, { color: Colors.text }]} 
                                    placeholder="電影名稱" 
                                    placeholderTextColor={Colors.subText} 
                                    value={movieTitle} 
                                    onChangeText={setMovieTitle} 
                                />
                            </View>

                            <TouchableOpacity 
                                style={[styles.inputRow, { backgroundColor: Colors.inputBg }]} 
                                onPress={() => setDatePickerVisibility(true)}
                            >
                                <Calendar size={18} color={Colors.primary} />
                                <Text style={[styles.textInput, { color: Colors.text }]}>
                                    {watchDate.toLocaleDateString()}
                                </Text>
                                <Text style={styles.editLabel}>修改日期</Text>
                            </TouchableOpacity>

                            <TextInput 
                                style={[styles.noteInput, { backgroundColor: Colors.inputBg, color: Colors.text }]} 
                                placeholder="此刻的想法是..." 
                                placeholderTextColor={Colors.subText} 
                                multiline 
                                value={note} 
                                onChangeText={setNote} 
                            />

                            <TouchableOpacity 
                                onPress={saveLog} 
                                disabled={uploading || !image || !movieTitle} 
                                style={[styles.saveBtn, { backgroundColor: (image && movieTitle) ? Colors.primary : Colors.border }]}
                            >
                                {uploading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>收藏這段回憶</Text>}
                            </TouchableOpacity>
                        </View>
                    </MotiView>

                    {/* 列表標題 */}
                    <Text style={[styles.listTitle, { color: Colors.text }]}>時光長廊</Text>

                    {/* 橫向列表 - 增加卡片進入動畫 */}
                    {logs.length === 0 ? (
                        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.emptyContainer}>
                            <ImageIcon size={48} color={Colors.border} />
                            <Text style={[styles.emptyText, { color: Colors.subText }]}>尚無紀錄，點擊上方開始紀錄</Text>
                        </MotiView>
                    ) : (
                        <FlatList
                            data={logs}
                            keyExtractor={(item) => item.id}
                            horizontal
                            contentContainerStyle={styles.horizontalList}
                            showsHorizontalScrollIndicator={false}
                            renderItem={({ item, index }) => (
                                <MotiView
                                    from={{ opacity: 0, transform: [{ translateX: 50 }] }}
                                    animate={{ opacity: 1, transform: [{ translateX: 0 }] }}
                                    transition={{ delay: index * 100 }}
                                >
                                    <TouchableOpacity 
                                        activeOpacity={0.9} 
                                        onPress={() => { setSelectedLog(item); setDetailVisible(true); }} 
                                        style={[styles.logCard, { backgroundColor: Colors.card }]}
                                    >
                                        <Image source={{ uri: item.photoUrl }} style={styles.logImage} />
                                        <View style={styles.cardOverlay}>
                                            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                                            <Text style={styles.cardDate}>{item.watchDate}</Text>
                                        </View>
                                    </TouchableOpacity>
                                </MotiView>
                            )}
                        />
                    )}
                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* 詳情 Modal */}
            <Modal animationType="fade" transparent visible={detailVisible} onRequestClose={() => setDetailVisible(false)}>
                <View style={[styles.modalOverlay, { backgroundColor: Colors.overlay }]}>
                    <MotiView 
                        from={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={[styles.detailContent, { backgroundColor: Colors.card }]}
                    >
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setDetailVisible(false)}><X color="#FFF" size={24} /></TouchableOpacity>
                        <ScrollView bounces={false}>
                            <Image source={{ uri: selectedLog?.photoUrl }} style={styles.detailHeroImage} />
                            <View style={styles.detailBody}>
                                <Text style={[styles.detailTitle, { color: Colors.text }]}>{selectedLog?.title}</Text>
                                <View style={styles.detailMeta}>
                                    <Calendar size={14} color={Colors.primary} />
                                    <Text style={styles.detailDateText}>{selectedLog?.watchDate}</Text>
                                </View>
                                <View style={[styles.divider, { backgroundColor: Colors.border }]} />
                                <Text style={[styles.detailNoteText, { color: Colors.text }]}>{selectedLog?.note || "這場電影留下了無聲的感動..."}</Text>
                            </View>
                        </ScrollView>
                    </MotiView>
                </View>
            </Modal>

            {/* 認證 Modal */}
            <Modal animationType="slide" transparent visible={authModalVisible}>
                <View style={[styles.modalOverlay, { backgroundColor: Colors.overlay }]}>
                    <View style={[styles.authCard, { backgroundColor: Colors.card }]}>
                        <View style={styles.authHeader}>
                            <Text style={[styles.authTitle, { color: Colors.text }]}>
                                {authMode === 'upgrade' ? '升級至雲端備份' : '歡迎回來'}
                            </Text>
                            <TouchableOpacity onPress={() => setAuthModalVisible(false)}><X color={Colors.subText} size={24} /></TouchableOpacity>
                        </View>
                        <TextInput style={[styles.authInput, { backgroundColor: Colors.inputBg, color: Colors.text }]} placeholder="Email" placeholderTextColor={Colors.subText} value={email} onChangeText={setEmail} autoCapitalize="none" />
                        <TextInput style={[styles.authInput, { backgroundColor: Colors.inputBg, color: Colors.text }]} placeholder="Password" placeholderTextColor={Colors.subText} value={password} onChangeText={setPassword} secureTextEntry />
                        <TouchableOpacity style={styles.authBtn} onPress={handleAuthAction}>
                            {isProcessingAuth ? <ActivityIndicator color="#FFF" /> : <Text style={styles.authBtnText}>確定</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity style={{marginTop: 15}} onPress={() => setAuthMode(authMode === 'login' ? 'upgrade' : 'login')}>
                            <Text style={{color: Colors.primary, textAlign: 'center', fontFamily: 'ZenKurenaido_400Regular'}}>{authMode === 'login' ? '新用戶？點此升級' : '已有帳號？點此登入'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <DateTimePickerModal isVisible={isDatePickerVisible} mode="date" onConfirm={(date) => { setWatchDate(date); setDatePickerVisibility(false); }} onCancel={() => setDatePickerVisibility(false)} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    fullSize: { width: '100%', height: '100%' },
    header: { paddingHorizontal: 25, paddingVertical: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 32, fontFamily: 'ZenKurenaido_400Regular' },
    headerSub: { fontSize: 14, fontFamily: 'ZenKurenaido_400Regular', marginTop: 2 },
    userBadge: { padding: 10, borderRadius: 15, elevation: 2 },
    
    toast: { position: 'absolute', top: 40, left: 25, right: 25, height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, zIndex: 10000, elevation: 10 },
    toastText: { color: '#FFF', marginLeft: 10, fontFamily: 'ZenKurenaido_400Regular', fontSize: 16 },

    inputCard: { marginHorizontal: 20, borderRadius: 24, overflow: 'hidden', elevation: 10, shadowOpacity: 0.1, shadowRadius: 20 },
    imagePickerArea: { width: '100%', height: 220, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#00000000' },
    previewImg: { width: '100%', height: '100%', resizeMode: 'cover' },
    removeImg: { position: 'absolute', top: 15, right: 15, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 6 },
    placeholder: { alignItems: 'center' },
    placeholderText: { marginTop: 10, fontFamily: 'ZenKurenaido_400Regular', fontSize: 14 },
    
    formPadding: { padding: 20 },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, height: 48, marginBottom: 12 },
    textInput: { flex: 1, marginLeft: 10, fontSize: 16, fontFamily: 'ZenKurenaido_400Regular' },
    editLabel: { fontSize: 11, color: '#FF2D55', fontFamily: 'ZenKurenaido_400Regular' },
    noteInput: { borderRadius: 12, padding: 12, fontSize: 16, fontFamily: 'ZenKurenaido_400Regular', height: 80, textAlignVertical: 'top' },
    saveBtn: { marginTop: 15, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    saveBtnText: { color: '#FFF', fontSize: 17,  fontFamily: 'ZenKurenaido_400Regular' },

    listTitle: { fontSize: 24, marginLeft: 25, marginTop: 30, marginBottom: 15, fontFamily: 'ZenKurenaido_400Regular' },
    horizontalList: { paddingLeft: 25, paddingBottom: 20 },
    logCard: { marginRight: 15, width: 160, height: 240, borderRadius: 20, overflow: 'hidden', elevation: 5 },
    logImage: { width: '100%', height: '100%' },
    cardOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 15, backgroundColor: 'rgba(0,0,0,0.4)' },
    cardTitle: { color: '#FFF', fontSize: 15, fontFamily: 'ZenKurenaido_400Regular' },
    cardDate: { color: '#EEE', fontSize: 11, marginTop: 4, fontFamily: 'ZenKurenaido_400Regular' },

    emptyContainer: { alignItems: 'center', marginTop: 40 },
    emptyText: { marginTop: 10, fontFamily: 'ZenKurenaido_400Regular' },

    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    detailContent: { width: width * 0.9, height: '85%', borderRadius: 24, overflow: 'hidden' },
    closeBtn: { position: 'absolute', top: 20, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: 8 },
    detailHeroImage: { width: '100%', height: 350, resizeMode: 'cover' },
    detailBody: { padding: 24 },
    detailTitle: { fontSize: 30, fontFamily: 'ZenKurenaido_400Regular' },
    detailMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    detailDateText: { marginLeft: 8, color: '#FF2D55', fontSize: 14, fontFamily: 'ZenKurenaido_400Regular' },
    divider: { height: 1, marginVertical: 20, opacity: 0.1 },
    detailNoteText: { fontSize: 18, lineHeight: 28, fontFamily: 'ZenKurenaido_400Regular', opacity: 0.9 },

    authCard: { width: width * 0.85, padding: 25, borderRadius: 20, elevation: 20 },
    authHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    authTitle: { fontSize: 22, fontFamily: 'ZenKurenaido_400Regular' },
    authInput: { height: 48, borderRadius: 10, paddingHorizontal: 15, marginBottom: 12, fontFamily: 'ZenKurenaido_400Regular' },
    authBtn: { backgroundColor: '#FF2D55', height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
    authBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700', fontFamily: 'ZenKurenaido_400Regular' },
    scrollContent: { paddingBottom: 40 }
});