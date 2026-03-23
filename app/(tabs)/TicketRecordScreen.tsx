import { useFonts, ZenKurenaido_400Regular } from '@expo-google-fonts/zen-kurenaido';
import * as ImagePicker from 'expo-image-picker';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Calendar, Camera, Film, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, FlatList, Image, Keyboard, KeyboardAvoidingView, Platform,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View
} from 'react-native';
import DateTimePickerModal from "react-native-modal-datetime-picker"; // 新增日期選擇器
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from './firebaseConfig';

export default function TicketRecordScreen() {
    const [fontsLoaded] = useFonts({ ZenKurenaido_400Regular });
    const [image, setImage] = useState<string | null>(null);
    const [movieTitle, setMovieTitle] = useState('');
    const [note, setNote] = useState('');
    
    // 日期相關狀態
    const [watchDate, setWatchDate] = useState(new Date()); // 存 Date 物件
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    
    const [logs, setLogs] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const auth = getAuth();

    // 格式化日期顯示 (YYYY/MM/DD)
    const formatDate = (date: Date) => {
        return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(
            collection(db, "movieLogs"),
            where("uid", "==", auth.currentUser.uid),
            orderBy("createdAt", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [auth.currentUser]);

    // 日期選擇器處理
    const showDatePicker = () => setDatePickerVisibility(true);
    const hideDatePicker = () => setDatePickerVisibility(false);
    const handleConfirm = (date: Date) => {
        setWatchDate(date);
        hideDatePicker();
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.5,
        });
        if (!result.canceled) setImage(result.assets[0].uri);
    };

const saveLog = async () => {
    if (!image || !movieTitle || !auth.currentUser) return;
    setUploading(true);

    try {
        // 1. 準備上傳到 Cloudinary 的資料
        const data = new FormData();
        data.append('file', {
            uri: image,
            type: 'image/jpeg',
            name: 'movie_ticket.jpg',
        } as any);
        data.append('upload_preset', 'movie_app'); // 填入剛剛設定的名稱
        data.append('cloud_name', 'dgoq8r2pq'); // 填入你的 Cloud Name

        // 2. 執行上傳
        const response = await fetch('https://api.cloudinary.com/v1_1/dgoq8r2pq/image/upload', {
            method: 'POST',
            body: data,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'multipart/form-data',
            },
        });

        const result = await response.json();
        
        if (!result.secure_url) {
            throw new Error("Cloudinary 上傳失敗: " + JSON.stringify(result));
        }

        const imageUrl = result.secure_url; // 拿到雲端網址了！

        // 3. 儲存到 Firebase Firestore
        await addDoc(collection(db, "movieLogs"), {
            uid: auth.currentUser.uid,
            title: movieTitle,
            photoUrl: imageUrl, // 存入 Cloudinary 的網址
            note: note,
            watchDate: formatDate(watchDate),
            createdAt: new Date(),
        });

        setImage(null);
        setMovieTitle('');
        setNote('');
        alert("收藏成功！");
    } catch (e) {
        console.error("上傳錯誤：", e);
        alert("儲存失敗，請檢查設定");
    } finally {
        setUploading(false);
    }
};

    if (!fontsLoaded) return null;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={{ flex: 1 }}>
                        <View style={styles.header}>
                            <Text style={styles.headerTitle}>觀影手札</Text>
                            <Text style={styles.headerSub}>紀錄每一場光影的感動</Text>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                            <View style={styles.inputSection}>
                                <TouchableOpacity onPress={pickImage} style={styles.imageBox}>
                                    {image ? (
                                        <View style={{ width: '100%', height: '100%' }}>
                                            <Image source={{ uri: image }} style={styles.previewImg} />
                                            <TouchableOpacity style={styles.removeImg} onPress={() => setImage(null)}>
                                                <X color="#FFF" size={16} />
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <View style={styles.placeholder}>
                                            <Camera color="#CCC" size={40} strokeWidth={1} />
                                            <Text style={styles.placeholderText}>上傳票根或劇照</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <View style={styles.form}>
                                    <View style={styles.inputRow}>
                                        <Film size={18} color="#FF2D55" />
                                        <TextInput
                                            style={styles.titleInput}
                                            placeholder="電影名稱"
                                            placeholderTextColor="#CCC"
                                            value={movieTitle}
                                            onChangeText={setMovieTitle}
                                        />
                                    </View>

                                    {/* 修改後的日期選擇區域 */}
                                    <TouchableOpacity style={styles.inputRow} onPress={showDatePicker}>
                                        <Calendar size={18} color="#FF2D55" />
                                        <Text style={[styles.dateInput, { color: watchDate ? '#333' : '#CCC' }]}>
                                            {formatDate(watchDate)}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#FF2D55', fontFamily: 'ZenKurenaido_400Regular' }}>修改</Text>
                                    </TouchableOpacity>

                                    <DateTimePickerModal
                                        isVisible={isDatePickerVisible}
                                        mode="date"
                                        onConfirm={handleConfirm}
                                        onCancel={hideDatePicker}
                                        confirmTextIOS="確定"  // 修正這裡
                                        cancelTextIOS="取消"   // 修正這裡
                                        pickerContainerStyleIOS={{ backgroundColor: 'white' }} // 選項：確保 iOS 樣式清晰
                                    />

                                    <TextInput
                                        style={styles.noteInput}
                                        placeholder="寫下此刻的心得..."
                                        placeholderTextColor="#CCC"
                                        multiline
                                        value={note}
                                        onChangeText={setNote}
                                        scrollEnabled={false}
                                    />

                                    <TouchableOpacity
                                        onPress={saveLog}
                                        disabled={uploading || !image || !movieTitle}
                                        style={[styles.saveBtn, { backgroundColor: (image && movieTitle) ? '#FF2D55' : '#EEE' }]}
                                    >
                                        {uploading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>收藏紀錄</Text>}
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <Text style={styles.listTitle}>過去的紀錄</Text>
                            {logs.length === 0 ? (
                                <Text style={styles.noDataText}>目前還沒有紀錄...</Text>
                            ) : (
                                <FlatList
                                    data={logs}
                                    keyExtractor={(item) => item.id}
                                    horizontal
                                    contentContainerStyle={styles.horizontalList}
                                    showsHorizontalScrollIndicator={false}
                                    renderItem={({ item }) => (
                                        <View style={styles.logCard}>
                                            <Image source={{ uri: item.photoUrl }} style={styles.logImage} />
                                            <View style={styles.cardContent}>
                                                <Text style={styles.cardTitle}>{item.title}</Text>
                                                <Text style={styles.cardDate}>{item.watchDate}</Text>
                                                <Text numberOfLines={2} style={styles.cardNote}>{item.note}</Text>
                                            </View>
                                        </View>
                                    )}
                                />
                            )}
                            <View style={{ height: 120 }} />
                        </ScrollView>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAF9F6' },
    header: { paddingHorizontal: 25, paddingTop: 20, marginBottom: 15 },
    headerTitle: { fontSize: 32, fontFamily: 'ZenKurenaido_400Regular', color: '#333' },
    headerSub: { fontSize: 14, fontFamily: 'ZenKurenaido_400Regular', color: '#999', marginTop: 5 },
    scrollContent: { flexGrow: 1 },
    inputSection: { marginHorizontal: 20, backgroundColor: '#FFF', borderRadius: 30, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15 },
    imageBox: { width: '100%', height: 250, backgroundColor: '#F2F2F2', justifyContent: 'center', alignItems: 'center' },
    previewImg: { width: '100%', height: '100%', resizeMode: 'cover' },
    removeImg: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: 6 },
    placeholder: { alignItems: 'center' },
    placeholderText: { marginTop: 10, color: '#BBB', fontFamily: 'ZenKurenaido_400Regular' },
    form: { padding: 20 },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', marginBottom: 15, paddingBottom: 5 },
    titleInput: { flex: 1, marginLeft: 10, fontSize: 18, fontFamily: 'ZenKurenaido_400Regular', color: '#333' },
    dateInput: { flex: 1, marginLeft: 10, fontSize: 16, fontFamily: 'ZenKurenaido_400Regular' },
    noteInput: { minHeight: 80, backgroundColor: '#F9F9F9', borderRadius: 15, padding: 15, fontSize: 16, fontFamily: 'ZenKurenaido_400Regular', textAlignVertical: 'top', marginTop: 10, color: '#444' },
    saveBtn: { marginTop: 20, height: 55, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    saveBtnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', fontFamily: 'ZenKurenaido_400Regular' },
    listTitle: { marginHorizontal: 25, marginTop: 35, marginBottom: 15, fontSize: 22, fontFamily: 'ZenKurenaido_400Regular', color: '#555' },
    noDataText: { marginLeft: 25, color: '#BBB', fontFamily: 'ZenKurenaido_400Regular' },
    horizontalList: { paddingLeft: 25, paddingBottom: 20 },
    logCard: { width: 240, marginRight: 20, backgroundColor: '#FFF', borderRadius: 25, elevation: 5, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, overflow: 'hidden' },
    logImage: { width: '100%', height: 300, resizeMode: 'cover' },
    cardContent: { padding: 15 },
    cardTitle: { fontSize: 18, fontFamily: 'ZenKurenaido_400Regular', fontWeight: 'bold', color: '#333' },
    cardDate: { fontSize: 12, color: '#AAA', marginVertical: 5 },
    cardNote: { fontSize: 14, color: '#666', fontFamily: 'ZenKurenaido_400Regular' }
});