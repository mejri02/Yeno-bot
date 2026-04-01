const axios = require('axios');
const fs = require('fs');
const readline = require('readline');

const API_BASE = 'https://api.yeno.pro/tma/v1';

let queries = [];
let accountStats = {};

let config = {
    betAmount: 5,
    minBalanceToBet: 10,
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

function clr(color, text) { return `${C[color] || ''}${text}${C.reset}`; }
function bold(text)        { return `${C.bold}${text}${C.reset}`; }

function autoDelay(baseMs) {
    const jitter = baseMs * 0.4;
    return baseMs - jitter + Math.random() * jitter * 2;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

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

function bar(value, max, width = 18) {
    const filled = Math.round((value / Math.max(max, 1)) * width);
    const empty  = width - filled;
    return clr('bGreen', '█'.repeat(Math.max(0, filled))) + clr('gray', '░'.repeat(Math.max(0, empty)));
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
    const sub = '  🎯  AUTO BETTING BOT  v3.0  ·  Multi-Account  ·  Smart Value Bets  ';
    console.log(clr('bCyan', '║') + clr('bYellow', sub.padEnd(w)) + clr('bCyan', '║'));
    console.log(clr('bCyan', '╚' + '═'.repeat(w) + '╝') + '\n');
}

function sectionHeader(title, color = 'bCyan') {
    const w = 62;
    const inner = ` ${title} `;
    const side  = Math.floor((w - inner.length) / 2);
    const rest  = w - side - inner.length;
    console.log('\n' + clr(color, '─'.repeat(Math.max(0, side)) + inner + '─'.repeat(Math.max(0, rest))));
}

function logInfo(idx, msg)  { console.log(`${ts()} ${clr('bBlue','[#'+(idx+1)+']')} ${msg}`); }
function logOk(idx, msg)    { console.log(`${ts()} ${clr('bBlue','[#'+(idx+1)+']')} ${clr('bGreen','✔')} ${msg}`); }
function logErr(idx, msg)   { console.log(`${ts()} ${clr('bBlue','[#'+(idx+1)+']')} ${clr('bRed','✘')} ${msg}`); }
function logWarn(idx, msg)  { console.log(`${ts()} ${clr('bBlue','[#'+(idx+1)+']')} ${clr('bYellow','⚠')} ${msg}`); }
function logBet(idx, msg)   { console.log(`${ts()} ${clr('bBlue','[#'+(idx+1)+']')} ${clr('bCyan','🎲')} ${msg}`); }
function logSleep(msg)      { console.log(`\n${ts()} ${clr('bMagenta','😴')} ${clr('bMagenta', msg)}`); }
function logWake(msg)       { console.log(`\n${ts()} ${clr('bGreen','⏰')} ${clr('bGreen', msg)}\n`); }

function showStats(idx, userName) {
    const s       = accountStats[idx] || {};
    const runtime = Math.floor((Date.now() - (s.startTime || Date.now())) / 1000);
    const winRate = (s.totalBets || 0) > 0 ? (((s.totalWins || 0) / s.totalBets) * 100).toFixed(1) : '0.0';
    const net     = (s.totalPointsEarned || 0) - (s.totalPointsSpent || 0);
    const bets    = loadActiveBets(idx);
    const wR      = parseFloat(winRate);

    sectionHeader(`📊 ACCOUNT #${idx + 1}  ·  ${userName || 'Unknown'}`, 'bBlue');
    console.log(
        `  ${clr('gray','⏱  Runtime')}  ${clr('bWhite', formatTime(runtime))}   ` +
        `${clr('gray','·')}  ${clr('gray','Bet size')}  ${clr('bYellow', config.betAmount + ' PTS')}`
    );
    console.log(
        `  ${clr('gray','🎯 Bets')}     ${clr('bWhite', String(s.totalBets||0).padEnd(5))}` +
        `  ${clr('bGreen','✔ '+(s.totalWins||0))}  ${clr('bRed','✘ '+(s.totalLosses||0))}  ` +
        `WR: ${clr(wR>=55?'bGreen':wR>=40?'bYellow':'bRed', winRate+'%')}  ${bar(wR, 100, 14)}`
    );
    console.log(
        `  ${clr('gray','💸 Spent')}    ${clr('yellow', (s.totalPointsSpent||0)+' PTS')}   ` +
        `${clr('gray','·')}  ${clr('gray','Earned')}  ${clr('bGreen', (s.totalPointsEarned||0)+' PTS')}`
    );
    console.log(
        `  ${clr('gray','📈 Net P&L')}  ${clr(net>=0?'bGreen':'bRed', bold((net>=0?'+':'')+net+' PTS'))}   ` +
        `${clr('gray','·')}  ${clr('gray','Active bets')}  ${clr('bCyan', Object.keys(bets).length)}`
    );
    console.log(clr('blue', '─'.repeat(62)));
}

function showGlobalStats() {
    let totalBets = 0, totalWins = 0, totalLosses = 0, totalSpent = 0, totalEarned = 0;
    for (const s of Object.values(accountStats)) {
        totalBets   += s.totalBets    || 0;
        totalWins   += s.totalWins    || 0;
        totalLosses += s.totalLosses  || 0;
        totalSpent  += s.totalPointsSpent  || 0;
        totalEarned += s.totalPointsEarned || 0;
    }
    const winRate = totalBets > 0 ? ((totalWins/totalBets)*100).toFixed(1) : '0.0';
    const net     = totalEarned - totalSpent;
    const w       = 62;

    console.log('\n' + clr('bMagenta', '╔' + '═'.repeat(w) + '╗'));
    console.log(clr('bMagenta', '║') + clr('bWhite', bold('  🌐 GLOBAL SUMMARY'.padEnd(w))) + clr('bMagenta', '║'));
    console.log(clr('bMagenta', '╠' + '─'.repeat(w) + '╣'));
    const row = (label, value, vc = 'bWhite') =>
        console.log(
            clr('bMagenta','║') +
            clr('gray', `  ${label}`.padEnd(22)) +
            clr(vc, String(value).padEnd(w-22)) +
            clr('bMagenta','║')
        );
    row('👥 Accounts',    queries.filter(Boolean).length);
    row('🎯 Total Bets',  totalBets);
    row('✔  Wins',        totalWins,   'bGreen');
    row('✘  Losses',      totalLosses, 'bRed');
    row('📊 Win Rate',    winRate+'%', parseFloat(winRate)>=50?'bGreen':'bYellow');
    row('💸 Total Spent', totalSpent+' PTS', 'yellow');
    row('💵 Total Earned',totalEarned+' PTS','bGreen');
    row('📈 Net P&L',     (net>=0?'+':'')+net+' PTS', net>=0?'bGreen':'bRed');
    console.log(clr('bMagenta', '╚' + '═'.repeat(w) + '╝') + '\n');
}

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

function getAccountKey(idx)  { return `account_${idx}`; }

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

async function apiRequest(idx, endpoint, method = 'GET', data = null) {
    const query = queries[idx];
    if (!query) throw new Error('No query for account #' + (idx + 1));
    const token = Buffer.from(query).toString('base64');
    try {
        const response = await axios({
            method,
            url: `${API_BASE}${endpoint}`,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            data,
            timeout: 15000,
            validateStatus: false
        });
        if (response.status !== 200) {
            logWarn(idx, `${endpoint} → HTTP ${response.status}`);
        }
        return response;
    } catch (error) {
        if (error.response?.status === 401) {
            logErr(idx, 'Query expired, removing account.');
            queries[idx] = null;
        }
        throw error;
    }
}

async function getUserProfile(idx)          { return (await apiRequest(idx, '/user/profile')).data.data; }
async function loadEvents(idx)              { return (await apiRequest(idx, '/events/load')).data.data; }
async function getEventPrices(idx, eventId) {
    try { return (await apiRequest(idx, `/events/prices/${eventId}`)).data.data; } catch (e) { return null; }
}

async function placeBet(idx, eventId, amount, answer) {
    const direction = answer === 1 ? 'right' : 'left';
    const type      = answer === 1 ? 'yes'   : 'no';
    logBet(idx, `Placing ${clr('bYellow', amount + ' PTS')} on ${clr('bCyan', type.toUpperCase())}`);
    try {
        const userData      = await getUserProfile(idx);
        const balanceBefore = userData.points?.amount || 0;
        const betId         = generateUUID();
        let noOdds = 153, yesOdds = 10;
        const priceData     = await getEventPrices(idx, eventId);
        if (priceData?.prices) {
            noOdds  = Math.round(priceData.prices[0] * 100) || noOdds;
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
                id: betId, amount, answer, direction, type,
                answerText: type.toUpperCase(),
                placedAt: new Date().toISOString(),
                eventTitle, balanceAtBetTime: balanceBefore,
                odds: { no: noOdds, yes: yesOdds }
            };
            if (!accountStats[idx]) accountStats[idx] = { totalBets: 0, totalWins: 0, totalLosses: 0, totalPointsSpent: 0, totalPointsEarned: 0, startTime: Date.now() };
            accountStats[idx].totalBets++;
            accountStats[idx].totalPointsSpent += amount;
            saveActiveBets(idx, bets);
            logOk(idx, `Bet placed · ${clr('bWhite', eventTitle.slice(0,38))} · Odds NO=${noOdds} YES=${yesOdds}`);
            if (response.data?.data?.user?.points) {
                logInfo(idx, `Balance → ${clr('bGreen', response.data.data.user.points.amount + ' PTS')}`);
            }
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
    logInfo(idx, `Checking ${clr('bCyan', Object.keys(bets).length)} active bets...`);
    const userData        = await getUserProfile(idx);
    const currentBalance  = userData.points?.amount || 0;
    const currentEventIds = new Set(currentEvents.map(e => e.id));
    let wins = 0, losses = 0, stillActive = {}, totalProfit = 0;
    if (!accountStats[idx]) accountStats[idx] = { totalBets: 0, totalWins: 0, totalLosses: 0, totalPointsSpent: 0, totalPointsEarned: 0, startTime: Date.now() };
    const history = loadBetHistory(idx);
    for (const [eventId, bet] of Object.entries(bets)) {
        if (!currentEventIds.has(eventId)) {
            const balanceChange = currentBalance - (bet.balanceAtBetTime - bet.amount);
            if (balanceChange > bet.amount * 0.5) {
                wins++;
                accountStats[idx].totalWins++;
                accountStats[idx].totalPointsEarned += balanceChange;
                totalProfit += balanceChange;
                logOk(idx, `WIN  ${clr('bWhite', (bet.eventTitle||eventId).slice(0,30))} → ${clr('bGreen','+'+balanceChange+' PTS')}`);
                history.push({ ...bet, resolvedAt: new Date().toISOString(), result: 'win', profit: balanceChange, finalBalance: currentBalance });
            } else {
                losses++;
                accountStats[idx].totalLosses++;
                logErr(idx, `LOSS ${clr('white', (bet.eventTitle||eventId).slice(0,30))}`);
                history.push({ ...bet, resolvedAt: new Date().toISOString(), result: 'loss', finalBalance: currentBalance });
            }
        } else {
            stillActive[eventId] = bet;
        }
    }
    if (wins > 0 || losses > 0) {
        logInfo(idx, `Resolved → ${clr('bGreen','+'+wins+' wins')}  ${clr('bRed',losses+' losses')}  net ${clr('bCyan','+'+totalProfit+' PTS')}`);
    }
    saveActiveBets(idx, stillActive);
    saveBetHistory(idx, history);
}

async function runAccount(idx) {
    if (!queries[idx]) { logWarn(idx, 'Invalid query, skipping.'); return; }
    if (!accountStats[idx]) accountStats[idx] = { totalBets: 0, totalWins: 0, totalLosses: 0, totalPointsSpent: 0, totalPointsEarned: 0, startTime: Date.now() };

    sectionHeader(`▶  STARTING ACCOUNT #${idx + 1}`, 'bGreen');

    let userData;
    try { userData = await getUserProfile(idx); }
    catch (e) { logErr(idx, `Failed to get profile: ${e.message}`); return; }

    const userName = userData.name || `Account #${idx + 1}`;
    let balance    = userData.points?.amount || 0;
    logOk(idx, `User: ${clr('bWhite', bold(userName))}  Balance: ${clr('bGreen', balance + ' PTS')}`);

    let cycleCount          = 0;
    let consecutiveNoEvents = 0;
    const MAX_CONSECUTIVE   = 2;

    while (true) {
        if (!queries[idx]) { logWarn(idx, 'Query removed, stopping.'); break; }
        try {
            cycleCount++;
            console.log(`\n${ts()} ${clr('bBlue','[#'+(idx+1)+']')} ${clr('bYellow','━━ CYCLE #'+cycleCount+' ━━')}`);

            const eventData  = await loadEvents(idx);
            const events     = eventData.events || [];
            await checkResolvedBets(idx, events);

            userData = await getUserProfile(idx);
            balance  = userData.points?.amount || 0;

            if (balance < config.minBalanceToBet) {
                logWarn(idx, `Balance too low (${clr('bRed', balance + ' PTS')}). Waiting 5 min...`);
                await sleep(autoDelay(300000));
                continue;
            }

            const currentBets  = loadActiveBets(idx);
            const activeEvents = events.filter(e => !e.is_closed && !currentBets[e.id]);

            logInfo(idx,
                `Events: ${clr('bWhite', events.length)} total  ` +
                `${clr('bCyan', activeEvents.length)} available  ` +
                `${clr('bYellow', Object.keys(currentBets).length)} active  ` +
                `Balance: ${clr('bGreen', balance + ' PTS')}`
            );

            if (activeEvents.length === 0) {
                consecutiveNoEvents++;
                logInfo(idx, `No new events (${consecutiveNoEvents}/${MAX_CONSECUTIVE})`);
                if (consecutiveNoEvents >= MAX_CONSECUTIVE) {
                    logOk(idx, 'All events processed. Done for this cycle.');
                    break;
                }
                await sleep(autoDelay(30000));
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

                logInfo(idx, `Event: ${clr('bWhite', (event.title || event.id).slice(0,52))}`);

                const priceData = await getEventPrices(idx, event.id);
                let answer;
                if (priceData?.prices) {
                    const odds0 = priceData.prices[0];
                    const odds1 = priceData.prices[1];
                    logInfo(idx, `Odds: ${clr('bYellow', (odds0*100).toFixed(1)+'%')} / ${clr('bYellow', (odds1*100).toFixed(1)+'%')}`);
                    if (odds0 > 0.99 || odds0 < 0.01 || odds1 > 0.99 || odds1 < 0.01) {
                        logInfo(idx, clr('gray', 'Market decided — skipping.'));
                        continue;
                    }
                    const underdogProb = Math.min(odds0, odds1);
                    if (underdogProb > 0.15 && underdogProb < 0.4) {
                        answer = odds0 < odds1 ? 0 : 1;
                        logInfo(idx, `Strategy: ${clr('bMagenta','Value bet')} on ${answer===1?'YES':'NO'} (underdog)`);
                    } else {
                        answer = odds0 < odds1 ? (Math.random() < 0.55 ? 0 : 1) : (Math.random() < 0.55 ? 1 : 0);
                        logInfo(idx, `Strategy: ${clr('bBlue','Weighted random')}`);
                    }
                } else {
                    answer = Math.random() > 0.5 ? 0 : 1;
                    logInfo(idx, `Strategy: ${clr('gray','Random (no price data)')}`);
                }

                const success = await placeBet(idx, event.id, config.betAmount, answer);
                if (success) betsPlaced++;
                await sleep(autoDelay(2500));
            }

            if (betsPlaced === 0) {
                logWarn(idx, 'No bets placed this cycle.');
            } else {
                logOk(idx, `Placed ${clr('bCyan', betsPlaced)} bets  Active: ${clr('bCyan', Object.keys(loadActiveBets(idx)).length)}`);
            }

            showStats(idx, userName);

            const breakMs = autoDelay(15000);
            logInfo(idx, `Short break: ${clr('gray', formatDuration(breakMs))}`);
            await sleep(breakMs);

        } catch (error) {
            if (error.message && error.message.includes("Cannot read properties of null")) {
                logOk(idx, 'Bet limit reached. Done for today.');
                break;
            }
            logErr(idx, `Cycle error: ${error.message}`);
            await sleep(autoDelay(30000));
        }
    }
}

async function sleepWithCountdown(ms) {
    const endTime       = Date.now() + ms;
    const intervalMs    = 30 * 60 * 1000;
    logSleep(`Sleeping ${clr('bYellow', formatDuration(ms))} until next run...`);
    while (Date.now() < endTime) {
        const remaining = endTime - Date.now();
        if (remaining <= 0) break;
        await sleep(Math.min(intervalMs, remaining));
        const stillLeft = endTime - Date.now();
        if (stillLeft > 5000) {
            logSleep(`Next run in ${clr('bYellow', formatDuration(stillLeft))}...`);
        }
    }
}

async function setup() {
    printBanner();
    const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = q => new Promise(resolve => rl.question(q, a => resolve(a.trim())));
    const betAmountRaw = await ask(clr('bYellow', '💰 Bet amount per event (default 5 PTS): '));
    rl.close();
    config.betAmount = parseInt(betAmountRaw) || 5;
    console.log(`\n  ${clr('bGreen','✔')} Config → Bet amount: ${clr('bYellow', bold(config.betAmount + ' PTS'))}\n`);
}

async function main() {
    await setup();

    let runCount = 0;

    while (true) {
        runCount++;
        queries = loadQueries();

        if (queries.length === 0) {
            const rl    = readline.createInterface({ input: process.stdin, output: process.stdout });
            const query = await new Promise(resolve =>
                rl.question(clr('bYellow', '📝 Paste your query data: '), a => { rl.close(); resolve(normalizeQuery(a)); })
            );
            saveQuery(query);
            queries = [query];
        }

        sectionHeader(`🚀  RUN #${runCount}  ·  ${queries.filter(Boolean).length} account(s)  ·  ${new Date().toLocaleString()}`, 'bGreen');
        queries.forEach((q, i) => {
            console.log(`  ${clr('gray','#'+(i+1))}  ${q ? clr('gray', q.substring(0, 60)+'...') : clr('bRed','INVALID')}`);
        });
        console.log('');

        const statsInterval = setInterval(() => showGlobalStats(), 5 * 60 * 1000);

        await Promise.all(
            queries.map((_, idx) =>
                (async () => {
                    await sleep(idx * autoDelay(4000));
                    await runAccount(idx);
                })()
            )
        );

        clearInterval(statsInterval);
        showGlobalStats();

        const sleepHours = 22 + Math.random() * 4;
        const sleepMs    = Math.floor(sleepHours * 60 * 60 * 1000);

        await sleepWithCountdown(sleepMs);
        logWake(`Waking up! Starting run #${runCount + 1}...`);

        accountStats = {};
    }
}

process.on('SIGINT', () => {
    console.log('\n');
    sectionHeader('🛑  SHUTTING DOWN', 'bRed');
    for (let i = 0; i < queries.length; i++) {
        saveActiveBets(i, loadActiveBets(i));
        saveBetHistory(i, loadBetHistory(i));
    }
    showGlobalStats();
    console.log(clr('bGreen', '  ✔ State saved. Goodbye.\n'));
    process.exit(0);
});

process.on('uncaughtException', err => {
    console.error(clr('bRed', `\n❌ Uncaught error: ${err.message}`));
    for (let i = 0; i < queries.length; i++) saveActiveBets(i, loadActiveBets(i));
});

main().catch(console.error);
