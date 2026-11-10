# Oracle serverga Docker Compose orqali joylash

Server: 80.225.243.175; domen: imtihon.cybertron.uz.
Talab: Docker Engine va Docker Compose v2, bash, openssl. Mavjud reverse proxy hostda ishlaydi deb olingan.

## Yangi o‘rnatish
Arxivni serverda alohida papkaga oching, shu papkada:

```bash
bash deploy/init-env.sh
docker compose config --quiet
docker compose up -d --build --wait
docker compose exec server node src/create-admin.js
curl --fail http://127.0.0.1:8082/health
docker compose ps
```

Admin login `admin`. Parol serverdagi `.env` faylining `ADMIN_PASSWORD` qiymati. Uni xavfsiz joyda saqlang. `create-admin.js` qayta ishga tushirilsa mavjud parolni almashtirmaydi. `seed.js` ishlatmang: u demo ma’lumotlar kiritadi va admin parolini almashtiradi.

## Domen va HTTPS
DNS A: `imtihon.cybertron.uz` → `80.225.243.175`.
Mavjud reverse proxyda shu domenni `http://127.0.0.1:8082` ga yo‘naltiring; WebSocketni yoqing. HTTPS sertifikati shu domen uchun bo‘lsin. Host nginx uchun `deploy/nginx-host.conf` namunasi berilgan; uni faqat sertifikat mavjud bo‘lgach qo‘llang, mavjud saytlarni almashtirmang. `nginx -t` muvaffaqiyatli bo‘lgach reload qiling.
Agar proxy ham Docker konteynerida bo‘lsa, uning `127.0.0.1` manzili host emas: umumiy Docker tarmog‘i orqali `admin-panel:80` ga ulang yoki host gatewayni alohida sozlang.
Tashqaridan faqat mavjud proxy 80/443 portlari ochiq bo‘lsin. MongoDB va Node portlari hostga chiqarilmagan. HTTP_PORT band bo‘lsa .env va reverse proxy upstreamni birga o‘zgartiring.
Klient oldindan `https://imtihon.cybertron.uz/api` va `wss://imtihon.cybertron.uz/ws` uchun yig‘ilgan.

## Resurslar
Mongo 384 MiB, Node 192 MiB, nginx 32 MiB: jami yuqori chegara 608 MiB. Serverda taxminan 500 MB bo‘sh RAM borligi sabab bu sig‘im kafolati emas. Swapga ko‘p murojaat kechikishni oshiradi. Dastlab kichik guruh bilan tekshiring: `docker stats`, `free -h`. Faol imtihonda restart/deploy qilmang. Bitta Node instance ishlating.

## Mavjud o‘rnatishni yangilash
Avval backup oling. `.env` va Compose project nomini/papka nomini saqlang: aks holda boshqa volume yaratilishi mumkin. `docker volume ls` orqali eski volumeni aniqlang. Mongo root paroli mavjud volume uchun env o‘zgarishi bilan yangilanmaydi: eski parolni saqlang yoki DB ichida alohida migratsiya qiling. Eski active sessiyalarda snapshot yo‘q; ularni tugatib, keyin yangilang.

```bash
mkdir -p backups
chmod 700 backups
docker compose exec -T mongodb sh -c 'mongodump --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db exam-system --archive --gzip' > "backups/exam-$(date +%Y%m%d-%H%M%S).gz"
docker compose up -d --build --wait
```

Backup buyrug‘i muvaffaqiyatli tugaganini va fayl bo‘sh emasligini tekshiring. `docker compose down -v` bazani o‘chiradi; yangilash uchun ishlatmang. Eski Mongo 6 volumeni shu konfiguratsiya ishlatadi; major DB upgrade ushbu o‘zgarishga kiritilmagan.

## Tekshirish
`docker compose logs --tail=100 server mongodb` — xatolar.
Brauzerda HTTPS orqali admin login; klientda talaba login, rasmli test, draft saqlash, test topshirish va hisobotni tekshiring. Dastur testlari: `npm test --prefix server` (Node o‘rnatilgan lokal muhitda).
Docker Desktop Linux muhitida image build, healthcheck va haqiqiy MongoDB bilan API integratsion sinovlari bajarildi. Natijalar DOCKER-TEST.md faylida.

## GitHub orqali yangilash (ZIPdan o‘rnatilgan server)
Faol imtihonlar tugagach va backup olgach bajaring. Amaldagi papka hamda `.env` saqlanadi:

```bash
# Bir marta:
git clone https://github.com/khudayberdiyev17/Imtihon.git ~/Imtihon-source
# Keyingi yangilashlarda:
git -C ~/Imtihon-source pull --ff-only origin main
# Kodni amaldagi Compose papkasiga joylash (.env arxivga kirmaydi):
git -C ~/Imtihon-source archive main | tar -x -C ~/imtihon_tizimi
cd ~/imtihon_tizimi
sudo docker compose up -d --build --wait
```
Agar loyiha avvaldan Git orqali aynan shu papkaga klonlangan bo‘lsa, `git pull --ff-only origin main` va Compose buyrug‘i yetarli. `.env`ni almashtirmang, Compose project nomini o‘zgartirmang.

## PDF Export
Admin menyusida Export: bitta yoki barcha sinflarni, barcha yoki checkbox orqali ayrim fanlarni tanlang. Jadval FISh, har bir fan uchun jami savol/to‘g‘ri javob/saqlangan foizni ko‘rsatadi. Tugallangan natija bo‘lmasa “Bo‘sh”, 0 ball esa “0%”. Bir nechta natijadan oxirgi tugallangani olinadi. Har sinf yangi sahifadan, 6 tadan ortiq fan keyingi sahifalarda davom etadi. PDF brauzerda yaratiladi; serverga Chromium yoki PDF servisi o‘rnatilmaydi. Foydalanuvchi modelida otasining ismi alohida saqlanmagan: mavjud familiya va ism, ular bo‘lmasa login chiqariladi.
