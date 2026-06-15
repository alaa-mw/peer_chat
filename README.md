# Peer Chat Application

## Requirements
- Docker Desktop installed

## Quick Start

1. **Clone and run:**
```bash
docker-compose up -d
```

2. **Open Browser:**
```bash
http://localhost:3000
```


1. **Stop project:**
```bash
docker-compose down
```

## How to Test Multiple Users
Open each chat in a different browser or use Incognito/Private windows in the same browser.

## Features:

1. Online / Offline Status

Auto update state when user connects or disconnects.

🟢 Online – User is active

⚪ Offline – User is disconnected

Updates in real-time automatically

2. Offline Messages

✅ All messages are saved in the database

✅ If a user is offline and you send a message, it will be delivered immediately when they come back online

3. Typing Indicator

✏️ Shows "the other user is typing..." when someone starts writing

⏱️ Automatically disappears 2 seconds after typing stops