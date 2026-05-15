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
let predictionHistory = [];

let config = {
    betAmount: 5,
    minBalanceToBet: 10,
    useProxies: false,
    rotateProxyOnError: true,
    maxRetriesPerRequest: 2,
    requestDelay: { min: 2000, max: 8000 },
    maxProxyFails: 3,
    useEnsembleMethod: true,
    adjustBetByConfidence: true,
    minAiConfidence: 0.60,
};

const C = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    black: '\x1b[30m', red: '\x1b[31m', green: '\x1b[32m',
    yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m',
    cyan: '\x1b[36m', white: '\x1b[37m', gray: '\x1b[90m',
    bRed: '\x1b[91m', bGreen: '\x1b[92m', bYellow: '\x1b[93m',
    bBlue: '\x1b[94m', bMagenta: '\x1b[95m', bCyan: '\x1b[96m', bWhite: '\x1b[97m',
};

function clr(color, text) {
    if (!C[color]) return text;
    return `${C[color]}${text}${C.reset}`;
}

function bold(text) { return `${C.bold}${text}${C.reset}`; }

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 12; SM-A525F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-N986B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Edg/120.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Edg/119.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Edg/120.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 OPR/105.0.0.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/121.0.6167.37 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

const WEBGL_RENDERERS = [
    'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)',
    'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)',
    'ANGLE (AMD, Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
    'ANGLE (Intel, Intel(R) Iris Xe Graphics Direct3D11 vs_5_0 ps_5_0)',
    'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',
    'ANGLE (AMD, Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0)',
];

const WEBGL_VENDORS = ['Google Inc. (Intel)', 'NVIDIA Corporation', 'Advanced Micro Devices, Inc.', 'Intel Inc.'];
const PLATFORMS = ['Win32', 'MacIntel', 'Linux x86_64', 'iPhone', 'iPad', 'Android', 'Linux armv8l'];
const CPU_CLASSES = ['x86', 'x86_64', 'ARM', 'ARM64', 'Intel Core i7', 'AMD Ryzen 5'];
const LANGUAGES = [['en-US', 'en'], ['en-GB', 'en'], ['zh-CN', 'zh', 'en-US', 'en'], ['es-ES', 'es', 'en'], ['fr-FR', 'fr', 'en']];
const TIMEZONES = [-420, -300, -240, -180, 0, 60, 120, 180, 240, 330, 480, 570, 660];
const SCREEN_RESOLUTIONS = [
    { width: 1920, height: 1080 }, { width: 1366, height: 768 },
    { width: 1536, height: 864 }, { width: 1440, height: 900 },
    { width: 2560, height: 1440 }, { width: 3840, height: 2160 },
    { width: 1280, height: 720 }, { width: 1600, height: 900 },
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
function generateRandomDeviceMemory() { const memories = [2, 4, 8, 16, 32]; return memories[Math.floor(Math.random() * memories.length)]; }
function generateRandomHardwareConcurrency() { const cores = [2, 4, 6, 8, 12, 16, 24]; return cores[Math.floor(Math.random() * cores.length)]; }
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
        if (fs.existsSync('groq.txt')) {
            const key = fs.readFileSync('groq.txt', 'utf8').trim();
            if (key && key.startsWith('gsk_')) return key;
        }
    } catch (e) {}
    return null;
}

function loadPredictionHistory() {
    try {
        if (fs.existsSync('prediction_history.json')) {
            return JSON.parse(fs.readFileSync('prediction_history.json', 'utf8'));
        }
    } catch (e) {}
    return [];
}

function savePredictionHistory(history) {
    try {
        fs.writeFileSync('prediction_history.json', JSON.stringify(history.slice(-200), null, 2));
    } catch (e) {}
}

function updatePredictionAccuracy() {
    const history = loadPredictionHistory();
    if (history.length === 0) return null;
    const recent = history.slice(-50);
    const correct = recent.filter(p => p.correct).length;
    const accuracy = correct / recent.length;
    return {
        overall: accuracy,
        recent20: history.slice(-20).filter(p => p.correct).length / 20,
        totalPredictions: history.length
    };
}

function getCategoryFromTitle(title) {
    const lower = title.toLowerCase();
    if (lower.includes('sport') || lower.includes('game') || lower.includes('match') || lower.includes('vs') || lower.includes('win')) return 'sports';
    if (lower.includes('crypto') || lower.includes('bitcoin') || lower.includes('eth') || lower.includes('price')) return 'crypto';
    if (lower.includes('election') || lower.includes('president') || lower.includes('vote') || lower.includes('poll')) return 'politics';
    if (lower.includes('stock') || lower.includes('market') || lower.includes('economy') || lower.includes('fed')) return 'finance';
    if (lower.includes('weather') || lower.includes('storm') || lower.includes('temperature')) return 'weather';
    if (lower.includes('tech') || lower.includes('ai') || lower.includes('product') || lower.includes('launch')) return 'technology';
    return 'general';
}

function getSpecializedSystemPrompt(category) {
    const prompts = {
        sports: `You are a sports betting expert with deep knowledge of all major sports. Consider home field advantage, recent form, head-to-head history, injuries, rest days, motivation, and weather conditions. Be decisive and avoid 50/50 predictions.`,
        crypto: `You are a cryptocurrency market analyst. Consider technical indicators, market sentiment, news, whale movements, regulatory updates, and macroeconomic factors. Cryptocurrency events have high volatility - adjust confidence accordingly.`,
        politics: `You are a political analyst specializing in elections. Consider polling data, fundraising, historical patterns, endorsements, debate performances, current events, and voter turnout.`,
        finance: `You are a financial markets expert. Consider company fundamentals, market trends, economic indicators, Federal Reserve policy, geopolitical events, and analyst ratings.`,
        general: `You are a prediction market expert with high accuracy. Establish base rate probability, identify market inefficiencies, consider time remaining, look for catalysts, and be decisive.`
    };
    return prompts[category] || prompts.general;
}

async function askGroq(eventTitle, odds0, odds1, retryCount = 0) {
    if (!groqApiKey) return null;
    try {
        const category = getCategoryFromTitle(eventTitle);
        const noOddsStr = (odds0 * 100).toFixed(1);
        const yesOddsStr = (odds1 * 100).toFixed(1);
        const noPct = parseFloat(noOddsStr);
        const yesPct = parseFloat(yesOddsStr);
        const marketFavorite = yesPct > noPct ? 'YES' : (noPct > yesPct ? 'NO' : 'EVEN');
        const spread = Math.abs(yesPct - noPct).toFixed(1);
        const isLopsided = Math.max(yesPct, noPct) > 75;
        const isClose = Math.abs(yesPct - noPct) < 12;
        
        const accuracyStats = updatePredictionAccuracy();
        const accuracyNote = accuracyStats && accuracyStats.recent20 > 0.6 
            ? `\nNote: My recent prediction accuracy is ${(accuracyStats.recent20 * 100).toFixed(0)}% - I'm calibrated.`
            : '';
        
        const systemPrompt = getSpecializedSystemPrompt(category) + `

CRITICAL OUTPUT RULES:
- Respond ONLY with valid JSON. No markdown, no explanations outside JSON.
- Format: {"answer": "yes", "confidence": 0.75, "reason": "brief reason max 15 words", "edge": "market inefficiency or 'market correct'"}
- answer: "yes" or "no" ONLY
- confidence: float between 0.60 and 0.92 (never below 0.60, never above 0.92)
- Be decisive - avoid 0.50-0.60 range unless truly random event
- Higher confidence (>0.80) only when very sure
- Lower confidence (0.60-0.70) for close calls or unpredictable events${accuracyNote}`;

        const userPrompt = `PREDICTION EVENT ANALYSIS

TITLE: "${eventTitle}"
CATEGORY: ${category.toUpperCase()}

CURRENT MARKET ODDS:
- NO: ${noOddsStr}% (market says event will NOT happen)
- YES: ${yesOddsStr}% (market says event WILL happen)

MARKET SIGNALS:
- Favorite: ${marketFavorite}
- Spread: ${spread}% difference between outcomes
${isLopsided ? '- ⚠️ Market is heavily one-sided (>75%) - potential overconfidence' : ''}
${isClose ? '- ⚠️ Market is very close (<12% spread) - informational edge is critical' : ''}

ANALYSIS STEPS:
1. What is the base rate for this type of event?
2. Is the market overconfident or underconfident?
3. What specific factors could change the outcome?
4. Your final prediction with confidence

Respond with JSON only.`;

        const response = await axios.post(GROQ_API_URL, {
            model: GROQ_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.2,
            max_tokens: 200,
            top_p: 0.85,
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

        let confidence = parseFloat(parsed.confidence) || 0.65;
        confidence = Math.min(0.92, Math.max(0.60, confidence));
        
        if (isClose && confidence > 0.80) confidence = 0.75;
        if (isLopsided && confidence < 0.70) confidence = 0.70;
        
        if (accuracyStats && accuracyStats.recent20 > 0.65) {
            confidence = Math.min(0.92, confidence + 0.02);
        } else if (accuracyStats && accuracyStats.recent20 < 0.55) {
            confidence = Math.max(0.60, confidence - 0.03);
        }

        return {
            answer: parsed.answer === 'yes' ? 1 : 0,
            confidence,
            reason: (parsed.reason || '').slice(0, 60),
            edge: (parsed.edge || '').slice(0, 50),
            category
        };
        
    } catch (error) {
        if (retryCount === 0) {
            console.log(clr('bYellow', `  ⚠️ Groq API error: ${error.message}, retrying...`));
            await sleep(2000);
            return askGroq(eventTitle, odds0, odds1, retryCount + 1);
        }
        return null;
    }
}

async function askGroqWithRetry(eventTitle, odds0, odds1) {
    return await askGroq(eventTitle, odds0, odds1, 0);
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
    const sub = '  🎯  AUTO BETTING BOT  v5.0  ·  AI-Powered  ·  Enhanced Accuracy  ';
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
    
    let groqResult = null;
    if (useGroq && groqApiKey) {
        groqResult = await askGroqWithRetry(title, odds0, odds1);
        if (groqResult) {
            const edgePart = groqResult.edge ? ` · ${clr('gray', groqResult.edge)}` : '';
            logAI(idx, `${clr('bMagenta', groqResult.answer === 1 ? 'YES' : 'NO')} · conf ${(groqResult.confidence * 100).toFixed(0)}% · ${groqResult.reason}${edgePart}`);
            
            predictionHistory.push({
                timestamp: Date.now(),
                eventTitle: title.slice(0, 50),
                category: groqResult.category,
                predicted: groqResult.answer,
                confidence: groqResult.confidence,
                marketYes: odds1,
                marketNo: odds0
            });
            savePredictionHistory(predictionHistory);
        } else {
            logWarn(idx, 'Groq failed, falling back to strategy');
        }
    }
    
    if (config.useEnsembleMethod && groqResult) {
        const marketPrediction = odds1 > odds0 ? 1 : 0;
        const marketStrength = Math.abs(odds1 - odds0);
        
        let aiWeight = 0.6;
        if (groqResult.confidence > 0.8) aiWeight = 0.75;
        if (groqResult.confidence < 0.65) aiWeight = 0.45;
        
        const finalScore = (groqResult.answer * aiWeight) + (marketPrediction * (1 - aiWeight));
        const finalAnswer = finalScore > 0.5 ? 1 : 0;
        
        if (groqResult.answer === marketPrediction) {
            logAI(idx, `🤝 AI & market agree · ${groqResult.answer === 1 ? 'YES' : 'NO'}`);
        } else {
            logAI(idx, `⚡ AI vs market · AI:${groqResult.answer === 1 ? 'YES' : 'NO'} vs Market:${marketPrediction === 1 ? 'YES' : 'NO'} · Following ${finalAnswer === groqResult.answer ? 'AI' : 'market'}`);
        }
        
        if (!accountStats[idx]) accountStats[idx] = {};
        if (!accountStats[idx].predictions) accountStats[idx].predictions = [];
        accountStats[idx].predictions.push({
            eventId: event.id,
            aiPrediction: groqResult.answer,
            aiConfidence: groqResult.confidence,
            marketPrediction,
            finalAnswer,
            timestamp: Date.now()
        });
        
        return finalAnswer;
    }
    
    if (groqResult && (groqResult.confidence > config.minAiConfidence || !config.useEnsembleMethod)) {
        return groqResult.answer;
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

async function placeBet(idx, eventId, amount, answer, confidence = null) {
    const direction = answer === 1 ? 'right' : 'left';
    const type = answer === 1 ? 'yes' : 'no';
    
    let finalAmount = amount;
    if (config.adjustBetByConfidence && confidence) {
        if (confidence > 0.85) {
            finalAmount = Math.floor(amount * 1.5);
            logAI(idx, `📈 High confidence (${Math.round(confidence*100)}%) → increased bet to ${finalAmount} PTS`);
        } else if (confidence < 0.65) {
            finalAmount = Math.floor(amount * 0.5);
            logAI(idx, `📉 Low confidence (${Math.round(confidence*100)}%) → reduced bet to ${finalAmount} PTS`);
        }
    }
    
    logBet(idx, `Placing ${clr('bYellow', finalAmount + ' PTS')} on ${clr('bCyan', type.toUpperCase())}`);
    
    try {
        const userData = await getUserProfile(idx);
        const balanceBefore = userData.points?.amount || 0;
        
        const maxBet = Math.floor(balanceBefore * 0.25);
        if (finalAmount > maxBet) {
            finalAmount = Math.max(amount, Math.floor(maxBet));
            logWarn(idx, `Bet capped at ${finalAmount} PTS (25% of balance)`);
        }
        
        let noOdds = 153, yesOdds = 10;
        const priceData = await getEventPrices(idx, eventId);
        if (priceData?.prices) {
            noOdds = Math.round(priceData.prices[0] * 100) || noOdds;
            yesOdds = Math.round(priceData.prices[1] * 100) || yesOdds;
        }
        
        const response = await apiRequest(idx, '/events/submit', 'POST', {
            id: eventId, direction, type,
            prices: { amount: finalAmount, no: noOdds, yes: yesOdds }
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
                id: generateUUID(),
                amount: finalAmount,
                answer,
                direction,
                type,
                answerText: type.toUpperCase(),
                placedAt: new Date().toISOString(),
                eventTitle,
                balanceAtBetTime: balanceBefore,
                odds: { no: noOdds, yes: yesOdds },
                aiConfidence: confidence || null
            };
            
            if (!accountStats[idx]) {
                accountStats[idx] = { 
                    totalBets: 0, totalWins: 0, totalLosses: 0, 
                    totalPointsSpent: 0, totalPointsEarned: 0, 
                    startTime: Date.now(),
                    aiPredictions: 0,
                    aiCorrect: 0
                };
            }
            accountStats[idx].totalBets++;
            accountStats[idx].totalPointsSpent += finalAmount;
            if (confidence) accountStats[idx].aiPredictions++;
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
    
    if (!accountStats[idx]) {
        accountStats[idx] = { totalBets: 0, totalWins: 0, totalLosses: 0, totalPointsSpent: 0, totalPointsEarned: 0, startTime: Date.now() };
    }
    
    const history = loadBetHistory(idx);
    
    for (const [eventId, bet] of Object.entries(bets)) {
        if (!currentEventIds.has(eventId)) {
            const balanceChange = currentBalance - (bet.balanceAtBetTime - bet.amount);
            if (balanceChange > bet.amount * 0.5) {
                wins++;
                accountStats[idx].totalWins++;
                accountStats[idx].totalPointsEarned += balanceChange;
                
                if (bet.aiConfidence) {
                    accountStats[idx].aiCorrect++;
                    const aiAccuracy = (accountStats[idx].aiCorrect / accountStats[idx].aiPredictions) * 100;
                    logOk(idx, `WIN  ${(bet.eventTitle||eventId).slice(0,30)} → +${balanceChange} PTS · 🤖 AI accuracy: ${aiAccuracy.toFixed(1)}%`);
                } else {
                    logOk(idx, `WIN  ${(bet.eventTitle||eventId).slice(0,30)} → +${balanceChange} PTS`);
                }
                
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
        const winRate = accountStats[idx].totalBets > 0 
            ? (accountStats[idx].totalWins / accountStats[idx].totalBets * 100).toFixed(1)
            : 0;
        logInfo(idx, `Resolved → +${wins} wins / ${losses} losses · Win rate: ${winRate}%`);
        
        if (accountStats[idx].aiPredictions > 0) {
            const aiAccuracy = (accountStats[idx].aiCorrect / accountStats[idx].aiPredictions * 100).toFixed(1);
            logInfo(idx, `🤖 AI record: ${accountStats[idx].aiCorrect}/${accountStats[idx].aiPredictions} (${aiAccuracy}%)`);
        }
    }
    
    saveActiveBets(idx, stillActive);
    saveBetHistory(idx, history);
}

async function runAccount(idx) {
    if (!queries[idx]) { logWarn(idx, 'Invalid query, skipping.'); return; }
    if (!accountStats[idx]) {
        accountStats[idx] = { 
            totalBets: 0, totalWins: 0, totalLosses: 0, 
            totalPointsSpent: 0, totalPointsEarned: 0, 
            startTime: Date.now(),
            aiPredictions: 0,
            aiCorrect: 0
        };
    }

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
    
    const accuracyStats = updatePredictionAccuracy();
    if (accuracyStats && accuracyStats.recent20) {
        logInfo(idx, `🤖 Global AI accuracy (last 20): ${(accuracyStats.recent20 * 100).toFixed(1)}%`);
    }

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
                const result = await decideAnswer(idx, event, priceData);
                
                let confidence = null;
                if (useGroq && groqApiKey) {
                    confidence = result.confidence || null;
                }

                const success = await placeBet(idx, event.id, config.betAmount, result.answer || result, confidence);
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

    predictionHistory = loadPredictionHistory();
    const accuracyStats = updatePredictionAccuracy();
    
    groqApiKey = loadGroqKey();
    if (groqApiKey) {
        console.log(clr('bGreen', `  ✓ Groq API key loaded from grok.txt`));
        if (accuracyStats && accuracyStats.totalPredictions > 0) {
            console.log(clr('bCyan', `  📊 Historical AI accuracy: ${(accuracyStats.overall * 100).toFixed(1)}% (${accuracyStats.totalPredictions} predictions)`));
        }
        const groqChoice = await ask(clr('bYellow', '🤖 Use Groq AI for bet decisions? (y/n): '));
        useGroq = groqChoice.toLowerCase() === 'y';
        if (useGroq) {
            console.log(clr('bGreen', `  ✓ Groq AI enabled · model: ${GROQ_MODEL}`));
            console.log(clr('bGreen', `  ✓ Ensemble method (AI + market): ENABLED by default`));
            console.log(clr('bGreen', `  ✓ Confidence-based betting: ENABLED by default`));
        } else {
            console.log(clr('bYellow', '  ➜ Using odds-based strategy'));
        }
    } else {
        console.log(clr('bYellow', '  ⚠ grok.txt not found or invalid — using odds strategy'));
        useGroq = false;
    }

    console.log('');

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
    if (useGroq) {
        console.log(clr('bGreen', `  ✓ Ensemble method: ON (AI + market combination)`));
        console.log(clr('bGreen', `  ✓ Confidence-based betting: ON (adjusts bet size)`));
    }
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