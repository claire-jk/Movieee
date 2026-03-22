import { useFonts, ZenKurenaido_400Regular } from '@expo-google-fonts/zen-kurenaido';
import { useNavigation } from '@react-navigation/native'; // 改用這個
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme,
    View,
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { RootStackParamList } from './index'; // 引入類型

const API_KEY = '28c58d3192a34321c54272d533d637dd';

const movieVersions = [
    { label: '數位 2D (Digital)', value: '2D' },
    { label: '數位 3D (Digital 3D)', value: '3D' },
    { label: 'IMAX 2D', value: 'IMAX' },
    { label: 'IMAX 3D', value: 'IMAX 3D' },
    { label: '4DX 2D', value: '4DX' },
    { label: 'MX4D', value: 'MX4D' },
    { label: 'Dolby Cinema', value: 'Dolby' },
    { label: 'ScreenX', value: 'ScreenX' },
];

export default function MovieSelectScreen() {
    // 取得導航對象
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const [fontsLoaded] = useFonts({ ZenKurenaido_400Regular });
    const [movies, setMovies] = useState<{ label: string; value: string; data: any }[]>([]);
    const [selectedMovie, setSelectedMovie] = useState<any>(null);
    const [selectedVersion, setSelectedVersion] = useState('2D');
    const [loading, setLoading] = useState(true);

    const theme = {
        background: isDark ? '#1A1A1A' : '#F8F9FA',
        card: isDark ? '#2C2C2C' : '#FFFFFF',
        text: isDark ? '#FFFFFF' : '#1A1A1A',
        subText: isDark ? '#AAAAAA' : '#666666',
        primary: isDark ? '#BB86FC' : '#6200EE',
        border: isDark ? '#444' : '#E0E0E0',
    };

    useEffect(() => {
        fetchNowPlaying();
    }, []);

    const fetchNowPlaying = async () => {
        try {
            const res = await axios.get(`https://api.themoviedb.org/3/movie/now_playing?api_key=${API_KEY}&language=zh-TW`);
            const formattedMovies = res.data.results.map((m: any) => ({
                label: m.title,
                value: m.id.toString(),
                data: m,
            }));
            setMovies(formattedMovies);
        } catch (err) {
            console.log('Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        if (!selectedMovie) return;
        // 使用導航跳轉到 CinemaDetail，並帶上參數
        navigation.navigate('CinemaDetail', {
            movie: JSON.stringify(selectedMovie.data),
            version: selectedVersion,
        });
    };

    if (!fontsLoaded || loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            <View style={styles.content}>
                <Text style={[styles.header, { color: theme.text }]}>MovieGoer</Text>
                <Text style={[styles.subHeader, { color: theme.subText }]}>探索您喜愛的電影與影院</Text>
                <View style={styles.section}>
                    <Text style={[styles.label, { color: theme.text }]}>🎬 選擇電影</Text>
                    <Dropdown
                        style={[styles.dropdown, { backgroundColor: theme.card, borderColor: theme.border }]}
                        placeholderStyle={[styles.placeholderStyle, { color: theme.subText }]}
                        selectedTextStyle={[styles.selectedTextStyle, { color: theme.text }]}
                        data={movies}
                        search
                        labelField="label"
                        valueField="value"
                        placeholder="請選擇一部電影"
                        value={selectedMovie?.value}
                        onChange={(item) => setSelectedMovie(item)}
                        itemTextStyle={{ color: theme.text, fontFamily: 'ZenKurenaido_400Regular' }}
                        containerStyle={{ backgroundColor: theme.card }}
                    />
                </View>
                <View style={styles.section}>
                    <Text style={[styles.label, { color: theme.text }]}>🎥 觀影版本</Text>
                    <Dropdown
                        style={[styles.dropdown, { backgroundColor: theme.card, borderColor: theme.border }]}
                        placeholderStyle={[styles.placeholderStyle, { color: theme.subText }]}
                        selectedTextStyle={[styles.selectedTextStyle, { color: theme.text }]}
                        data={movieVersions}
                        labelField="label"
                        valueField="value"
                        placeholder="選擇版本"
                        value={selectedVersion}
                        onChange={(item) => setSelectedVersion(item.value)}
                        itemTextStyle={{ color: theme.text, fontFamily: 'ZenKurenaido_400Regular' }}
                        containerStyle={{ backgroundColor: theme.card }}
                    />
                </View>
                <TouchableOpacity
                    style={[styles.submitButton, { backgroundColor: selectedMovie ? theme.primary : '#ccc' }]}
                    disabled={!selectedMovie}
                    onPress={handleNext}
                >
                    <Text style={styles.submitText}>查看影院與票價</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 24, flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { fontSize: 36, fontFamily: 'ZenKurenaido_400Regular', marginTop: 20 },
    subHeader: { fontSize: 16, fontFamily: 'ZenKurenaido_400Regular', marginBottom: 40 },
    section: { marginBottom: 25 },
    label: { fontSize: 18, fontFamily: 'ZenKurenaido_400Regular', marginBottom: 10 },
    dropdown: { height: 60, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16 },
    placeholderStyle: { fontSize: 16, fontFamily: 'ZenKurenaido_400Regular' },
    selectedTextStyle: { fontSize: 16, fontFamily: 'ZenKurenaido_400Regular' },
    submitButton: { height: 60, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 'auto', marginBottom: 20 },
    submitText: { color: '#FFF', fontSize: 18, fontFamily: 'ZenKurenaido_400Regular', fontWeight: 'bold' },
});