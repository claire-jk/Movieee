import { useFonts, ZenKurenaido_400Regular } from '@expo-google-fonts/zen-kurenaido';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { collection, getDocs } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    SafeAreaView,
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

const { width } = Dimensions.get('window');

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
        background: isDark ? '#0A0A0B' : '#F8F9FA', 
        card: isDark ? '#161618' : '#FFFFFF',
        text: isDark ? '#FFFFFF' : '#1C1C1E',
        subText: isDark ? '#A0A0A5' : '#636366',
        primary: isDark ? '#D0BCFF' : '#6750A4', // 柔和發光紫色
        accent: '#FF2D55',
        border: isDark ? '#2C2C2E' : '#E5E5EA',
        glow: isDark ? 'rgba(208, 188, 255, 0.4)' : 'rgba(103, 80, 164, 0.2)',
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
            console.error('Firebase Fetch Error:', err);
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
        if (filtered.length > 0 && !filtered.some(f => f.value === selectedVersion)) {
            setSelectedVersion(filtered[0].value);
        }
    };

    if (!fontsLoaded || loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={{ marginTop: 20, color: theme.subText, fontFamily: 'ZenKurenaido_400Regular', letterSpacing: 2 }}>
                    MOVIEGOER EXPLORING...
                </Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            <View style={styles.content}>
                
                {/* --- 頂部標題 --- */}
                <View style={styles.headerSection}>
                    <View style={styles.glowBall} />
                    <View style={[styles.accentBar, { backgroundColor: theme.primary }]} />
                    <Text style={[styles.header, { color: theme.text }]}>MovieGoer</Text>
                    <Text style={[styles.subHeader, { color: theme.subText }]}>讓電影走進你的生活</Text>
                </View>
                
                <View style={styles.formContainer}>
                    {/* --- 電影選擇 --- */}
                    <View style={styles.section}>
                        <View style={styles.labelRow}>
                            <Text style={[styles.label, { color: theme.text }]}>🎬 選擇電影</Text>
                            <Text style={[styles.badgeText, { color: theme.primary, fontWeight: '800' }]}>{movies.length} MOVIES</Text>
                        </View>
                        <Dropdown
                            style={[
                                styles.dropdown, 
                                { backgroundColor: theme.card, borderColor: selectedMovie ? theme.primary : theme.border },
                            ]}
                            placeholderStyle={[styles.placeholderStyle, { color: theme.subText }]}
                            selectedTextStyle={[styles.selectedTextStyle, { color: theme.text }]}
                            inputSearchStyle={[styles.inputSearchStyle, { color: theme.text, backgroundColor: theme.card }]}
                            data={movies}
                            search
                            searchPlaceholder="搜尋..."
                            labelField="label"
                            valueField="value"
                            placeholder="搜尋電影..."
                            value={selectedMovie?.value}
                            onChange={handleMovieChange}
                            containerStyle={[styles.dropdownList, { backgroundColor: theme.card, borderColor: theme.border }]}
                            itemTextStyle={{ color: theme.text, fontFamily: 'ZenKurenaido_400Regular' }}
                            // 關鍵修正：讓選中項目的背景色變暗，文字才顯眼
                            activeColor={isDark ? '#2C2C2E' : '#F2F2F7'}
                        />
                    </View>

                    {/* --- 版本選擇 (優化對比度) --- */}
                    <View style={styles.section}>
                        <Text style={[styles.label, { color: theme.text, marginBottom: 12 }]}>🎥 觀影版本</Text>
                        <Dropdown
                            style={[
                                styles.dropdown, 
                                { 
                                    backgroundColor: theme.card, 
                                    borderColor: theme.border,
                                    // 稍微降低未選中時的陰影，避免視覺干擾
                                    shadowOpacity: isDark ? 0.3 : 0.05 
                                }
                            ]}
                            placeholderStyle={[styles.placeholderStyle, { color: theme.subText }]}
                            // 確保選中文字顏色足夠明顯
                            selectedTextStyle={[styles.selectedTextStyle, { color: isDark ? theme.primary : '#000', fontWeight: 'bold' }]}
                            data={availableVersions}
                            labelField="label"
                            valueField="value"
                            value={selectedVersion}
                            onChange={(item) => setSelectedVersion(item.value)}
                            containerStyle={[styles.dropdownList, { backgroundColor: theme.card, borderColor: theme.border }]}
                            itemTextStyle={{ color: theme.text, fontFamily: 'ZenKurenaido_400Regular' }}
                            // 關鍵修正：下拉列表選中項目的底色
                            activeColor={isDark ? '#3A3A3C' : '#E5E5EA'}
                        />
                    </View>
                </View>

                {/* --- 底部按鈕 --- */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        style={[
                            styles.submitButton, 
                            { 
                                backgroundColor: selectedMovie ? theme.primary : (isDark ? '#1C1C1E' : '#D1D1D6'),
                                shadowColor: selectedMovie ? theme.primary : 'transparent',
                            }
                        ]}
                        disabled={!selectedMovie}
                        onPress={() => navigation.navigate('CinemaScreen' as any, {
                            movieTitle: selectedMovie.label, 
                            version: selectedVersion,
                        })}
                    >
                        <Text style={[
                            styles.submitText, 
                            { color: selectedMovie ? (isDark ? '#000' : '#FFF') : theme.subText }
                        ]}>
                            Search Timetables
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 28, flex: 1, justifyContent: 'space-between' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    headerSection: { marginTop: 20 },
    glowBall: {
        position: 'absolute',
        top: -40,
        left: -40,
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: '#D0BCFF',
        opacity: 0.08,
    },
    accentBar: { width: 45, height: 6, borderRadius: 3, marginBottom: 16 },
    header: { fontSize: 48, fontFamily: 'ZenKurenaido_400Regular' },
    subHeader: { fontSize: 18, fontFamily: 'ZenKurenaido_400Regular', opacity: 0.7, letterSpacing: 1 },
    
    formContainer: { flex: 1, marginTop: 40 },
    section: { marginBottom: 35 },
    
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
    label: { fontSize: 16, fontFamily: 'ZenKurenaido_400Regular', opacity: 0.9, fontWeight: '600' },
    badgeText: { fontSize: 12, letterSpacing: 1 },
    
    dropdown: { 
        height: 64, // 稍微縮減高度，看起來更精煉
        borderWidth: 1.5, 
        borderRadius: 20, 
        paddingHorizontal: 20,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
        elevation: 3,
    },
    dropdownList: {
        borderRadius: 20,
        marginTop: 5,
        elevation: 10,
        borderWidth: 1,
        paddingVertical: 5,
    },
    placeholderStyle: { fontSize: 16, fontFamily: 'ZenKurenaido_400Regular' },
    selectedTextStyle: { fontSize: 17, fontFamily: 'ZenKurenaido_400Regular' },
    inputSearchStyle: { borderRadius: 12, fontFamily: 'ZenKurenaido_400Regular' },

    footer: { marginBottom: 10 },
    submitButton: { 
        height: 68, 
        borderRadius: 24, 
        justifyContent: 'center', 
        alignItems: 'center',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    submitText: { fontSize: 19, fontFamily: 'ZenKurenaido_400Regular' },
});