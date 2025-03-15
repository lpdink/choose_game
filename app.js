document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const steamIdInput = document.getElementById('steamId');
    const fetchDataBtn = document.getElementById('fetchData');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const resultsDiv = document.getElementById('results');
    const exportCsvBtn = document.getElementById('exportCsv');
    const gamesTableBody = document.querySelector('#gamesTable tbody');
    const randomGameBtn = document.getElementById('randomGame');
    const gameNameElement = document.getElementById('gameName');

    let gamesData = [];

    // Steam API基础URL
    const STEAM_API_BASE = 'https://api.steampowered.com';

    // 从Steam个人资料URL中提取Steam ID
    async function extractSteamId(input) {
        const steamIdRegex = /^\d+$/;
        if (steamIdRegex.test(input)) {
            return input;
        }

        const urlRegex = /steamcommunity\.com\/(?:profiles|id)\/([^\/]+)/;
        const match = input.match(urlRegex);
        const customUrl = match ? match[1] : input;

        try {
            const apiKey = document.getElementById('apiKey').value;
            const response = await fetch(`/api/resolve?vanityurl=${customUrl}&key=${apiKey}`);
            const data = await response.json();
            if (data.response && data.response.steamid) {
                return data.response.steamid;
            }
            throw new Error('无法解析Steam ID');
        } catch (error) {
            throw new Error('无法解析Steam ID：' + error.message);
        }
    }

    // 将分钟转换为可读的时间格式
    function formatPlaytime(minutes) {
        if (minutes < 60) {
            return `${minutes}分钟`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0 ? `${hours}小时${remainingMinutes}分钟` : `${hours}小时`;
    }

    // 格式化最后游玩时间
    function formatLastPlayed(timestamp) {
        if (!timestamp) return '从未游玩';
        return new Date(timestamp * 1000).toLocaleString('zh-CN');
    }

    // 获取用户的游戏库数据
    async function fetchGamesData(steamId, apiKey) {
        try {
            const response = await fetch(`/api/steam?key=${apiKey}&steamid=${steamId}`);
            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('API密钥无效或未授权');
                }
                throw new Error('获取数据失败');
            }
            
            const data = await response.json();
            if (!data.response) {
                throw new Error('API返回格式错误');
            }
            if (!data.response.games) {
                throw new Error('未找到游戏数据，请确保您的游戏库是公开的');
            }

            return data.response.games
                .filter(game => game.playtime_forever > 0)
                .map(game => ({
                    name: game.name,
                    playtime: game.playtime_forever,
                    lastPlayed: game.rtime_last_played
                }))
                .sort((a, b) => b.playtime - a.playtime);
        } catch (error) {
            throw new Error('获取Steam数据时出错：' + error.message);
        }
    }

    // 显示游戏数据
    let currentSortColumn = 'playtime';
let currentSortDirection = 'desc';

function sortGames(games, column, direction) {
    return [...games].sort((a, b) => {
        let compareValue;
        switch(column) {
            case 'playtime':
                compareValue = a.playtime - b.playtime;
                break;
            case 'lastPlayed':
                compareValue = (a.lastPlayed || 0) - (b.lastPlayed || 0);
                break;
            default:
                return 0;
        }
        return direction === 'asc' ? compareValue : -compareValue;
    });
}

function updateSortIcons() {
    document.querySelectorAll('th').forEach(th => {
        const icon = th.querySelector('.sort-icon');
        if (icon) {
            icon.className = 'sort-icon';
            if (th.dataset.sort === currentSortColumn) {
                icon.classList.add(currentSortDirection);
            }
        }
    });
}

function displayGames(games) {
    const sortedGames = sortGames(games, currentSortColumn, currentSortDirection);
    const maxPlaytime = Math.max(...games.map(game => game.playtime));
    
    gamesTableBody.innerHTML = '';
    sortedGames.forEach(game => {
        const progressWidth = (game.playtime / maxPlaytime) * 100;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${game.name}</td>
            <td>
                ${formatPlaytime(game.playtime)}
                <div class="progress-bar" style="width: ${progressWidth}%"></div>
            </td>
            <td>${formatLastPlayed(game.lastPlayed)}</td>
        `;
        gamesTableBody.appendChild(row);
    });
    updateSortIcons();
}
    

    // 导出CSV文件
    function exportToCsv() {

        if (!gamesData.length) return;

        const csvContent = [
            ['游戏名称', '游戏时间', '最后游玩时间'],
            ...gamesData.map(game => [
                game.name,
                formatPlaytime(game.playtime),
                formatLastPlayed(game.lastPlayed)
            ])
        ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'steam游戏统计.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // 事件监听器
    fetchDataBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        const steamIdValue = steamIdInput.value.trim();

        if (!apiKey) {
            errorDiv.textContent = '请输入Steam API密钥';
            errorDiv.style.display = 'block';
            return;
        }

        if (!steamIdValue) {
            errorDiv.textContent = '请输入Steam ID或个人资料URL';
            errorDiv.style.display = 'block';
            return;
        }

        loadingDiv.style.display = 'block';
        errorDiv.style.display = 'none';
        resultsDiv.style.display = 'none';

        try {
            const steamId = await extractSteamId(steamIdValue);
            gamesData = await fetchGamesData(steamId, apiKey);
            displayGames(gamesData);
            resultsDiv.style.display = 'block';
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
        } finally {
            loadingDiv.style.display = 'none';
        }
    });

    // 添加表头排序事件
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;
            if (currentSortColumn === column) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = column;
                currentSortDirection = 'desc';
            }
            displayGames(gamesData);
        });
    });

    exportCsvBtn.addEventListener('click', exportToCsv);



    // 添加随机游戏选择功能
    function selectRandomGame() {
        if (!gamesData.length) return;
        
        const randomIndex = Math.floor(Math.random() * gamesData.length);
        const selectedGame = gamesData[randomIndex];
        
        // 添加动画效果
        gameNameElement.style.animation = 'none';
        gameNameElement.offsetHeight; // 触发重绘
        gameNameElement.style.animation = 'fadeInOut 0.5s';
        
        gameNameElement.textContent = selectedGame.name;
        console.log(selectedGame);
    }

    // 添加骰子按钮点击事件
    randomGameBtn.addEventListener('click', selectRandomGame);
});