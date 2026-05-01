# 🎯 Yeno Bot

> 🔗 **[Join AirDropXDevs](https://t.me/AirDropXDevs)** · **[Start Yeno](https://t.me/YenoSwipeBot?start=i_AWIRSBDL)**

An automated multi-account bot for the [Yeno](https://t.me/YenoSwipeBot?start=i_AWIRSBDL) Telegram prediction game — now with **Groq AI-powered bet decisions** using `llama-3.3-70b-versatile`.

---

## 📌 What is Yeno?

Yeno is a Telegram-based prediction bot where users bet points on yes/no outcomes. This bot automates the betting process across multiple accounts using either an AI-driven strategy (Groq) or a built-in value betting fallback.

---

## ✨ Features

- 🤖 Multi-account support — run as many accounts as you want concurrently
- 🧠 **Groq AI mode** — uses `llama-3.3-70b-versatile` for intelligent bet decisions (optional)
- 🎯 Value betting fallback — targets underdog positions with favorable odds when AI is disabled
- 📈 Market signal analysis — detects lopsided markets and close-call events automatically
- 🔍 Confidence calibration — AI confidence is clamped and adjusted based on market spread
- 🌐 Proxy support — SOCKS5 & HTTP/HTTPS proxies with auto-rotation and validation
- ⏱️ Auto delay with jitter — randomized timing between actions to avoid detection
- 📊 Per-account stats — wins, losses, points spent, points earned
- 💾 Persistent bet tracking — active bets and history saved across sessions
- 🔁 Auto query normalization — paste raw Telegram WebApp URLs directly
- 🛡️ Browser fingerprint spoofing — randomized UA, WebGL, screen, platform per account

---

## 📋 Requirements

- Node.js v16+
- npm
- (Optional) Groq API key from [console.groq.com/keys](https://console.groq.com/keys)

---

## 📦 Installation

```bash
git clone https://github.com/mejri02/Yeno-bot.git
cd Yeno-bot
npm install axios socks-proxy-agent https-proxy-agent
```

---

## ⚙️ Setup

### 1. Add your query data

Create a `query.txt` file in the project root. Add one account query per line.

You can paste the raw Telegram WebApp URL directly — the bot normalizes it automatically:

```
query_id=AAFUQ7It...&user=...&auth_date=...&hash=...
```

Or the full encoded format:

```
query_id%3DAAFUQ7It...&tgWebAppVersion=9.1&tgWebAppPlatform=weba...
```

### 2. Get your query

1. Open Telegram and start [@YenoSwipeBot](https://t.me/YenoSwipeBot?start=i_AWIRSBDL)
2. Open browser DevTools → Network tab
3. Look for requests to `api.yeno.pro`
4. Copy the `Authorization` bearer token or the raw query string
5. Paste it into `query.txt`

### 3. (Optional) Enable Groq AI

1. Get a free API key at [console.groq.com/keys](https://console.groq.com/keys)
2. Create a `grok.txt` file in the project root
3. Paste your key inside (must start with `gsk_`):

```
gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The bot will detect the key on startup and ask if you want to enable AI mode.

### 4. (Optional) Add proxies

Create a `proxies.txt` file, one proxy per line:

```
socks5://user:pass@host:port
http://user:pass@host:port
```

---

## 🚀 Usage

```bash
node index.js
```

You will be prompted at startup:

| Prompt | Description |
|--------|-------------|
| `🤖 Use Groq AI for bet decisions?` | Enable AI mode if `grok.txt` is found (y/n) |
| `⚙️ Proxy configuration` | Choose direct connection or proxies from `proxies.txt` |
| `💰 Bet amount per event` | Points to bet per event (default: 5) |

---

## 📁 File Structure

```
Yeno-bot/
├── index.js                       # Main bot file
├── query.txt                      # Your account queries (one per line)
├── grok.txt                       # Groq API key (optional)
├── proxies.txt                    # Proxy list (optional)
├── active_bets_account_N.json     # Auto-generated per account
├── bet_history_account_N.json     # Auto-generated per account
└── README.md
```

---

## 📊 Strategy

### 🧠 Groq AI Mode (recommended)

When enabled, each event is analyzed by `llama-3.3-70b-versatile` using a 5-step reasoning process:

1. **Parse** — identify what the event is literally asking
2. **Domain knowledge** — apply historical base rates, trends, and world context
3. **Odds evaluation** — assess if crowd pricing is accurate or mispriced
4. **Edge detection** — flag lopsided (>70%) or close-call (<10% spread) markets
5. **Confidence calibration** — score clamped to 0.50–0.97, auto-reduced for close events

The AI returns an answer, a confidence score, a reason, and an edge explanation shown in the log:

```
🤖 YES · conf 81% · BTC historically recovers after halving · crowd underpricing YES
```

### 📉 Odds Fallback (no Groq / AI fails)

- If underdog probability is between **15%–40%** → bets on the underdog
- Otherwise uses a **55% underdog bias** with randomization
- Automatically skips events already bet on or with insufficient balance

---

## 🔗 Links

- 🤖 Yeno Bot — [Start here](https://t.me/YenoSwipeBot?start=i_AWIRSBDL)
- 💬 Telegram — [AirDropXDevs](https://t.me/AirDropXDevs)
- 🔑 Groq API Keys — [console.groq.com/keys](https://console.groq.com/keys)

---

## 👤 Author

**mejri02** — [GitHub](https://github.com/mejri02)

---

## ⚠️ Disclaimer

This project is for educational purposes only. Use at your own risk. The author is not responsible for any account bans or point losses.

