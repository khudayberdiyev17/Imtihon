# Docker sinov hisoboti — 2026-11-07

Muhit: lokal Docker Desktop Linux. Alohida `imtihon-smoke` Compose project, alohida volume va 18082 port. Haqiqiy server ma’lumotlari ishlatilmadi.

Tekshirildi:
- Node 24 Alpine backend image build, MongoDB 6 va nginx konteynerlari.
- Compose healthcheck va xizmatlarning ishga tushish tartibi.
- Panel HTTP javobi, health endpoint, admin yaratish (ikki marta; mavjud parol saqlanishi), login.
- WebSocket: noto‘g‘ri token rad etilishi va to‘g‘ri admin tokeni bilan ulanish.
- Fan/talaba yaratish, rasm uzatish, javob kalitini klientga chiqarmaslik.
- Takroriy javoblarni rad etish, javob draftlarini bazaga saqlash.
- Backend restartidan keyin savol/variant tartibi va javoblarning tiklanishi.
- Imtihon davomida fan savollarini o‘zgartirganda dastlabki snapshot bilan baholash.
- Takroriy submit bir xil natijani qaytarishi; admin hisobot.
- Biriktirilmagan fanni boshlash rad etilishi.
- 3 soniyalik imtihon timeoutida saqlangan javob 100% baholanib, sessiya yopilishi.
- 5 unit test.

Tuzatishlar: restart javobidagi originalIndex nomuvofiqligi olib tashlandi. Ishlatilmayotgan uuid chiqarildi; mos dependency yangilanishlari va qs 6.16.2 override qo‘llandi. Production `npm audit --omit=dev`: 0 zaiflik. Development nodemon/minimatch zanjirida 2 moderate ogohlantirish qolgan, ular production imagega kirmaydi.

Sinovdan keyingi bir martalik yengil holat o‘lchovi: MongoDB 169.5 MiB, Node 37.88 MiB, nginx 7.965 MiB; jami taxminan 215 MiB. Bu maksimal sarf yoki parallel talabalar sig‘imi emas. Oracle, HTTPS/DNS, Electron grafik interfeysi va ko‘p foydalanuvchili yuk sinovi ushbu tekshiruvga kirmaydi.

API test kodi: server/test/docker-smoke.cjs. Lokal `.smoke.env` maxfiy fayli deploy arxiviga kiritilmaydi.
