# Supabase sozlamalari

1. Supabase’da loyiha yarating va SQL Editor’da `supabase/setup.sql` faylini ishga tushiring.
2. Supabase Dashboard’da Authentication bo‘limidan admin foydalanuvchisini yarating. Uning UUID qiymatini `public.blog_admins` jadvaliga qo‘shing. Masalan, SQL Editor’da `insert into public.blog_admins (user_id) values ('ADMIN-USER-UUID');` so‘rovini UUID bilan ishga tushiring.
3. Project URL va publishable/anon key qiymatlarini `.env.example` asosida `.env.local` fayliga kiriting (`VITE_SUPABASE_URL` va `VITE_SUPABASE_ANON_KEY`). `service_role` kalitini brauzerga yoki `.env.local` ichidagi `VITE_` o‘zgaruvchiga hech qachon qo‘ymang.
4. `npm run dev` serverini qayta ishga tushiring. Sayt maqolalarni Supabase’dan ommaga o‘qiydi, admin esa Supabase email/paroli bilan kiradi.
5. Eski maqolalar avval joylangan brauzerda admin sifatida kirib, “Eski maqolalarni bazaga ko‘chirish” tugmasini bosing. Eski rasmlar va video fayllar ham yuklanadi; brauzerdagi nusxalar ko‘chirish tugamaguncha o‘chirilmaydi.

`blog-media` hamma uchun ochiq bucket bo‘ladi, shuning uchun unga joylangan media ommaga ko‘rinadi. Yozish/o‘chirish faqat UUID’si `blog_admins` jadvaliga kiritilgan adminlarga ruxsat etiladi. Supabase Storage’dagi fayl hajmi limitini kerak bo‘lsa loyiha sozlamalarida oshiring.
