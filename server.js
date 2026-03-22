const axios = require('axios');
const cheerio = require('cheerio');

async function getRealShowtimes(movieName) {
  try {
    // 爬取 Yahoo 電影的時刻表頁面 (以搜尋電影為例)
    const url = `https://movies.yahoo.com.tw/movietime_result.html?movie_id=最新的電影ID`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const results = [];

    $('.theater_content').each((i, el) => {
      const theaterName = $(el).find('.theater_top a').text().trim();
      const area = $(el).prevAll('.area_title').first().text().trim(); // 抓取地區
      
      const showtimes = [];
      $(el).find('.tmtimes_content .time span').each((j, timeEl) => {
        showtimes.push($(timeEl).text());
      });

      if (theaterName) {
        results.push({
          theater: theaterName,
          area: area,
          times: showtimes
        });
      }
    });

    return results;
  } catch (error) {
    console.error("爬取失敗:", error);
  }
}