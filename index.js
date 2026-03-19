const axios = require('axios');
const fs = require('fs');
const readline = require('readline');

const API_BASE = 'https://api.yeno.pro/tma/v1';

let queries = [];
let accountStats = {};

let config = {
    betAmount: 5,
    minBalanceToBet: 10,
    maxCycles: 0,
};

function autoDelay(baseMs) {
    const jitter = baseMs * 0.4;
    return baseMs - jitter + Math.random() * jitter * 2;
}

function printBanner() {
    console.log('\x1b[36m');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(' ██╗   ██╗███████╗███╗   ██╗ ██████╗     ██████╗  ██████╗ ████████╗');
    console.log(' ╚██╗ ██╔╝██╔════╝████╗  ██║██╔═══██╗    ██╔══██╗██╔═══██╗╚══██╔══╝');
    console.log('  ╚████╔╝ █████╗  ██╔██╗ ██║██║   ██║    ██████╔╝██║   ██║   ██║   ');
    console.log('   ╚██╔╝  ██╔══╝  ██║╚██╗██║██║   ██║    ██╔══██╗██║   ██║   ██║   ');
    console.log('    ██║   ███████╗██║ ╚████║╚██████╔╝    ██████╔╝╚██████╔╝   ██║   ');
    console.log('    ╚═╝   ╚══════╝╚═╝  ╚═══╝ ╚═════╝     ╚═════╝  ╚═════╝    ╚═╝  ');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('\x1b[33m                    🎯  YENO AUTO BOT  v2.0                    ');
    console.log('\x1b[36m═══════════════════════════════════════════════════════════════════════\x1b[0m\n');
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
                .split('\n')
                .map(l => normalizeQuery(l))
                .filter(Boolean);
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

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function showStats(idx, userName) {
    const s = accountStats[idx] || {};
    const runtime = Math.floor((Date.now() - (s.startTime || Date.now())) / 1000);
    const winRate = (s.totalBets || 0) > 0 ? (((s.totalWins || 0) / s.totalBets) * 100).toFixed(1) : '0.0';
    const net = (s.totalPointsEarned || 0) - (s.totalPointsSpent || 0);
    const bets = loadActiveBets(idx);
    console.log('\n' + '═'.repeat(70));
    console.log(`📊 STATS — Account #${idx + 1} (${userName || 'Unknown'})`);
    console.log('═'.repeat(70));
    console.log(`⏱️  Runtime:      ${formatTime(runtime)}`);
    console.log(`💰 Bet Amount:   ${config.betAmount} PTS`);
    console.log(`🎯 Total Bets:   ${s.totalBets || 0}`);
    console.log(`✅ Wins:          ${s.totalWins || 0}`);
    console.log(`❌ Losses:        ${s.totalLosses || 0}`);
    console.log(`📊 Win Rate:      ${winRate}%`);
    console.log(`💸 Spent:         ${s.totalPointsSpent || 0} PTS`);
    console.log(`💵 Earned:        ${s.totalPointsEarned || 0} PTS`);
    console.log(`📈 Net Profit:    ${net} PTS`);
    console.log(`📋 Active Bets:   ${Object.keys(bets).length}`);
    console.log('═'.repeat(70) + '\n');
}

function showGlobalStats() {
    let totalBets = 0, totalWins = 0, totalLosses = 0, totalSpent = 0, totalEarned = 0;
    for (const s of Object.values(accountStats)) {
        totalBets += s.totalBets || 0;
        totalWins += s.totalWins || 0;
        totalLosses += s.totalLosses || 0;
        totalSpent += s.totalPointsSpent || 0;
        totalEarned += s.totalPointsEarned || 0;
    }
    const winRate = totalBets > 0 ? ((totalWins / totalBets) * 100).toFixed(1) : '0.0';
    const net = totalEarned - totalSpent;
    console.log('\n\x1b[35m' + '╔' + '═'.repeat(68) + '╗');
    console.log('║' + '  🌐 GLOBAL STATS — ALL ACCOUNTS'.padEnd(68) + '║');
    console.log('╠' + '═'.repeat(68) + '╣');
    console.log(`║  👥 Accounts:    ${String(queries.length).padEnd(50)}║`);
    console.log(`║  🎯 Total Bets:  ${String(totalBets).padEnd(50)}║`);
    console.log(`║  ✅ Total Wins:  ${String(totalWins).padEnd(50)}║`);
    console.log(`║  ❌ Total Loss:  ${String(totalLosses).padEnd(50)}║`);
    console.log(`║  📊 Win Rate:    ${String(winRate + '%').padEnd(50)}║`);
    console.log(`║  📈 Net Profit:  ${String(net + ' PTS').padEnd(50)}║`);
    console.log('╚' + '═'.repeat(68) + '╝\x1b[0m\n');
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
            console.log(`🔍 [Acc#${idx + 1}] ${endpoint} → ${response.status}`, response.data);
        }
        return response;
    } catch (error) {
        if (error.response?.status === 401) {
            console.log(`❌ [Acc#${idx + 1}] Query expired, removing...`);
            queries[idx] = null;
        }
        throw error;
    }
}

async function getUserProfile(idx) {
    return (await apiRequest(idx, '/user/profile')).data.data;
}

async function loadEvents(idx) {
    return (await apiRequest(idx, '/events/load')).data.data;
}

async function getEventPrices(idx, eventId) {
    try { return (await apiRequest(idx, `/events/prices/${eventId}`)).data.data; } catch (e) { return null; }
}

async function placeBet(idx, eventId, amount, answer) {
    const direction = answer === 1 ? 'right' : 'left';
    const type = answer === 1 ? 'yes' : 'no';
    console.log(`   [Acc#${idx + 1}] 📤 Placing: ${amount} PTS on ${type.toUpperCase()}`);
    try {
        const userData = await getUserProfile(idx);
        const balanceBefore = userData.points?.amount || 0;
        const betId = generateUUID();
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
            bets[eventId] = { id: betId, amount, answer, direction, type, answerText: type.toUpperCase(), placedAt: new Date().toISOString(), eventTitle, balanceAtBetTime: balanceBefore, odds: { no: noOdds, yes: yesOdds } };
            if (!accountStats[idx]) accountStats[idx] = { totalBets: 0, totalWins: 0, totalLosses: 0, totalPointsSpent: 0, totalPointsEarned: 0, startTime: Date.now() };
            accountStats[idx].totalBets++;
            accountStats[idx].totalPointsSpent += amount;
            saveActiveBets(idx, bets);
            console.log(`   [Acc#${idx + 1}] ✅ Bet placed! ID: ${eventId.substring(0, 8)}...`);
            console.log(`   [Acc#${idx + 1}] 📊 Odds: NO=${noOdds}, YES=${yesOdds}`);
            if (response.data?.data?.user?.points) console.log(`   [Acc#${idx + 1}] 💰 Balance: ${response.data.data.user.points.amount} PTS`);
            if (response.data?.data?.events) await checkResolvedBets(idx, response.data.data.events);
            return true;
        } else {
            console.log(`   [Acc#${idx + 1}] ❌ Bet failed: ${response.data?.message || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        console.log(`   [Acc#${idx + 1}] ❌ API Error: ${error.message}`);
        return false;
    }
}

async function checkResolvedBets(idx, currentEvents) {
    const bets = loadActiveBets(idx);
    if (Object.keys(bets).length === 0) return;
    console.log(`\n[Acc#${idx + 1}] 🔍 Checking ${Object.keys(bets).length} active bets...`);
    const userData = await getUserProfile(idx);
    const currentBalance = userData.points?.amount || 0;
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
                console.log(`   [Acc#${idx + 1}] ✅ WIN on ${bet.eventTitle || eventId.substring(0, 8)}! ~${balanceChange} PTS`);
                history.push({ ...bet, resolvedAt: new Date().toISOString(), result: 'win', profit: balanceChange, finalBalance: currentBalance });
            } else {
                losses++;
                accountStats[idx].totalLosses++;
                console.log(`   [Acc#${idx + 1}] ❌ LOSS on ${bet.eventTitle || eventId.substring(0, 8)}`);
                history.push({ ...bet, resolvedAt: new Date().toISOString(), result: 'loss', finalBalance: currentBalance });
            }
        } else {
            stillActive[eventId] = bet;
        }
    }
    if (wins > 0 || losses > 0) console.log(`[Acc#${idx + 1}] 📊 +${wins} wins, -${losses} losses (Net: +${totalProfit} PTS)`);
    saveActiveBets(idx, stillActive);
    saveBetHistory(idx, history);
}

async function runAccount(idx) {
    if (!queries[idx]) { console.log(`⚠️  Account #${idx + 1} invalid, skipping.`); return; }
    if (!accountStats[idx]) accountStats[idx] = { totalBets: 0, totalWins: 0, totalLosses: 0, totalPointsSpent: 0, totalPointsEarned: 0, startTime: Date.now() };
    console.log(`\n\x1b[32m▶ Starting Account #${idx + 1}...\x1b[0m`);
    let userData;
    try { userData = await getUserProfile(idx); } catch (e) { console.log(`❌ [Acc#${idx + 1}] Failed to get profile: ${e.message}`); return; }
    const userName = userData.name || `Account #${idx + 1}`;
    let balance = userData.points?.amount || 0;
    console.log(`[Acc#${idx + 1}] 👤 User: ${userName}`);
    console.log(`[Acc#${idx + 1}] 💰 Balance: ${balance} ${userData.points?.symbol || 'PTS'}`);
    let cycleCount = 0;
    let consecutiveNoEvents = 0;
    const MAX_CONSECUTIVE = 5;
    while (true) {
        if (!queries[idx]) { console.log(`[Acc#${idx + 1}] ❌ Query removed, stopping.`); break; }
        try {
            cycleCount++;
            console.log(`\n[Acc#${idx + 1}] 🎯 CYCLE #${cycleCount} ${'─'.repeat(40)}`);
            const eventData = await loadEvents(idx);
            const events = eventData.events || [];
            await checkResolvedBets(idx, events);
            userData = await getUserProfile(idx);
            balance = userData.points?.amount || 0;
            if (balance < config.minBalanceToBet) {
                console.log(`[Acc#${idx + 1}] 💰 Balance too low (${balance}), waiting 5 min...`);
                await new Promise(r => setTimeout(r, autoDelay(300000)));
                continue;
            }
            const currentBets = loadActiveBets(idx);
            const activeEvents = events.filter(e => !e.is_closed && !currentBets[e.id]);
            console.log(`[Acc#${idx + 1}] 📋 Total: ${events.length} | New: ${activeEvents.length} | Bet: ${Object.keys(currentBets).length}`);
            console.log(`[Acc#${idx + 1}] 💰 Balance: ${balance} PTS`);
            if (activeEvents.length === 0) {
                consecutiveNoEvents++;
                console.log(`[Acc#${idx + 1}] ⏳ No new events (${consecutiveNoEvents}/${MAX_CONSECUTIVE})`);
                if (consecutiveNoEvents >= MAX_CONSECUTIVE) {
                    console.log(`[Acc#${idx + 1}] ⏳ Waiting 15 min...`);
                    await new Promise(r => setTimeout(r, autoDelay(900000)));
                    consecutiveNoEvents = 0;
                } else {
                    await new Promise(r => setTimeout(r, autoDelay(30000)));
                }
                continue;
            }
            consecutiveNoEvents = 0;
            let betsPlaced = 0;
            for (const event of activeEvents) {
                if (balance - (betsPlaced * config.betAmount) < config.betAmount) {
                    console.log(`[Acc#${idx + 1}] 💰 Insufficient balance`);
                    break;
                }
                const freshBets = loadActiveBets(idx);
                if (freshBets[event.id]) continue;
                console.log(`\n[Acc#${idx + 1}] 🎲 Event: ${event.title || event.id}`);
                console.log(`   📝 ${event.answers ? event.answers.join(' vs ') : 'YES/NO'}`);
                const priceData = await getEventPrices(idx, event.id);
                let answer;
                if (priceData?.prices) {
                    const odds0 = priceData.prices[0];
                    const odds1 = priceData.prices[1];
                    console.log(`   📊 Odds: ${(odds0 * 100).toFixed(1)}% / ${(odds1 * 100).toFixed(1)}%`);
                    if (odds0 > 0.99 || odds0 < 0.01 || odds1 > 0.99 || odds1 < 0.01) {
                        console.log(`   ⏭️  Skipping - market decided`);
                        continue;
                    }
                    const underdogProb = Math.min(odds0, odds1);
                    if (underdogProb > 0.15 && underdogProb < 0.4) {
                        answer = odds0 < odds1 ? 0 : 1;
                        console.log(`   🎯 Value bet on ${answer === 1 ? 'YES' : 'NO'} (underdog)`);
                    } else {
                        answer = odds0 < odds1 ? (Math.random() < 0.55 ? 0 : 1) : (Math.random() < 0.55 ? 1 : 0);
                    }
                } else {
                    answer = Math.random() > 0.5 ? 0 : 1;
                }
                const success = await placeBet(idx, event.id, config.betAmount, answer);
                if (success) betsPlaced++;
                await new Promise(r => setTimeout(r, autoDelay(2500)));
            }
            if (betsPlaced === 0) {
                console.log(`[Acc#${idx + 1}] ⚠️  No bets placed this cycle`);
            } else {
                console.log(`\n[Acc#${idx + 1}] ✅ Placed ${betsPlaced} bets | Active: ${Object.keys(loadActiveBets(idx)).length}`);
            }
            showStats(idx, userName);
            if (config.maxCycles > 0 && cycleCount >= config.maxCycles) {
                console.log(`[Acc#${idx + 1}] 🏁 Reached ${config.maxCycles} cycles, stopping.`);
                break;
            }
            const breakMs = autoDelay(15000);
            console.log(`[Acc#${idx + 1}] 😴 Break: ${(breakMs / 1000).toFixed(1)}s`);
            await new Promise(r => setTimeout(r, breakMs));
        } catch (error) {
            console.error(`[Acc#${idx + 1}] ❌ Cycle error: ${error.message}`);
            await new Promise(r => setTimeout(r, autoDelay(30000)));
        }
    }
}

async function setup() {
    printBanner();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = q => new Promise(resolve => rl.question(q, a => resolve(a.trim())));
    const betAmountRaw = await ask('💰 Bet amount per event (default: 5): ');
    const maxCyclesRaw = await ask('🔄 Max cycles per account (0 = unlimited, default: 0): ');
    rl.close();
    config.betAmount = parseInt(betAmountRaw) || 5;
    config.maxCycles = parseInt(maxCyclesRaw) || 0;
    console.log('\n✅ Configuration:');
    console.log(`   Bet Amount:  ${config.betAmount} PTS`);
    console.log(`   Max Cycles:  ${config.maxCycles === 0 ? 'Unlimited' : config.maxCycles}\n`);
}

async function main() {
    await setup();
    queries = loadQueries();
    if (queries.length === 0) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const query = await new Promise(resolve => rl.question('📝 Paste your query data: ', a => { rl.close(); resolve(normalizeQuery(a)); }));
        saveQuery(query);
        queries = [query];
    }
    console.log(`✅ Loaded ${queries.length} account(s)\n`);
    for (let i = 0; i < queries.length; i++) {
        console.log(`   Account #${i + 1}: ${queries[i] ? queries[i].substring(0, 60) + '...' : 'INVALID'}`);
    }
    console.log('');
    const statsInterval = setInterval(() => showGlobalStats(), 300000);
    await Promise.all(queries.map((_, idx) =>
        new Promise(async resolve => {
            await new Promise(r => setTimeout(r, idx * autoDelay(4000)));
            await runAccount(idx);
            resolve();
        })
    ));
    clearInterval(statsInterval);
    showGlobalStats();
    console.log('\n✅ All accounts finished.');
    const sleepHours = 22 + Math.random() * 4;
    const sleepMs = sleepHours * 60 * 60 * 1000;
    console.log(`\n😴 Sleeping for ${sleepHours.toFixed(2)} hours before next run...`);
    await new Promise(r => setTimeout(r, sleepMs));
    console.log('\n⏰ Waking up! Restarting...');
    await main();
}

process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping all accounts...');
    for (let i = 0; i < queries.length; i++) {
        saveActiveBets(i, loadActiveBets(i));
        saveBetHistory(i, loadBetHistory(i));
    }
    showGlobalStats();
    process.exit(0);
});

process.on('uncaughtException', err => {
    console.error('❌ Uncaught error:', err.message);
    for (let i = 0; i < queries.length; i++) saveActiveBets(i, loadActiveBets(i));
});

main().catch(console.error);
