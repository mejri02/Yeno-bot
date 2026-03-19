# 🎯 Yeno Bot

An automated multi-account bot for the [Yeno](https://t.me/YenoSwipeBot?start=i_AWIRSBDL) Telegram prediction game.

---

## 📌 What is Yeno?

Yeno is a Telegram-based prediction bot where users bet points on yes/no outcomes. This bot automates the betting process across multiple accounts using a value betting strategy.

---

## ✨ Features

- 🤖 Multi-account support — run as many accounts as you want concurrently
- 🎯 Value betting strategy — targets underdog positions with favorable odds
- ⏱️ Auto delay with jitter — randomized timing between actions to avoid detection
- 🔄 Configurable max cycles per account
- 📊 Per-account and global stats
- 💾 Persistent bet tracking across sessions
- 🔁 Auto query normalization — paste raw Telegram WebApp URLs directly

---

## 📋 Requirements

- Node.js v16+
- npm

---

## 📦 Installation

```bash
git clone https://github.com/mejri02/Yeno-bot.git
cd Yeno-bot
npm install axios
```

---

## ⚙️ Setup

### 1. Add your query data

Create a `query.txt` file in the project root. Add one account query per line.

You can paste the raw Telegram WebApp URL directly — the bot will extract and normalize it automatically:

```
query_id=AAFUQ7It...&user=...&auth_date=...&hash=...
```

Or the full raw format:

```
query_id%3DAAFUQ7It...&tgWebAppVersion=9.1&tgWebAppPlatform=weba...
```

### 2. Get your query

1. Open Telegram and start [@YenoSwipeBot](https://t.me/YenoSwipeBot?start=i_AWIRSBDL)
2. Open browser DevTools → Network tab
3. Look for requests to `api.yeno.pro`
4. Copy the `Authorization` bearer token or the raw query string
5. Paste it into `query.txt`

---

## 🚀 Usage

```bash
node index.js
```

You will be prompted for:

| Prompt | Description |
|--------|-------------|
| `💰 Bet amount per event` | How many points to bet per event (default: 5) |
| `🔄 Max cycles per account` | How many cycles to run — `0` for unlimited |

---

## 📁 File Structure

```
Yeno-bot/
├── index.js               # Main bot file
├── query.txt              # Your account queries (one per line)
├── active_bets_account_N.json   # Auto-generated per account
├── bet_history_account_N.json   # Auto-generated per account
└── README.md
```

---

## 📊 Strategy

The bot uses a **value betting approach**:

- If the underdog probability is between **15% and 40%**, it bets on the underdog
- Otherwise it uses a **55% underdog bias** with randomization
- Skips markets where odds are extreme (> 99% or < 1%) — already decided

---

## 🔗 Links

- 🤖 Yeno Bot — [Start here](https://t.me/YenoSwipeBot?start=i_AWIRSBDL)
- 💬 Telegram Group — [AirDropXDevs](https://t.me/AirDropXDevs)

---

## 👤 Author

**mejri02** — [GitHub](https://github.com/mejri02)

---

## ⚠️ Disclaimer

This project is for educational purposes only. Use at your own risk. The author is not responsible for any account bans or point losses.
