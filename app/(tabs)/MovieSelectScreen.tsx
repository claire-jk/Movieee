//電影選擇頁面
import { useFonts, ZenKurenaido_400Regular } from '@expo-google-fonts/zen-kurenaido';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { collection, getDocs } from 'firebase/firestore';
import { MotiView } from 'moti';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme,
    View
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { db } from './firebaseConfig';
import { RootStackParamList } from './TabNavigator';

const { width, height } = Dimensions.get('window');

const ALL_VERSIONS = [
    { label: '數位 2D', value: '2D' },
    { label: '數位 3D', value: '3D' },
    { label: 'IMAX', value: 'IMAX' },
    { label: '4DX', value: '4DX' },
    { label: 'MX4D', value: 'MX4D' },
    { label: 'Dolby Cinema', value: 'Dolby' },
    { label: 'ScreenX', value: 'ScreenX' },
    { label: 'LIVE', value: 'LIVE' },
];

export default function MovieSelectScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const [fontsLoaded] = useFonts({ ZenKurenaido_400Regular });

    const [movies, setMovies] = useState<any[]>([]); 
    const [availableVersions, setAvailableVersions] = useState(ALL_VERSIONS);
    const [selectedMovie, setSelectedMovie] = useState<any>(null);
    const [selectedVersion, setSelectedVersion] = useState('2D');
    const [loading, setLoading] = useState(true);

    const theme = {
        background: isDark ? '#0A0A0B' : '#F2F2F7', 
        card: isDark ? '#1C1C1E' : '#FFFFFF',
        text: isDark ? '#FFFFFF' : '#1C1C1E',
        subText: isDark ? '#8E8E93' : '#636366',
        primary: isDark ? '#D0BCFF' : '#6750A4',
        accent: '#FF2D55',
        border: isDark ? '#2C2C2E' : '#E5E5EA',
        inputBackground: isDark ? '#2C2C2E' : '#F9F9F9',
    };

    useEffect(() => { 
        fetchMoviesFromFirebase(); 
    }, []);

    const fetchMoviesFromFirebase = async () => {
        try {
            setLoading(true);
            const querySnapshot = await getDocs(collection(db, 'realtime_showtimes'));
            const movieMap = new Map();
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.movies && Array.isArray(data.movies)) {
                    data.movies.forEach((movie: any) => {
                        if (!movie.title) return;
                        const currentMovieVersions = movie.showtimes?.map((s: any) => s.ver) || [];
                        if (!movieMap.has(movie.title)) {
                            movieMap.set(movie.title, {
                                label: movie.title,
                                value: movie.title,
                                allAvailableVers: new Set(currentMovieVersions)
                            });
                        } else {
                            const existing = movieMap.get(movie.title);
                            currentMovieVersions.forEach((v: string) => existing.allAvailableVers.add(v));
                        }
                    });
                }
            });

            const formattedMovies = Array.from(movieMap.values()).sort((a, b) => 
                a.label.localeCompare(b.label, 'zh-Hant')
            );
            setMovies(formattedMovies);
        } catch (err) {
            console.error("Firebase Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleMovieChange = (item: any) => {
        setSelectedMovie(item);
        const movieVersSet = item.allAvailableVers as Set<string>;
        const filtered = ALL_VERSIONS.filter(v => {
            if (v.value === '2D') return Array.from(movieVersSet).some(m => m.includes('數位'));
            return Array.from(movieVersSet).some(m => m.includes(v.value));
        });
        setAvailableVersions(filtered.length > 0 ? filtered : ALL_VERSIONS);
    };

    const handleNavigate = () => {
        if (!selectedMovie) return;
        
        console.log("🚀 準備跳轉，傳遞標題:", selectedMovie.label);
        
        navigation.navigate('CinemaDetail', { 
            movieTitle: selectedMovie.label, 
            version: selectedVersion,
        });
    };

    if (loading || !fontsLoaded) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.loadingText, { color: theme.subText }]}>MOVIEGOER EXPLORING...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            
            <View style={[styles.ambientGlow, { backgroundColor: theme.primary, top: -height * 0.1, left: -width * 0.2 }]} />
            <View style={[styles.ambientGlow, { backgroundColor: theme.accent, bottom: -height * 0.1, right: -width * 0.2, opacity: 0.03 }]} />

            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.mainContainer}>
                    <MotiView 
                        from={{ opacity: 0, translateY: -20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 1000 }}
                        style={styles.headerSection}
                    >
                        <Text style={[styles.header, { color: theme.text }]}>MovieGoer</Text>
                        <View style={[styles.accentBar, { backgroundColor: theme.primary }]} />
                        <Text style={[styles.subHeader, { color: theme.subText }]}>尋找下一場與大銀幕的約會</Text>
                    </MotiView>

                    <View style={styles.formContainer}>
                        {/* 選擇電影 */}
                        <MotiView 
                            from={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 200 }}
                            style={styles.section}
                        >
                            <View style={styles.labelRow}>
                                <Text style={[styles.label, { color: theme.text }]}>🎬 選擇電影</Text>
                                <View style={[styles.badge, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
                                    <Text style={[styles.badgeText, { color: theme.primary }]}>{movies.length} 部熱映中</Text>
                                </View>
                            </View>
                            <Dropdown
                                style={[styles.dropdown, { backgroundColor: theme.card, borderColor: selectedMovie ? theme.primary : theme.border }]}
                                placeholderStyle={[styles.placeholderStyle, { color: theme.subText }]}
                                selectedTextStyle={[styles.selectedTextStyle, { color: theme.text }]}
                                inputSearchStyle={[styles.inputSearchStyle, { color: theme.text, backgroundColor: theme.inputBackground }]}
                                itemTextStyle={[styles.itemTextStyle, { color: theme.text }]}
                                containerStyle={[styles.dropdownList, { backgroundColor: theme.card, borderColor: theme.border }]}
                                data={movies}
                                search
                                labelField="label"
                                valueField="value"
                                placeholder="搜尋電影..."
                                searchPlaceholder="輸入名稱查詢..."
                                value={selectedMovie?.value}
                                onChange={handleMovieChange}
                                activeColor={isDark ? '#3A3A3C' : '#F2F2F7'}
                            />
                        </MotiView>

                        {/* 觀影版本 */}
                        <MotiView 
                            from={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 400 }}
                            style={styles.section}
                        >
                            <Text style={[styles.label, { color: theme.text, marginBottom: 12 }]}>🎥 觀影版本</Text>
                            <Dropdown
                                style={[styles.dropdown, { backgroundColor: theme.card, borderColor: theme.border }]}
                                selectedTextStyle={[styles.selectedTextStyle, { color: theme.primary, fontWeight: '700' }]}
                                itemTextStyle={[styles.itemTextStyle, { color: theme.text }]}
                                containerStyle={[styles.dropdownList, { backgroundColor: theme.card, borderColor: theme.border }]}
                                data={availableVersions}
                                labelField="label"
                                valueField="value"
                                value={selectedVersion}
                                onChange={(item) => setSelectedVersion(item.value)}
                                activeColor={isDark ? '#3A3A3C' : '#F2F2F7'}
                            />
                        </MotiView>
                    </View>

                    <MotiView 
                        from={{ opacity: 0, translateY: 20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ delay: 600 }}
                        style={styles.footer}
                    >
                        <TouchableOpacity
                            activeOpacity={0.8}
                            disabled={!selectedMovie}
                            onPress={handleNavigate}
                        >
                            <View style={[
                                styles.submitButton, 
                                { 
                                    backgroundColor: selectedMovie ? theme.primary : (isDark ? '#1C1C1E' : '#D1D1D6'),
                                }
                            ]}>
                                <Text style={[styles.submitText, { color: selectedMovie ? '#ffffff' : theme.subText }]}>
                                    探索場次
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </MotiView>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { flexGrow: 1 },
    mainContainer: {
        padding: 30,
        flex: 1,
        justifyContent: 'space-between',
        paddingBottom: Platform.OS === 'ios' ? 140 : 120, 
    },
    ambientGlow: {
        position: 'absolute',
        width: width * 0.8,
        height: width * 0.8,
        borderRadius: width * 0.4,
        opacity: 0.08,
        zIndex: -1,
    },
    headerSection: { marginTop: 20 },
    accentBar: { width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
    header: { fontSize: 44, fontFamily: 'ZenKurenaido_400Regular', letterSpacing: -1 },
    subHeader: { fontSize: 18, fontFamily: 'ZenKurenaido_400Regular', opacity: 0.8 },
    loadingText: { marginTop: 20, fontFamily: 'ZenKurenaido_400Regular', letterSpacing: 4 },
    formContainer: { marginTop: 50 },
    section: { marginBottom: 35 },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    label: { fontSize: 17, fontFamily: 'ZenKurenaido_400Regular', fontWeight: 'bold' },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 12, fontWeight: 'bold' },
    dropdown: { 
        height: 64, 
        borderWidth: 1.5, 
        borderRadius: 20, 
        paddingHorizontal: 20,
    },
    dropdownList: { 
        borderRadius: 20, 
        marginTop: 4, 
        elevation: 10, 
        borderWidth: 1,
        overflow: 'hidden' 
    },
    placeholderStyle: { fontSize: 16, fontFamily: 'ZenKurenaido_400Regular' },
    selectedTextStyle: { fontSize: 18, fontFamily: 'ZenKurenaido_400Regular' },
    itemTextStyle: { fontSize: 16, fontFamily: 'ZenKurenaido_400Regular' },
    inputSearchStyle: { 
        height: 45, 
        fontSize: 16, 
        borderRadius: 12, 
        fontFamily: 'ZenKurenaido_400Regular' 
    },
    footer: { marginTop: 20 },
    submitButton: { 
        height: 70, 
        borderRadius: 25, 
        justifyContent: 'center', 
        alignItems: 'center',
    },
    submitText: { fontSize: 20, fontFamily: 'ZenKurenaido_400Regular', fontWeight: 'bold', letterSpacing: 2 },
});