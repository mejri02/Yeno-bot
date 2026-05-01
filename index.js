const axios = require('axios');
const fs = require('fs');
const readline = require('readline');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const crypto = require('crypto');

const API_BASE = 'https://api.yeno.pro/tma/v1';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

let queries = [];
let accountStats = {};
let proxyList = [];
let currentProxyIndex = {};
let proxyFailCount = {};
let activeProxies = [];
let groqApiKey = null;
let useGroq = false;

let config = {
    betAmount: 5,
    minBalanceToBet: 10,
    useProxies: false,
    rotateProxyOnError: true,
    maxRetriesPerRequest: 2,
    requestDelay: { min: 2000, max: 8000 },
    maxProxyFails: 3,
};

const C = {
    reset:   '\x1b[0m',
    bold:    '\x1b[1m',
    dim:     '\x1b[2m',
    black:   '\x1b[30m', red:     '\x1b[31m', green:   '\x1b[32m',
    yellow:  '\x1b[33m', blue:    '\x1b[34m', magenta: '\x1b[35m',
    cyan:    '\x1b[36m', white:   '\x1b[37m', gray:    '\x1b[90m',
    bRed:    '\x1b[91m', bGreen:  '\x1b[92m', bYellow: '\x1b[93m',
    bBlue:   '\x1b[94m', bMagenta:'\x1b[95m', bCyan:   '\x1b[96m',
    bWhite:  '\x1b[97m',
};

function clr(color, text) {
    if (!C[color]) return text;
    return `${C[color]}${text}${C.reset}`;
}

function bold(text) { return `${C.bold}${text}${C.reset}`; }

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

const WEBGL_RENDERERS = [
    'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)',
    'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)',
    'ANGLE (AMD, Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
];

const WEBGL_VENDORS = ['Google Inc. (Intel)', 'NVIDIA Corporation', 'Advanced Micro Devices, Inc.'];
const PLATFORMS = ['Win32', 'MacIntel', 'Linux x86_64', 'iPhone', 'iPad', 'Android'];
const CPU_CLASSES = ['x86', 'x86_64', 'ARM', 'ARM64'];
const LANGUAGES = [['en-US', 'en'], ['en-GB', 'en'], ['zh-CN', 'zh', 'en-US', 'en']];
const TIMEZONES = [-420, -300, -240, -180, 0, 60, 120, 180, 240, 330, 480, 570];
const SCREEN_RESOLUTIONS = [
    { width: 1920, height: 1080 }, { width: 1366, height: 768 },
    { width: 1536, height: 864 }, { width: 1440, height: 900 },
];

function getRandomUserAgent() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }
function getRandomWebGLRenderer() { return WEBGL_RENDERERS[Math.floor(Math.random() * WEBGL_RENDERERS.length)]; }
function getRandomWebGLVendor() { return WEBGL_VENDORS[Math.floor(Math.random() * WEBGL_VENDORS.length)]; }
function getRandomPlatform() { return PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)]; }
function getRandomCPUClass() { return CPU_CLASSES[Math.floor(Math.random() * CPU_CLASSES.length)]; }
function getRandomLanguages() { return LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)]; }
function getRandomTimezone() { return TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)]; }
function getRandomScreenResolution() { return SCREEN_RESOLUTIONS[Math.floor(Math.random() * SCREEN_RESOLUTIONS.length)]; }
function generateRandomColorDepth() { const depths = [24, 30, 32]; return depths[Math.floor(Math.random() * depths.length)]; }
function generateRandomDeviceMemory() { const memories = [2, 4, 8, 16]; return memories[Math.floor(Math.random() * memories.length)]; }
function generateRandomHardwareConcurrency() { const cores = [2, 4, 6, 8, 12, 16]; return cores[Math.floor(Math.random() * cores.length)]; }
function generateRandomTouchPoints() { const isMobile = Math.random() > 0.7; if (isMobile) return Math.floor(Math.random() * 5) + 1; return 0; }
function generateSessionId() { return crypto.randomUUID(); }

function generateBrowserFingerprint() {
    const resolution = getRandomScreenResolution();
    return {
        userAgent: getRandomUserAgent(),
        webglRenderer: getRandomWebGLRenderer(),
        webglVendor: getRandomWebGLVendor(),
        platform: getRandomPlatform(),
        cpuClass: getRandomCPUClass(),
        languages: getRandomLanguages(),
        timezoneOffset: getRandomTimezone(),
        screenWidth: resolution.width,
        screenHeight: resolution.height,
        screenAvailWidth: resolution.width,
        screenAvailHeight: resolution.height,
        screenColorDepth: generateRandomColorDepth(),
        deviceMemory: generateRandomDeviceMemory(),
        hardwareConcurrency: generateRandomHardwareConcurrency(),
        touchPoints: generateRandomTouchPoints(),
        sessionId: generateSessionId(),
    };
}

function buildRequestHeaders(fingerprint) {
    return {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': fingerprint.languages.join(', ') + ';q=0.9',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Content-Type': 'application/json',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': fingerprint.userAgent,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://t.me/',
        'Origin': 'https://t.me',
    };
}

function loadGroqKey() {
    try {
        if (fs.existsSync('grok.txt')) {
            const key = fs.readFileSync('grok.txt', 'utf8').trim();
            if (key && key.startsWith('gsk_')) return key;
        }
    } catch (e) {}
    return null;
}

async function askGroq(eventTitle, odds0, odds1) {
    if (!groqApiKey) return null;
    try {
        const noOddsStr  = (odds0 * 100).toFixed(1);
        const yesOddsStr = (odds1 * 100).toFixed(1);
        const noPct  = parseFloat(noOddsStr);
        const yesPct = parseFloat(yesOddsStr);

        const marketFavorite = yesPct > noPct ? 'YES' : (noPct > yesPct ? 'NO' : 'EVEN');
        const spread = Math.abs(yesPct - noPct).toFixed(1);
        const isLopsided = Math.max(yesPct, noPct) > 70;
        const isClose    = Math.abs(yesPct - noPct) < 10;

        const systemPrompt = `You are an expert prediction market analyst with deep knowledge of sports, finance, politics, crypto, and general world events. You are highly accurate at predicting binary outcomes.

Your analysis process:
1. Parse the event title carefully — identify the subject, the condition, and the time reference if any.
2. Apply domain knowledge: historical base rates, known trends, recent context.
3. Evaluate the current market odds — the crowd is often right but sometimes overreacts.
4. Assess if the market is efficient or if there is an edge (mispricing).
5. Produce a calibrated confidence score based on your certainty, not just the odds.

Output rules:
- Respond ONLY with a valid JSON object. No markdown, no explanation outside JSON.
- Format exactly: {"answer": "yes", "confidence": 0.78, "reason": "brief reason max 12 words", "edge": "brief 1-line edge explanation"}
- answer: "yes" or "no" only
- confidence: float 0.50–0.97 (never 1.0, never below 0.50)
- Calibrate confidence to your actual certainty. High confidence (>0.80) only when very sure.
- edge: explain in ≤8 words why the market may be wrong, or "market correct" if efficient`;

        const userPrompt = `Prediction event to analyze:

TITLE: "${eventTitle}"

MARKET ODDS:
  NO  = ${noOddsStr}%  (crowd says NO with this probability)
  YES = ${yesOddsStr}%  (crowd says YES with this probability)

MARKET SIGNALS:
  Favorite: ${marketFavorite}
  Spread: ${spread}% difference
  ${isLopsided ? '⚠ Market is heavily one-sided (>70%). Check if crowd is overconfident.' : ''}
  ${isClose ? '⚠ Market is very close (<10% spread). Small informational edge matters most.' : ''}

Step-by-step:
1. What does the event literally ask?
2. What is the most likely real-world outcome based on facts/history?
3. Does the crowd pricing (${noOddsStr}% NO / ${yesOddsStr}% YES) seem accurate, overpriced, or underpriced?
4. What is your final answer and why?

Respond with JSON only.`;

        const response = await axios.post(GROQ_API_URL, {
            model: GROQ_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userPrompt },
            ],
            temperature: 0.15,
            max_tokens: 180,
            top_p: 0.9,
        }, {
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
        });

        const text = response.data?.choices?.[0]?.message?.content?.trim();
        if (!text) return null;

        const clean = text.replace(/```json|```/g, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(clean);
        } catch (e) {
            const jsonMatch = clean.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
            else return null;
        }

        if (parsed.answer !== 'yes' && parsed.answer !== 'no') return null;

        let confidence = parseFloat(parsed.confidence) || 0.6;
        confidence = Math.min(0.97, Math.max(0.50, confidence));

        if (isClose && confidence > 0.75) confidence = 0.75;

        return {
            answer: parsed.answer === 'yes' ? 1 : 0,
            confidence,
            reason: (parsed.reason || '').slice(0, 60),
            edge: (parsed.edge || '').slice(0, 50),
        };
    } catch (e) {}
    return null;
}

function getProxyAgent(proxyUrl) {
    if (!proxyUrl) return null;
    try {
        if (proxyUrl.toLowerCase().startsWith('socks')) {
            return new SocksProxyAgent(proxyUrl);
        } else {
            return new HttpsProxyAgent(proxyUrl);
        }
    } catch (e) {
        return null;
    }
}

function loadProxies() {
    try {
        if (fs.existsSync('proxies.txt')) {
            return fs.readFileSync('proxies.txt', 'utf8')
                .split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('#') && l.length > 0);
        }
    } catch (e) {}
    return [];
}

async function testProxy(proxyUrl) {
    const agent = getProxyAgent(proxyUrl);
    if (!agent) return false;
    try {
        const response = await axios.get('https://api.ipify.org?format=json', {
            httpsAgent: agent,
            httpAgent: agent,
            timeout: 10000,
        });
        if (response.status === 200 && response.data?.ip) {
            console.log(clr('bGreen', `  ✓ ${proxyUrl.split('@')[1] || proxyUrl} → ${response.data.ip}`));
            return true;
        }
    } catch (e) {
        console.log(clr('bRed', `  ✗ ${proxyUrl.split('@')[1] || proxyUrl} failed`));
    }
    return false;
}

async function validateAndCleanProxies(proxies) {
    console.log(clr('bCyan', `\n🔍 Testing ${proxies.length} proxies...\n`));
    const validProxies = [];
    for (const proxy of proxies) {
        if (await testProxy(proxy)) validProxies.push(proxy);
        await sleep(500);
    }
    console.log(clr('bGreen', `\n✓ ${validProxies.length}/${proxies.length} proxies valid\n`));
    return validProxies;
}

function autoDelay(baseMs, accountIdx = null) {
    const accountVariation = accountIdx !== null ? (accountIdx * 137) % 1000 : 0;
    const jitter = baseMs * 0.4;
    return baseMs - jitter + (Math.random() * jitter * 2) + accountVariation;
}

function randomAccountDelay(idx) {
    const base = 5000 + Math.random() * 10000;
    return Math.floor(base + idx * (3000 + Math.random() * 7000));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function ts() {
    const now = new Date();
    return clr('gray', `[${now.toTimeString().slice(0,8)}]`);
}

function printBanner() {
    const w = 72;
    console.log('\n' + clr('bCyan', '╔' + '═'.repeat(w) + '╗'));
    const lines = [
        '  ██╗   ██╗███████╗███╗   ██╗ ██████╗     ██████╗  ██████╗ ████████╗  ',
        '  ╚██╗ ██╔╝██╔════╝████╗  ██║██╔═══██╗    ██╔══██╗██╔═══██╗╚══██╔══╝  ',
        '   ╚████╔╝ █████╗  ██╔██╗ ██║██║   ██║    ██████╔╝██║   ██║   ██║     ',
        '    ╚██╔╝  ██╔══╝  ██║╚██╗██║██║   ██║    ██╔══██╗██║   ██║   ██║     ',
        '     ██║   ███████╗██║ ╚████║╚██████╔╝    ██████╔╝╚██████╔╝   ██║     ',
        '     ╚═╝   ╚══════╝╚═╝  ╚═══╝ ╚═════╝     ╚═════╝  ╚═════╝   ╚═╝     ',
    ];
    for (const l of lines) {
        console.log(clr('bCyan', '║') + clr('cyan', l) + clr('bCyan', '║'));
    }
    console.log(clr('bCyan', '╠' + '═'.repeat(w) + '╣'));
    const sub = '  🎯  AUTO BETTING BOT  v4.1  ·  Multi-Account  ·  AI-Powered  ';
    console.log(clr('bCyan', '║') + clr('bYellow', sub.padEnd(w)) + clr('bCyan', '║'));
    console.log(clr('bCyan', '╚' + '═'.repeat(w) + '╝') + '\n');
}

function sectionHeader(title, color = 'bCyan') {
    const w = 62;
    const inner = ` ${title} `;
    const side = Math.floor((w - inner.length) / 2);
    const rest = w - side - inner.length;
    console.log('\n' + clr(color, '─'.repeat(Math.max(0, side)) + inner + '─'.repeat(Math.max(0, rest))));
}

function logInfo(idx, msg) { console.log(`${ts()} ${clr('bBlue','[#'+(idx+1)+']')} ${msg}`); }
function logOk(idx, msg)   { console.log(`${ts()} ${clr('bBlue','[#'+(idx+1)+']')} ${clr('bGreen','✔')} ${msg}`); }
function logErr(idx, msg)  { console.log(`${ts()} ${clr('bBlue','[#'+(idx+1)+']')} ${clr('bRed','✘')} ${msg}`); }
function logWarn(idx, msg) { console.log(`${ts()} ${clr('bBlue','[#'+(idx+1)+']')} ${clr('bYellow','⚠')} ${msg}`); }
function logBet(idx, msg)  { console.log(`${ts()} ${clr('bBlue','[#'+(idx+1)+']')} ${clr('bCyan','🎲')} ${msg}`); }
function logAI(idx, msg)   { console.log(`${ts()} ${clr('bBlue','[#'+(idx+1)+']')} ${clr('bMagenta','🤖')} ${msg}`); }
function logSleep(msg)     { console.log(`\n${ts()} ${clr('bMagenta','😴')} ${clr('bMagenta', msg)}`); }
function logWake(msg)      { console.log(`\n${ts()} ${clr('bGreen','⏰')} ${clr('bGreen', msg)}\n`); }

function normalizeQuery(raw) {
    if (!raw) return null;
    raw = raw.trim();
    if (!raw) return null;
    if (raw.startsWith('query_id=') || raw.startsWith('user=')) return raw;
    try {
        const match = raw.match(/^(.*?)(?:&tgWebAppVersion|&tgWebAppPlatform|&tgWebAppBotInline|&tgWebAppThemeParams)/);
        if (match) {
            let extracted = match[1].trim();
            try { extracted = decodeURIComponent(extracted); } catch (e) {}
            return extracted;
        }
        const decoded = decodeURIComponent(raw);
        if (decoded.includes('query_id=') || decoded.includes('user=')) {
            return decoded.split('&tgWebApp')[0].trim();
        }
    } catch (e) {}
    return raw;
}

function loadQueries() {
    try {
        if (fs.existsSync('query.txt')) {
            return fs.readFileSync('query.txt', 'utf8')
                .split('\n').map(l => normalizeQuery(l)).filter(Boolean);
        }
    } catch (e) {}
    return [];
}

function saveQuery(query) {
    const existing = loadQueries();
    if (!existing.includes(query)) fs.appendFileSync('query.txt', query + '\n');
}

function getAccountKey(idx) { return `account_${idx}`; }

function loadActiveBets(idx) {
    try {
        const file = `active_bets_${getAccountKey(idx)}.json`;
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {}
    return {};
}

function saveActiveBets(idx, bets) {
    try { fs.writeFileSync(`active_bets_${getAccountKey(idx)}.json`, JSON.stringify(bets, null, 2)); } catch (e) {}
}

function loadBetHistory(idx) {
    try {
        const file = `bet_history_${getAccountKey(idx)}.json`;
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {}
    return [];
}

function saveBetHistory(idx, history) {
    try { fs.writeFileSync(`bet_history_${getAccountKey(idx)}.json`, JSON.stringify(history.slice(-100), null, 2)); } catch (e) {}
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

async function apiRequest(idx, endpoint, method = 'GET', data = null, retryCount = 0) {
    const query = queries[idx];
    if (!query) throw new Error('No query for account #' + (idx + 1));
    const token = Buffer.from(query).toString('base64');

    const fingerprint = accountStats[idx]?.fingerprint || generateBrowserFingerprint();
    if (!accountStats[idx]?.fingerprint) {
        if (!accountStats[idx]) accountStats[idx] = {};
        accountStats[idx].fingerprint = fingerprint;
    }

    const headers = buildRequestHeaders(fingerprint);
    headers['Authorization'] = `Bearer ${token}`;

    let proxyAgent = null;
    if (config.useProxies && activeProxies.length > 0) {
        if (currentProxyIndex[idx] === undefined) {
            currentProxyIndex[idx] = idx % activeProxies.length;
        }
        const proxy = activeProxies[currentProxyIndex[idx]];
        proxyAgent = getProxyAgent(proxy);
    }

    try {
        const response = await axios({
            method,
            url: `${API_BASE}${endpoint}`,
            headers,
            data,
            httpsAgent: proxyAgent,
            httpAgent: proxyAgent,
            timeout: 15000,
            validateStatus: false
        });

        if (response.status === 401 || response.status === 403) {
            queries[idx] = null;
        }

        if (config.useProxies && proxyFailCount[idx] > 0) {
            proxyFailCount[idx] = 0;
        }

        return response;
    } catch (error) {
        if (config.useProxies && config.rotateProxyOnError && retryCount < config.maxRetriesPerRequest) {
            proxyFailCount[idx] = (proxyFailCount[idx] || 0) + 1;

            if (activeProxies.length > 1) {
                currentProxyIndex[idx] = (currentProxyIndex[idx] + 1) % activeProxies.length;
            }

            if (proxyFailCount[idx] >= config.maxProxyFails && activeProxies.length > 1) {
                const badProxy = activeProxies[currentProxyIndex[idx]];
                activeProxies = activeProxies.filter(p => p !== badProxy);
                currentProxyIndex[idx] = Math.floor(Math.random() * activeProxies.length);
                proxyFailCount[idx] = 0;
            }

            await sleep(autoDelay(3000 + (retryCount * 2000), idx));
            return apiRequest(idx, endpoint, method, data, retryCount + 1);
        }

        if (error.response?.status === 401) {
            queries[idx] = null;
        }
        throw error;
    }
}

async function getUserProfile(idx) { return (await apiRequest(idx, '/user/profile')).data.data; }
async function loadEvents(idx) { return (await apiRequest(idx, '/events/load')).data.data; }
async function getEventPrices(idx, eventId) {
    try { return (await apiRequest(idx, `/events/prices/${eventId}`)).data.data; } catch (e) { return null; }
}

async function decideAnswer(idx, event, priceData) {
    const odds0 = priceData?.prices?.[0] ?? 0.5;
    const odds1 = priceData?.prices?.[1] ?? 0.5;
    const title = event.title || event.id || '';

    if (useGroq && groqApiKey) {
        const result = await askGroq(title, odds0, odds1);
        if (result) {
            const edgePart = result.edge ? ` · ${clr('gray', result.edge)}` : '';
            logAI(idx, `${clr('bMagenta', result.answer === 1 ? 'YES' : 'NO')} · conf ${(result.confidence * 100).toFixed(0)}% · ${result.reason}${edgePart}`);
            return result.answer;
        }
        logWarn(idx, 'Groq failed, falling back to odds strategy');
    }

    if (priceData?.prices) {
        const underdogProb = Math.min(odds0, odds1);
        if (underdogProb > 0.15 && underdogProb < 0.4) {
            return odds0 < odds1 ? 0 : 1;
        } else {
            return odds0 < odds1 ? (Math.random() < 0.55 ? 0 : 1) : (Math.random() < 0.55 ? 1 : 0);
        }
    }
    return Math.random() > 0.5 ? 0 : 1;
}

async function placeBet(idx, eventId, amount, answer) {
    const direction = answer === 1 ? 'right' : 'left';
    const type = answer === 1 ? 'yes' : 'no';
    logBet(idx, `Placing ${clr('bYellow', amount + ' PTS')} on ${clr('bCyan', type.toUpperCase())}`);
    try {
        const userData = await getUserProfile(idx);
        const balanceBefore = userData.points?.amount || 0;
        let noOdds = 153, yesOdds = 10;
        const priceData = await getEventPrices(idx, eventId);
        if (priceData?.prices) {
            noOdds = Math.round(priceData.prices[0] * 100) || noOdds;
            yesOdds = Math.round(priceData.prices[1] * 100) || yesOdds;
        }
        const response = await apiRequest(idx, '/events/submit', 'POST', {
            id: eventId, direction, type,
            prices: { amount, no: noOdds, yes: yesOdds }
        });
        if (response.status === 200 && response.data?.code === 200) {
            let eventTitle = 'Unknown';
            try {
                const events = await loadEvents(idx);
                const ev = events.events?.find(e => e.id === eventId);
                if (ev) eventTitle = ev.title || ev.id;
            } catch (e) {}
            const bets = loadActiveBets(idx);
            bets[eventId] = {
                id: generateUUID(), amount, answer, direction, type,
                answerText: type.toUpperCase(),
                placedAt: new Date().toISOString(),
                eventTitle, balanceAtBetTime: balanceBefore,
                odds: { no: noOdds, yes: yesOdds }
            };
            if (!accountStats[idx]) accountStats[idx] = { totalBets: 0, totalWins: 0, totalLosses: 0, totalPointsSpent: 0, totalPointsEarned: 0, startTime: Date.now() };
            accountStats[idx].totalBets++;
            accountStats[idx].totalPointsSpent += amount;
            saveActiveBets(idx, bets);
            logOk(idx, `Bet placed · ${clr('bWhite', eventTitle.slice(0,38))}`);
            if (response.data?.data?.events) await checkResolvedBets(idx, response.data.data.events);
            return true;
        } else {
            logErr(idx, `Bet failed: ${response.data?.message || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        logErr(idx, `API error: ${error.message}`);
        return false;
    }
}

async function checkResolvedBets(idx, currentEvents) {
    const bets = loadActiveBets(idx);
    if (Object.keys(bets).length === 0) return;
    logInfo(idx, `Checking ${Object.keys(bets).length} active bets...`);
    const userData = await getUserProfile(idx);
    const currentBalance = userData.points?.amount || 0;
    const currentEventIds = new Set(currentEvents.map(e => e.id));
    let wins = 0, losses = 0, stillActive = {};
    if (!accountStats[idx]) accountStats[idx] = { totalBets: 0, totalWins: 0, totalLosses: 0, totalPointsSpent: 0, totalPointsEarned: 0, startTime: Date.now() };
    const history = loadBetHistory(idx);
    for (const [eventId, bet] of Object.entries(bets)) {
        if (!currentEventIds.has(eventId)) {
            const balanceChange = currentBalance - (bet.balanceAtBetTime - bet.amount);
            if (balanceChange > bet.amount * 0.5) {
                wins++;
                accountStats[idx].totalWins++;
                accountStats[idx].totalPointsEarned += balanceChange;
                logOk(idx, `WIN  ${(bet.eventTitle||eventId).slice(0,30)} → +${balanceChange} PTS`);
                history.push({ ...bet, resolvedAt: new Date().toISOString(), result: 'win', profit: balanceChange });
            } else {
                losses++;
                accountStats[idx].totalLosses++;
                logErr(idx, `LOSS ${(bet.eventTitle||eventId).slice(0,30)}`);
                history.push({ ...bet, resolvedAt: new Date().toISOString(), result: 'loss' });
            }
        } else {
            stillActive[eventId] = bet;
        }
    }
    if (wins > 0 || losses > 0) {
        logInfo(idx, `Resolved → +${wins} wins  ${losses} losses`);
    }
    saveActiveBets(idx, stillActive);
    saveBetHistory(idx, history);
}

async function runAccount(idx) {
    if (!queries[idx]) { logWarn(idx, 'Invalid query, skipping.'); return; }
    if (!accountStats[idx]) accountStats[idx] = { totalBets: 0, totalWins: 0, totalLosses: 0, totalPointsSpent: 0, totalPointsEarned: 0, startTime: Date.now() };

    const fingerprint = generateBrowserFingerprint();
    accountStats[idx].fingerprint = fingerprint;

    if (config.useProxies && activeProxies.length > 0) {
        if (currentProxyIndex[idx] === undefined) {
            currentProxyIndex[idx] = idx % activeProxies.length;
        }
        const assignedProxy = activeProxies[currentProxyIndex[idx]];
        const proxyHost = assignedProxy.split('@')[1]?.split(':')[0] || assignedProxy;
        logInfo(idx, `Proxy: ${clr('bCyan', proxyHost)}`);
    }

    sectionHeader(`▶  STARTING ACCOUNT #${idx + 1}`, 'bGreen');

    let userData;
    try { userData = await getUserProfile(idx); }
    catch (e) { logErr(idx, `Failed to get profile: ${e.message}`); return; }

    const userName = userData.name || `Account #${idx + 1}`;
    let balance = userData.points?.amount || 0;
    logOk(idx, `User: ${bold(userName)}  Balance: ${balance} PTS`);

    let cycleCount = 0;
    let consecutiveNoEvents = 0;
    const MAX_CONSECUTIVE = 2;

    while (true) {
        if (!queries[idx]) { logWarn(idx, 'Query removed, stopping.'); break; }
        try {
            cycleCount++;
            console.log(`\n${ts()} ${clr('bBlue','[#'+(idx+1)+']')} ${clr('bYellow','━━ CYCLE #'+cycleCount+' ━━')}`);

            const eventData = await loadEvents(idx);
            const events = eventData.events || [];
            await checkResolvedBets(idx, events);

            userData = await getUserProfile(idx);
            balance = userData.points?.amount || 0;

            if (balance < config.minBalanceToBet) {
                logWarn(idx, `Balance too low (${balance} PTS). Waiting...`);
                await sleep(autoDelay(300000, idx));
                continue;
            }

            const currentBets = loadActiveBets(idx);
            const activeEvents = events.filter(e => !e.is_closed && !currentBets[e.id]);

            logInfo(idx, `Events: ${events.length} total  ${activeEvents.length} available  Active: ${Object.keys(currentBets).length}  Balance: ${balance} PTS`);

            if (activeEvents.length === 0) {
                consecutiveNoEvents++;
                if (consecutiveNoEvents >= MAX_CONSECUTIVE) {
                    logOk(idx, 'All events processed. Done for this cycle.');
                    break;
                }
                await sleep(autoDelay(30000, idx));
                continue;
            }

            consecutiveNoEvents = 0;
            let betsPlaced = 0;

            for (const event of activeEvents) {
                if (balance - (betsPlaced * config.betAmount) < config.betAmount) {
                    logWarn(idx, 'Insufficient balance, stopping bets.');
                    break;
                }
                const freshBets = loadActiveBets(idx);
                if (freshBets[event.id]) continue;

                logInfo(idx, `Event: ${(event.title || event.id).slice(0,52)}`);

                const priceData = await getEventPrices(idx, event.id);
                const answer = await decideAnswer(idx, event, priceData);

                const success = await placeBet(idx, event.id, config.betAmount, answer);
                if (success) betsPlaced++;
                await sleep(autoDelay(2500 + Math.random() * 3000, idx));
            }

            if (betsPlaced === 0) {
                logWarn(idx, 'No bets placed this cycle.');
            } else {
                logOk(idx, `Placed ${betsPlaced} bets`);
            }

            await sleep(autoDelay(15000, idx));

        } catch (error) {
            if (error.message && error.message.includes("Cannot read properties of null")) {
                logOk(idx, 'Bet limit reached. Done for today.');
                break;
            }
            logErr(idx, `Cycle error: ${error.message}`);
            await sleep(autoDelay(30000, idx));
        }
    }
}

async function sleepWithCountdown(ms) {
    const endTime = Date.now() + ms;
    const intervalMs = 30 * 60 * 1000;
    logSleep(`Sleeping ${formatDuration(ms)} until next run...`);
    while (Date.now() < endTime) {
        const remaining = endTime - Date.now();
        if (remaining <= 0) break;
        await sleep(Math.min(intervalMs, remaining));
        const stillLeft = endTime - Date.now();
        if (stillLeft > 5000) {
            logSleep(`Next run in ${formatDuration(stillLeft)}...`);
        }
    }
}

async function showMenu() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise(resolve => rl.question(q, a => resolve(a.trim())));

    console.clear();
    printBanner();

    // Groq setup
    groqApiKey = loadGroqKey();
    if (groqApiKey) {
        console.log(clr('bGreen', `  ✓ Groq API key loaded from grok.txt`));
        const groqChoice = await ask(clr('bYellow', '🤖 Use Groq AI for bet decisions? (y/n): '));
        useGroq = groqChoice.toLowerCase() === 'y';
        if (useGroq) {
            console.log(clr('bGreen', `  ✓ Groq AI enabled · model: ${GROQ_MODEL}`));
        } else {
            console.log(clr('bYellow', '  ➜ Using odds-based strategy'));
        }
    } else {
        console.log(clr('bYellow', '  ⚠ grok.txt not found or invalid — using odds strategy'));
        useGroq = false;
    }

    console.log('');

    // Proxy setup
    console.log(clr('bCyan', '  ╔════════════════════════════════════════════╗'));
    console.log(clr('bCyan', '  ║') + clr('bWhite', '           PROXY CONFIGURATION                ') + clr('bCyan', '║'));
    console.log(clr('bCyan', '  ╠════════════════════════════════════════════╣'));
    console.log(clr('bCyan', '  ║') + clr('bGreen', '  1. ') + clr('white', 'No Proxy (Direct Connection)           ') + clr('bCyan', '║'));
    console.log(clr('bCyan', '  ║') + clr('bGreen', '  2. ') + clr('white', 'Use Proxies from proxies.txt            ') + clr('bCyan', '║'));
    console.log(clr('bCyan', '  ╚════════════════════════════════════════════╝\n'));

    const choice = await ask(clr('bYellow', '➤ Select option (1 or 2): '));

    if (choice === '2') {
        config.useProxies = true;
        proxyList = loadProxies();

        if (proxyList.length > 0) {
            console.log(clr('bGreen', `\n  ✓ Loaded ${proxyList.length} proxies`));

            const validate = await ask(clr('bYellow', 'Validate proxies before using? (y/n): '));
            if (validate.toLowerCase() === 'y') {
                activeProxies = await validateAndCleanProxies(proxyList);
                if (activeProxies.length === 0) {
                    console.log(clr('bRed', '\n  ✗ No valid proxies found! Running without proxies.'));
                    config.useProxies = false;
                } else {
                    console.log(clr('bGreen', `\n  ✓ ${activeProxies.length} valid proxies ready`));
                    const rotateChoice = await ask(clr('bYellow', 'Auto-rotate on failure? (y/n): '));
                    config.rotateProxyOnError = rotateChoice.toLowerCase() === 'y';
                }
            } else {
                activeProxies = proxyList;
                console.log(clr('bGreen', `  ✓ ${activeProxies.length} proxies ready`));
                const rotateChoice = await ask(clr('bYellow', 'Auto-rotate on failure? (y/n): '));
                config.rotateProxyOnError = rotateChoice.toLowerCase() === 'y';
            }
        } else {
            console.log(clr('bRed', '\n  ✗ No proxies found in proxies.txt!'));
            const useAnyway = await ask(clr('bYellow', 'Run without proxies? (y/n): '));
            if (useAnyway.toLowerCase() !== 'y') {
                console.log(clr('bRed', 'Exiting...'));
                process.exit(0);
            }
            config.useProxies = false;
        }
    } else {
        config.useProxies = false;
        console.log(clr('bGreen', '\n  ✓ Running without proxies'));
    }

    const betAmountRaw = await ask(clr('bYellow', '\n💰 Bet amount per event (default 5 PTS): '));
    config.betAmount = parseInt(betAmountRaw) || 5;

    console.log(clr('bGreen', '\n  ✓ Configuration complete!'));
    console.log(clr('bGreen', `  ✓ Bet amount: ${config.betAmount} PTS`));
    console.log(clr('bGreen', `  ✓ AI mode: ${useGroq ? 'Groq (' + GROQ_MODEL + ')' : 'Odds strategy'}`));
    console.log(clr('bGreen', `  ✓ Proxy mode: ${config.useProxies ? 'Enabled (' + activeProxies.length + ' proxies)' : 'Disabled'}`));
    if (config.useProxies) {
        console.log(clr('bGreen', `  ✓ Auto-rotate: ${config.rotateProxyOnError ? 'ON' : 'OFF'}`));
    }

    await sleep(2000);
    rl.close();
}

async function main() {
    await showMenu();

    let runCount = 0;

    console.clear();
    printBanner();

    while (true) {
        runCount++;
        queries = loadQueries();

        if (queries.length === 0) {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            const query = await new Promise(resolve =>
                rl.question(clr('bYellow', '\n📝 Paste your query data: '), a => { rl.close(); resolve(normalizeQuery(a)); })
            );
            saveQuery(query);
            queries = [query];
        }

        sectionHeader(`🚀  RUN #${runCount}  ·  ${queries.length} account(s)`, 'bGreen');
        console.log('');

        await Promise.all(
            queries.map((_, idx) =>
                (async () => {
                    if (idx > 0) {
                        const delay = randomAccountDelay(idx);
                        logInfo(idx, `Starting in ${Math.round(delay / 1000)}s...`);
                        await sleep(delay);
                    }
                    await runAccount(idx);
                })()
            )
        );

        const sleepHours = 22 + Math.random() * 4;
        const sleepMs = Math.floor(sleepHours * 60 * 60 * 1000);

        await sleepWithCountdown(sleepMs);
        logWake(`Waking up! Starting run #${runCount + 1}...`);

        accountStats = {};
    }
}

process.on('SIGINT', () => {
    console.log('\n');
    console.log(clr('bGreen', '  ✔ Shutting down...\n'));
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error(clr('bRed', `\n❌ Error: ${err.message}`));
});

console.log(clr('bYellow', '⚠️  Make sure to install: npm install axios socks-proxy-agent https-proxy-agent\n'));

main().catch(console.error);
