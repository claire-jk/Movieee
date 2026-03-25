import fs from 'fs';
import { chromium } from 'playwright';

async function run() {
    // 啟動瀏覽器（headless 模式即可，因為我們主要使用 request 控制器）
    const browser = await chromium.launch();
    const context = await browser.newContext();
    
    console.log("🚀 百老匯 API 抓取啟動 (威秀格式相容版)...");

    // 定義影城與對應的正確 API URL
    const cinemas = [
        { name: "百老匯公館店", url: "https://www.broadway-cineplex.com.tw/Movie/GetMovieList/Taipei" },
        { name: "百老匯竹北店", url: "https://www.broadway-cineplex.com.tw/Movie/GetMovieList/Zhubei" }
    ];

    const finalResult = [];

    try {
        for (const cinema of cinemas) {
            console.log(`📡 正在抓取: ${cinema.name}...`);
            
            // 發送 GET 請求
            const response = await context.request.get(cinema.url, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://www.broadway-cineplex.com.tw/book.html'
                }
            });

            if (response.ok()) {
                const json = await response.json();
                
                // 確保 Data 存在且為陣列
                if (json.status && Array.isArray(json.Data)) {
                    
                    const moviesData = json.Data.map(movie => {
                        const allShowtimes = [];
                        const allVersions = [];

                        // 1. 遍歷 timedata 陣列 (代表不同版本，如：數位/中文)
                        (movie.timedata || []).forEach(ver => {
                            const versionName = ver.SubName2 || "數位"; // 取得版本名稱
                            
                            // 收集不重複的版本字串 (符合威秀格式)
                            if (!allVersions.includes(versionName)) {
                                allVersions.push(versionName);
                            }

                            // 2. 遍歷該版本下的 subtimedata (真正的場次時間)
                            (ver.subtimedata || []).forEach(t => {
                                if (t["時間"]) {
                                    // 攤平成威秀物件格式
                                    allShowtimes.push({
                                        "time": t["時間"],
                                        "ver": versionName
                                    });
                                }
                            });
                        });

                        // 返回符合威秀結構的電影物件
                        return {
                            "title": movie.cname,     // 電影名稱
                            "versions": allVersions,  // 版本字串陣列 (例如: ["數位/中文", "數位/英文"])
                            "showtimes": allShowtimes // 場次物件陣列 (例如: [{"time": "10:30", "ver": "數位/中文"}, ...])
                        };
                    }).filter(m => m.showtimes.length > 0); // 只保留有場次的電影

                    console.log(`   ✅ ${cinema.name} 抓取成功，共 ${moviesData.length} 部電影`);
                    finalResult.push({ 
                        cinema: cinema.name, 
                        movies: moviesData 
                    });
                }
            } else {
                console.log(`   ❌ ${cinema.name} 請求失敗，狀態碼: ${response.status()}`);
            }
        }

        // 將結果寫入 JSON 檔案
        fs.writeFileSync('./broadway_test.json', JSON.stringify(finalResult, null, 4));
        console.log("\n🏁 任務完成！資料已存至 broadway_test.json");

    } catch (e) {
        console.error("🔥 發生錯誤:", e.message);
    } finally {
        await browser.close();
    }
}

run();