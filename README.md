# 🎓 Imtihon Tizimi — To'liq Platforma

> Talabalar uchun **Electron**-da yozilgan xavfsiz imtihon klienti va o'qituvchilar uchun **Web admin panel** bilan boshqariladigan to'liq tizim.

## 📋 Mundarija

- [Loyiha haqida](#-loyiha-haqida)
- [Tizim arxitekturasi](#-tizim-arxitekturasi)
- [Texnologiyalar steki](#-texnologiyalar-steki)
- [Loyiha tuzilishi](#-loyiha-tuzilishi)
- [Tezkor boshlash](#-tezkor-boshlash)
- [Server tomonini o'rnatish (Backend)](#-server-tomonini-ornatish-backend)
- [Admin panel](#-admin-panel)
- [Klient dasturi (Electron, talabalar uchun)](#-klient-dasturi-electron-talabalar-uchun)
- [Docker orqali to'liq deploy](#-docker-orqali-toliq-deploy)
- [Xavfsizlik](#-xavfsizlik)
- [API hujjati](#-api-hujjati)
- [Muammolarni hal qilish](#-muammolarni-hal-qilish)

---

## 🎯 Loyiha haqida

**Imtihon Tizimi** — bu ta'lim muassasalari uchun mo'ljallangan yopiq, xavfsiz va to'liq ekzamen platformasi. Tizim ikki qismdan iborat:

1. **Server + Admin Panel** (o'qituvchilar tomonidan boshqariladi) — savollar bazasi, foydalanuvchilar boshqaruvi, natijalar tahlili
2. **Klient dasturi** (talabalar kompyuteriga o'rnatiladi) — full-screen xavfsiz muhitda imtihon topshirish

### Asosiy imkoniyatlar

- 🖥️ **Full-screen qulflash** — talaba imtihon davomida boshqa dasturlarga o'ta olmaydi
- ⌨️ **Klaviatura bloklash** — `Alt+Tab`, `Win`, `Ctrl+Esc`, `F12` va boshqa xavfli kombinatsiyalar bloklangan
- 🌐 **Internet monitoring** — imtihon davomida uzilish aniqlansa, foydalanuvchi avtomatik bloklanadi
- 🔄 **WebSocket heartbeat** — 30 soniyadan ko'p javob bo'lmasa, blok
- 🚫 **Avtomatik bloklash** — 3 tadan ortiq "ruxsatsiz" klaviatura bosish
- 📊 **Real-time natijalar** — o'qituvchi imtihonni kuzatib boradi
- 👥 **Ko'p foydalanuvchi** — bir vaqtda yuzlab talabalar ishlashi mumkin
- 🔐 **JWT autentifikatsiya** — admin va talabalar uchun alohida tokenlar
- 🛡️ **Rate limiting** — DoS hujumlardan himoya

---

## 🏗️ Tizim arxitekturasi

```
┌─────────────────────────────────────────────────────────────┐
│                       SERVER (Node.js)                       │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│   │  REST API    │  │  WebSocket   │  │     JWT      │      │
│   │  (Express)   │  │  (ws lib)    │  │  Auth        │      │
│   └──────────────┘  └──────────────┘  └──────────────┘      │
│   ┌──────────────────────────────────────────────────┐      │
│   │        Rate Limiter / Helmet / CORS              │      │
│   └──────────────────────────────────────────────────┘      │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
      ┌──────────┐  ┌──────────┐  ┌──────────┐
      │ MongoDB  │  │  Nginx   │  │  Static  │
      │ (data)   │  │ (proxy)  │  │  files   │
      └──────────┘  └──────────┘  └──────────┘
                          ▲
                          │
              ┌───────────┴────────────┐
              │                        │
              ▼                        ▼
   ┌──────────────────┐    ┌──────────────────────┐
   │  Admin Panel     │    │  Klient Dasturi      │
   │  (HTML+Tailwind) │    │  (Electron + Node)   │
   │  Port: 80        │    │  Windows .exe        │
   └──────────────────┘    └──────────────────────┘
   O'qituvchilar uchun     Talabalar uchun
   Brauzer orqali          Kompyuterga o'rnatiladi
```

---

## 🛠️ Texnologiyalar steki

| Qism | Texnologiya | Versiya | Maqsad |
|------|-------------|---------|--------|
| **Server** | Node.js | 18+ | Backend runtime |
| **Framework** | Express.js | 4.18+ | REST API |
| **Ma'lumotlar bazasi** | MongoDB | 6+ | NoSQL data storage |
| **ODM** | Mongoose | 8+ | MongoDB schema |
| **WebSocket** | ws | 8.16+ | Real-time aloqalar |
| **Autentifikatsiya** | JWT (jsonwebtoken) | 9+ | Token-based auth |
| **Hashing** | bcryptjs | 2.4+ | Parol xavfsizligi |
| **Xavfsizlik** | helmet, cors, express-rate-limit | - | HTTP security |
| **Admin Panel** | HTML5 + Tailwind CSS + Vanilla JS | - | UI |
| **Web Server** | Nginx (alpine) | - | Static + reverse proxy |
| **Klient** | Electron | 28+ | Desktop app (cross-platform, hozirda Windows) |
| **Klient UI** | HTML + CSS + JS | - | Imtihon interfeysi |
| **Build** | electron-builder | 24+ | .exe installer yaratish |
| **Container** | Docker + Docker Compose | - | Deploy |

---

## 📁 Loyiha tuzilishi

```
get-session/
├── server/                    # Node.js backend
│   ├── src/
│   │   ├── index.js          # Express app entry point
│   │   ├── seed.js           # Boshlang'ich ma'lumotlarni yaratish
│   │   ├── middleware/
│   │   │   ├── auth.js       # JWT tekshirish
│   │   │   └── rateLimiter.js
│   │   ├── models/
│   │   │   ├── User.js       # Foydalanuvchi modeli
│   │   │   ├── Subject.js    # Fan modeli
│   │   │   ├── TestSession.js
│   │   │   └── BlockLog.js
│   │   ├── routes/
│   │   │   ├── auth.js       # /api/auth
│   │   │   ├── subjects.js   # /api/subjects
│   │   │   ├── test.js       # /api/test
│   │   │   ├── users.js      # /api/users
│   │   │   └── ping.js       # /api/ping
│   │   └── utils/
│   │       └── WebSocketServer.js
│   ├── package.json
│   ├── Dockerfile
│   └── .env                  # Maxfiy sozlamalar
│
├── admin-panel/              # Web admin panel (o'qituvchilar uchun)
│   ├── index.html
│   └── app.js
│
├── client/                   # Electron Desktop app (talabalar uchun)
│   ├── main.js              # Electron main process
│   ├── preload.js           # Context bridge
│   ├── package.json
│   ├── config.json          # Server URL konfiguratsiyasi
│   ├── renderer/
│   │   ├── index.html
│   │   ├── css/
│   │   │   └── style.css
│   │   └── js/
│   │       └── app.js
│   └── assets/
│
├── installer/                # (ixtiyoriy) eski Inno Setup script
│
├── docker-compose.yml        # Barcha servislarni bir vaqtda ishga tushirish
├── nginx.conf                # Reverse proxy konfiguratsiyasi
├── .gitignore
└── README.md                 # ← Siz shu yerda turibsiz
```

---

## 🚀 Tezkor boshlash

### Minimal talablar

| Dastur | Versiya | Qayerda kerak |
|--------|---------|---------------|
| **Node.js** | 18+ | Server (development) |
| **npm** | 9+ | Server (development) |
| **MongoDB** | 6+ | Ma'lumotlar bazasi |
| **Docker** | 24+ | Deploy (ixtiyoriy, lekin tavsiya) |
| **Docker Compose** | v2+ | Deploy (ixtiyoriy) |
| **Git** | 2.30+ | Kodni yuklash |

### 5 daqiqada ishga tushirish (Docker orqali)

```bash
# 1. Repositoriyani klonlash
git clone https://github.com/FOYDALANUVCHI/get-session.git
cd get-session

# 2. Serverni va ma'lumotlar bazasini ishga tushirish
docker compose up -d --build

# 3. Boshlang'ich ma'lumotlarni yaratish (admin, fanlar, test talabalari)
docker exec exam-server node src/seed.js

# 4. Brauzerda ochish
# Admin panel:    http://localhost
# Server API:     http://localhost:3000
# Login:          admin / admin123
```

Tayyor! 🎉

---

## 🖥️ Server tomonini o'rnatish (Backend)

### Variant A: Docker bilan (tavsiya)

`docker-compose.yml` allaqachon tayyorlangan. Quyidagi buyruqlar bilan ishga tushiring:

```bash
# Konteynerlarni qurish va fon rejimida ishga tushirish
docker compose up -d --build

# Holatni tekshirish
docker compose ps

# Loglarni kuzatish
docker compose logs -f
```

**Konteynerlar:**
- `exam-mongodb` — MongoDB 6 (port 27017, faqat docker network ichida)
- `exam-server` — Node.js backend (port 3000)
- `exam-admin-panel` — Nginx + admin panel (port 80)

### Variant B: Qo'lda o'rnatish (Production)

#### 1. MongoDB o'rnatish

```bash
# Ubuntu 22.04
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### 2. Node.js o'rnatish

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

#### 3. Loyihani klonlash va sozlash

```bash
cd /opt
git clone https://github.com/FOYDALANUVCHI/get-session.git exam-system
cd exam-system/server
npm install --production
```

#### 4. `.env` faylini yaratish

```bash
cat > .env <<EOF
PORT=3000
MONGODB_URI=mongodb://localhost:27017/exam-system
JWT_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
EOF
```

> ⚠️ **`JWT_SECRET`** ni `openssl rand -hex 32` bilan generatsiya qiling — bu maxfiy kalit.

#### 5. Boshlang'ich ma'lumotlar

```bash
npm run seed
```

Bu quyidagilarni yaratadi:
- Admin: `admin` / `admin123`
- Bir nechta namuna fanlar
- Test talabalari

#### 6. PM2 bilan ishga tushirish

```bash
sudo npm install -g pm2
pm2 start src/index.js --name exam-server
pm2 save
pm2 startup
```

#### 7. Nginx reverse proxy (ixtiyoriy)

`/etc/nginx/sites-available/exam-system` faylini yarating:

```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 50M;

    # Admin panel
    location / {
        root /opt/exam-system/admin-panel;
        try_files $uri $uri/ =404;
    }

    # REST API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/exam-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🖥️ Admin Panel

Admin panel — bu HTML5 + Tailwind CSS + Vanilla JS asosida yozilgan statik veb-ilova. O'qituvchilar imtihonlarni shu yerdan boshqaradi.

### Imkoniyatlar

- 👤 Foydalanuvchilar (talabalar) qo'shish / tahrirlash / o'chirish
- 📚 Fanlar va savollar boshqaruvi
- 📊 Imtihon natijalarini ko'rish
- 🚫 Bloklangan foydalanuvchilarni boshqarish
- 📋 Test sessiyalari tarixini ko'rish
- 🔑 Admin parolini o'zgartirish

### Kirish

Brauzerda oching:
```
http://server-manzili/
```

**Standart login ma'lumotlari:**
- Login: `admin`
- Parol: `admin123`

> ⚠️ **Birinchi kiring** va **parolni darhol o'zgartiring!**

---

## 💻 Klient dasturi (Electron, talabalar uchun)

Talabalar uchun **Electron**-da yozilgan desktop ilova. Windows muhitida xavfsiz, full-screen imtihon muhitini ta'minlaydi.

### Asosiy xususiyatlari

- 🔒 **Full-screen qulflash** — boshqa dasturlarga o'tish bloklangan
- ⌨️ **Klaviatura himoyasi** — quyidagilar bloklangan:
  - `Win` tugmasi
  - `Alt+Tab`, `Alt+F4`, `Alt+Esc`
  - `Ctrl+Esc`, `Ctrl+Shift+Esc`
  - `F1`–`F12` (ba'zilari)
  - `Ctrl+D/W/T/N/R/L/P/U/S/H/J/K` (xavfli kombinatsiyalar)
  - `F5` (refresh), `F11` (fullscreen toggle)
- 🚪 **Favqulodda chiqish** — `Ctrl+Shift+O` (faqat admin uchun)
- 🖱️ **Minimize bloklash** — touchpad gesture'lar ham
- 🎯 **Always-on-top** — boshqa oynalar ustida doimo
- 🔄 **Auto-refocus** — fokus yo'qolsa qaytariladi

### Dasturchi uchun: development rejimida ishga tushirish

```bash
cd client
npm install
npm start
```

### Production build: Windows .exe yaratish

#### 1. Electron-builder orqali (.exe installer)

```bash
cd client
npm install
npm run build
```

Natija: `client/dist/Imtihon Tizimi Setup 1.0.0.exe` — bu to'liq Windows installer.

#### 2. Faqat papka ko'rinishida (test uchun)

```bash
npm run build:dir
```

Natija: `client/dist/win-unpacked/Imtihon Tizimi.exe`

### Klient konfiguratsiyasi

Klient dasturi server manzilini `config.json` dan o'qiydi.

**Development paytida:** `client/config.json`
**Production build'da:** `.exe` yonida yoki `resources/config.json`

```json
{
  "serverUrl": "http://192.168.1.100:3000/api",
  "wsUrl": "ws://192.168.1.100:3000"
}
```

> **Muhim:** `serverUrl` va `wsUrl` ni o'z serveringiz IP manziliga o'zgartiring. HTTPS ishlatilsa, `https://` va `wss://` bo'ladi.

### Talabalarga tarqatish

1. `Imtihon Tizimi Setup 1.0.0.exe` faylini talabalarga yuboring
2. O'rnatish oddiy — **Next → Next → Install**
3. **Administrator** sifatida o'rnatiladi (full-screen va klaviatura bloklash uchun kerak)
4. Dastur **avtomatik full-screen** rejimda ochiladi
5. Login sahifasida admin tomonidan berilgan login/parolni kiriting

---

## 🐳 Docker orqali to'liq deploy

### Arxitektura

```
┌─────────────────────────────────────────────┐
│  exam-network (docker bridge)               │
│                                             │
│  ┌──────────┐   ┌──────────┐   ┌────────┐  │
│  │  nginx   │ ← │  server  │ ← │  mongo │  │
│  │  :80     │   │  :3000   │   │ :27017 │  │
│  └──────────┘   └──────────┘   └────────┘  │
│       ↑                                      │
└───────┼──────────────────────────────────────┘
        │
   Host port 80
   (tashqi dunyo)
```

### To'liq deploy qo'llanmasi

#### 1. Serverni tayyorlash

```bash
# Ubuntu 22.04 da
sudo apt update && sudo apt install -y git curl
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

#### 2. Loyihani yuklash

```bash
sudo mkdir -p /opt/exam-system
sudo chown $USER:$USER /opt/exam-system
cd /opt/exam-system
git clone https://github.com/FOYDALANUVCHI/get-session.git .
```

#### 3. Muhim sozlamalarni o'zgartirish

**a) `server/.env` faylini tahrirlash:**

```bash
nano server/.env
```

```env
PORT=3000
MONGODB_URI=mongodb://admin:SIZNING_KUCHLI_PAROL@mongodb:27017/exam-system?authSource=admin
JWT_SECRET=$(openssl rand -hex 32)   # <-- YANGI KALIT
NODE_ENV=production
```

**b) `docker-compose.yml` dagi MongoDB parolini o'zgartirish:**

```bash
nano docker-compose.yml
```

```yaml
environment:
  MONGO_INITDB_ROOT_USERNAME: admin
  MONGO_INITDB_ROOT_PASSWORD: SIZNING_KUCHLI_PAROL    # .env dagi bilan bir xil
  MONGO_INITDB_DATABASE: exam-system
```

#### 4. Ishga tushirish

```bash
docker compose up -d --build
docker compose ps
```

#### 5. Boshlang'ich ma'lumotlar

```bash
docker exec exam-server node src/seed.js
```

#### 6. Xavfsizlik devori

```bash
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # Admin panel + API
sudo ufw allow 3000/tcp   # (ixtiyoriy) to'g'ridan API
sudo ufw enable
```

> **Eslatma:** 27017 (MongoDB) porti **ochilmasligi kerak** — faqat docker network ichida ishlaydi.

#### 7. Tekshirish

```bash
# Server sog'ligi
curl http://localhost:3000/health
# → {"status":"ok",...}

# Admin panel
# Brauzerda: http://serveringiz-IP/
```

---

## 🔐 Xavfsizlik

Tizim bir necha qatlamli xavfsizlik bilan jihozlangan:

### 1. Autentifikatsiya va avtorizatsiya

- **JWT tokenlar** — barcha himoyalangan endpointlar uchun
- **bcrypt** — parollar hashlangan saqlanadi (10 round)
- **Admin va student** uchun alohida token muddati
- **NoSQL injection** himoyasi (`$where`, `$gt` va boshqalar filtirlanadi)

### 2. Rate limiting

| Endpoint | Limit |
|----------|-------|
| Umumiy API | 30 so'rov / daqiqa / IP |
| Talaba login | 5 so'rov / 10 sek |
| Fan yuklash | 5 so'rov / 10 sek / user |
| Admin endpointlari | 10 so'rov / sek / user |

### 3. Avtomatik bloklash

- **3+ klaviatura bosish** → blok (`Ctrl+Shift+O` dan boshqa)
- **30 soniya heartbeat yo'q** → blok
- **Internet uzilishi** → blok
- **Rate limit buzilishi** → blok
- Admin panelda **qayta ochish** mumkin

### 4. HTTP xavfsizlik

- **Helmet** — HTTP headerlar tekshiruvi
- **CORS** — faqat ruxsat berilgan originlar (`localhost`, `192.168.x.x`)
- **50 MB body limit** — base64 rasmlar uchun

### 5. Klient darajasida

- **Klaviatura shortcut** lar bloklangan
- **Right-click context menu** o'chirilgan
- **DevTools** production'da yopiq
- **Window minimize/blur** qaytariladi

### ⚠️ Production uchun MUHIM

Quyidagilar **albatta** bajarilishi kerak:

- [ ] `JWT_SECRET` ni `openssl rand -hex 32` bilan yarating
- [ ] `docker-compose.yml` dagi `admin123` ni kuchli parolga almashtiring
- [ ] `.env` dagi MongoDB parolini ham o'zgartiring
- [ ] Admin panelga kirgach, **darhol** parolni o'zgartiring
- [ ] UFW yoqilgan va kerakli portlargina ochiq
- [ ] HTTPS o'rnatilgan (Let's Encrypt)
- [ ] Muntazam backup sozlamalari (`mongodump`)

---

## 📚 API hujjati

> **Base URL:** `http://server:3000`
> **Autentifikatsiya:** `Authorization: Bearer <token>` headerida

### Autentifikatsiya

| Metod | Endpoint | Tavsif | Auth |
|-------|----------|--------|------|
| `POST` | `/api/auth/login` | Talaba login | ❌ |
| `GET` | `/api/auth/me` | Joriy foydalanuvchi ma'lumotlari | ✅ Student |
| `POST` | `/api/admin/login` | Admin login | ❌ |
| `PUT` | `/api/admin/profile` | Admin parolini o'zgartirish | ✅ Admin |

### Fanlar (Subjects)

| Metod | Endpoint | Tavsif | Auth |
|-------|----------|--------|------|
| `GET` | `/api/subjects` | Talaba uchun mavjud fanlar | ✅ Student |
| `GET` | `/api/subjects/admin` | Barcha fanlar (admin) | ✅ Admin |
| `POST` | `/api/subjects` | Yangi fan yaratish | ✅ Admin |
| `PUT` | `/api/subjects/:id` | Fanni tahrirlash | ✅ Admin |
| `DELETE` | `/api/subjects/:id` | Fanni o'chirish | ✅ Admin |
| `POST` | `/api/subjects/:id/questions` | Savol qo'shish | ✅ Admin |

### Imtihon (Test)

| Metod | Endpoint | Tavsif | Auth |
|-------|----------|--------|------|
| `GET` | `/api/test/questions?subjectId=xxx` | Savollarni olish (imtihonni boshlash) | ✅ Student |
| `POST` | `/api/test/submit` | Javoblarni yuborish | ✅ Student |
| `POST` | `/api/test/heartbeat` | Heartbeat yuborish | ✅ Student |
| `GET` | `/api/test/status` | Faol sessiya holati | ✅ Student |
| `POST` | `/api/test/report-interruption` | Uzilish haqida xabar berish | ✅ Student |

### Foydalanuvchilar (Users, Admin)

| Metod | Endpoint | Tavsif | Auth |
|-------|----------|--------|------|
| `GET` | `/api/users` | Barcha talabalar | ✅ Admin |
| `POST` | `/api/users` | Talaba yaratish | ✅ Admin |
| `PUT` | `/api/users/:id` | Talaba ma'lumotlarini tahrirlash | ✅ Admin |
| `DELETE` | `/api/users/:id` | Talabani o'chirish | ✅ Admin |
| `GET` | `/api/users/blocked` | Bloklangan talabalar | ✅ Admin |
| `PUT` | `/api/users/:id/block` | Talabani bloklash | ✅ Admin |
| `PUT` | `/api/users/:id/unblock` | Blokdan chiqarish | ✅ Admin |
| `GET` | `/api/users/:id/history` | Talaba test tarixi | ✅ Admin |
| `GET` | `/api/users/reports/:sessionId` | Test hisobotini olish | ✅ Admin |

### Utility

| Metod | Endpoint | Tavsif | Auth |
|-------|----------|--------|------|
| `GET` | `/api/ping` | Internet tezligi tekshiruvi | ❌ |
| `GET` | `/health` | Server sog'ligi | ❌ |

### WebSocket (`ws://server:3000`)

**Mijoz → Server:**
```json
{ "type": "auth",       "userId": "...", "token": "..." }
{ "type": "heartbeat" }
{ "type": "keypress" }
```

**Server → Mijoz:**
```json
{ "type": "auth_success",    "message": "..." }
{ "type": "heartbeat_ack",   "remainingTime": 123456 }
{ "type": "keypress_ack",    "count": 1, "remaining": 2 }
{ "type": "blocked",         "reason": "excessive_keys", "message": "..." }
```

---

## 🛠️ Muammolarni hal qilish

### 1. Konteyner ishlamayapti

```bash
# Loglarni ko'rish
docker compose logs exam-server
docker compose logs exam-mongodb

# Qayta qurish
docker compose down
docker compose up -d --build
```

### 2. MongoDB ulanmayapti

```bash
# MongoDB ishlayotganini tekshirish
docker exec -it exam-mongodb mongosh -u admin -p

# .env dagi MONGODB_URI to'g'rimi?
# mongodb://admin:PAROL@mongodb:27017/exam-system?authSource=admin
```

### 3. Port band (80 yoki 3000)

```bash
# 80-portni kim ishlatayotganini topish
sudo ss -tlnp | grep :80

# Eski Nginx'ni o'chirish
sudo systemctl stop nginx
sudo systemctl disable nginx
```

### 4. Klient serverga ulanmayapti

1. `config.json` dagi IP manzil to'g'rimi?
2. Server port 3000 ochiqmi? — `telnet server-ip 3000`
3. Firewall (UFW) da 3000-port ochiqmi?
4. Server ishlayaptimi? — `curl http://server:3000/health`

### 5. Klientda "Serverga ulanib bo'lmadi"

- Server IP manzili noto'g'ri → `config.json` ni tekshiring
- Server ishlamayapti → `docker compose ps`
- `npm install` qilinmagan → `cd client && npm install`

### 6. Admin panelga kira olmayapman

```bash
# Seed skriptini qayta ishga tushirish
docker exec exam-server node src/seed.js
```

Standart login: `admin` / `admin123`

### 7. Talaba blokdan chiqmayapti

1. Admin panelga kiring
2. **Users → Blocked** bo'limiga o'ting
3. Talabani toping → **Unblock** tugmasini bosing
4. Talaba klientini qayta ishga tushirsin

### 8. Disk to'lib qoldi

```bash
# Docker eski obrazlarni tozalash
docker system prune -a

# Loglarni tozalash
sudo truncate -s 0 /var/lib/docker/containers/*/*-json.log

# Backup'larni eski qilib tashlash
```

### 9. Backup olish

```bash
# MongoDB backup
docker exec exam-mongodb mongodump --uri="mongodb://admin:PAROL@localhost:27017/exam-system?authSource=admin" --out=/tmp/backup

# Backup'ni hostga ko'chirish
docker cp exam-mongodb:/tmp/backup ./backup-$(date +%Y%m%d)
```

---

## 📊 Monitoring

### Real-vaqt kuzatish

```bash
# Konteyner resurslari
docker stats

# Server loglari
docker logs -f exam-server

# MongoDB loglari
docker logs -f exam-mongodb
```

### Foydali buyruqlar

```bash
# Barcha talabalarni ko'rish (MongoDB)
docker exec -it exam-mongodb mongosh -u admin -p PAROL \
  --eval "use exam-system; db.users.find({role:'student'}).pretty()"

# Faol test sessiyalarini ko'rish
docker exec -it exam-mongodb mongosh -u admin -p PAROL \
  --eval "use exam-system; db.testsessions.find({status:'active'}).count()"

# Bloklangan foydalanuvchilar
docker exec -it exam-mongodb mongosh -u admin -p PAROL \
  --eval "use exam-system; db.users.find({status:'blocked'}).count()"
```

---

## 🔄 Yangilash

```bash
cd /opt/exam-system
git pull origin main
docker compose up -d --build
```

> **Ma'lumotlar saqlanib qoladi** — `mongodb_data` volume'ida.

---

## 📞 Texnik yordam

Muammo yuzaga kelsa:

1. Loglarni tekshiring: `docker compose logs`
2. Server ishlayotganini tasdiqlang: `curl http://localhost:3000/health`
3. Klient konsolini oching (development rejimida): `Ctrl+Shift+I` (faqat dev)
4. GitHub Issues: [github.com/FOYDALANUVCHI/get-session/issues](https://github.com/FOYDALANUVCHI/get-session/issues)

---

## 📝 Litsenziya

MIT License — ta'lim maqsadlarida foydalanish uchun.

---

## 👥 Mualliflar

- **Loyiha muallifi:** Exam System
- **Versiya:** 1.0.0
- **Oxirgi yangilanish:** 2025

---

> **Eslatma:** Bu tizim ta'lim maqsadlarida yaratilgan. Production muhitda ishlatishdan oldin barcha maxfiy kalitlarni (`JWT_SECRET`, MongoDB paroli) **albatta** o'zgartiring.
