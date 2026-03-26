import fs from 'fs';
import { chromium } from 'playwright';

async function run() {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    
    // 取得執行當天的日期 (格式：2026-03-26)
    const today = new Date().toISOString().split('T')[0];
    console.log(`🚀 百老匯 API 啟動 - 目標日期：${today}`);

    const cinemas = [
        { name: "百老匯公館店", url: "https://www.broadway-cineplex.com.tw/Movie/GetMovieList/Taipei" },
        { name: "百老匯竹北店", url: "https://www.broadway-cineplex.com.tw/Movie/GetMovieList/Zhubei" }
    ];

    const finalResult = [];

    try {
        for (const cinema of cinemas) {
            console.log(`📡 正在抓取: ${cinema.name}...`);
            const response = await context.request.get(cinema.url, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://www.broadway-cineplex.com.tw/book.html'
                }
            });

            if (response.ok()) {
                const json = await response.json();
                
                if (json.status && Array.isArray(json.Data)) {
                    const moviesToday = [];

                    json.Data.forEach(movie => {
                        const movieEntry = {
                            title: movie.cname,
                            versions: [],
                            showtimes: []
                        };

                        (movie.timedata || []).forEach(ver => {
                            const versionName = ver.SubName2 || "數位";

                            (ver.subtimedata || []).forEach(t => {
                                // 檢查這場次的日期是否為今天
                                const playDate = t["PlayDate"] ? t["PlayDate"].split(' ')[0].replace(/\//g, '-') : today;

                                if (playDate === today) {
                                    if (!movieEntry.versions.includes(versionName)) {
                                        movieEntry.versions.push(versionName);
                                    }
                                    movieEntry.showtimes.push({
                                        time: t["時間"],
                                        ver: versionName
                                    });
                                }
                            });
                        });

                        // 只有當這部電影今天有場次時才加入
                        if (movieEntry.showtimes.length > 0) {
                            moviesToday.push(movieEntry);
                        }
                    });

                    finalResult.push({ 
                        cinema: cinema.name, 
                        date: today,
                        movies: moviesToday 
                    });
                    
                    console.log(`   ✅ ${cinema.name} 抓取成功，今日共有 ${moviesToday.length} 部電影上映`);
                }
            }
        }

        fs.writeFileSync('broadway_date_test.json', JSON.stringify(finalResult, null, 4));
        console.log(`\n🏁 任務完成！今日場次已存至 broadway_date_test.json`);

    } catch (e) {
        console.error("🔥 發生錯誤:", e.message);
    } finally {
        await browser.close();
    }
}

run();