# Tuzatish va 1 GB serverda ishga tushirish

Dizayn o‘zgartirilmagan. Mavjud savol/variant randomlashtirish saqlangan.

## Asosiy o‘zgarishlar
- JWT tekshiruvli WebSocket; identifikatsiya token ichidan olinadi.
- Dublikat/noto‘g‘ri javoblarni rad etish; rasmli savollar uzatiladi.
- Sessiya snapshoti, mapping va javob draftlari bazada: restartdan keyin shu fanni ochib davom etish mumkin.
- Vaqt server tomonidan hisoblanadi; timeout saqlangan javoblarni baholaydi. Takroriy submit saqlangan natijani qaytaradi.
- Savol kaliti va o‘tish chegarasining sessiya nusxasi saqlanadi; keyingi tahrir ballni o‘zgartirmaydi.
- Tarmoq uzilishi va oddiy klaviatura harakati avtomatik jazoga sabab bo‘lmaydi. Texnik xatoda soxta 0 ball chiqarilmaydi.
- Natija o‘chirish yopilgan; imtihon tarixi bor hisob o‘rniga bloklash ishlatiladi.
- HTTP heartbeat o‘rniga DB so‘rovisiz WS heartbeat. Javob tanlangandan 300 ms keyin draft saqlanadi; xatoda 5 soniyada qayta urinadi. Bir vaqtda bitta draft so‘rovi.
- Fanlar ro‘yxatida rasmlar va javob kalitlari o‘qilmaydi. Natijalar ro‘yxatida katta tafsilotlar olinmaydi.
- DB indekslar, maxPoolSize=10, nginx gzip level 2.

## Resurs cheklovi
Server: 2 CPU / 1 GB RAM / 2 GB swap; mavjud loyihalar taxminan 50% RAM ishlatadi.
Compose chegaralari: MongoDB 384 MiB (WiredTiger cache 256 MiB), Node 192 MiB (heap 128 MiB), nginx 32 MiB. Bu rezerv yoki o‘lchangan sarf emas, yuqori chegara. Jami 608 MiB mavjud taxminiy 500 MiB bo‘sh xotiradan katta. Parallel imtihon sig‘imi kafolatlanmaydi. OOM va swap sekinlashuvini kuzatish kerak; yuk oshsa mavjud xizmatlarni bo‘shatish yoki RAM/DB resursini oshirish kerak.
Bitta Node jarayoni ishlating; RAM holati sabab multi-worker/replica qo‘llanmaydi. Rasmli testlar katta bo‘lsa snapshotlar har sessiyada saqlanadi va RAM/disk sarfini oshiradi.

## Deploy (avval faol imtihonlarni tugating va DB backup oling)
1. .env.example nusxasidan .env yarating. MONGO_PASSWORD va JWT_SECRET uchun alohida tasodifiy hex qiymat qo‘ying. Mavjud Mongo volume bo‘lsa parolni o‘zgartirish alohida migratsiya talab qiladi: env parolni avtomatik almashtirmaydi.
2. docker compose up -d --build. Backend va DB ommaviy portga chiqarilmagan. Panel localhost:8082 orqali.
3. Mavjud HTTPS reverse proxyda imtihon.cybertron.uz hostini http://127.0.0.1:8082 ga yo‘naltiring, WebSocket Upgrade/Connection headerlarini uzating. 16 MB body limit qo‘ying. DNS A yozuvi 80.225.243.175 ga yo‘nalsin. TLS sertifikat va DNS ushbu ishda serverda sozlanmagan.
4. Client config: https://imtihon.cybertron.uz/api va wss://imtihon.cybertron.uz/ws. O‘rnatilgach exe yonidagi config.json orqali almashtirish mumkin.
5. npm test --prefix server. Haqiqiy staging DBda login, parallel start, draft/restart/resume, timeout, qayta submit, rasm va admin hisobotini tekshiring. docker stats bilan resurslarni o‘lchang.

## Cheklovlar
- Eski active sessiyalar snapshotga ega emas: restartda interrupted qilinadi, yo‘qolgan eski javoblarni qaytarib bo‘lmaydi.
- Aloqa uzilgan paytda serverga yetmagan javoblar server timeoutiga kirmaydi. Ilova yopilsa yuborilmagan lokal javoblar yo‘qoladi.
- Eski natijalar uchun snapshot yo‘q; avval tahrirlangan savollar tarixini qayta yaratib bo‘lmaydi.
- Kiosk OS darajasida himoya emas; faol testda emergency shortcut yopilgan, ammo OS administratorini to‘xtatmaydi.
- Kamera/ko‘z/bosh kuzatuvi qo‘shilmagan.
- 5 unit testga qo‘shimcha Docker ichidagi haqiqiy MongoDB bilan API integratsion sinovlari bajarildi. Oracle serverda yuk testi hali bajarilmagan.
