# Güvenlik politikası

## Desteklenen sürüm

Yalnızca en güncel Kuzens masaüstü ve web sürümü güvenlik güncellemeleri alır.

## Açık bildirme

Bir güvenlik açığı bulursanız ayrıntıları herkese açık issue veya sohbet mesajı olarak paylaşmayın. Depo sahibiyle özel bir iletişim kanalı üzerinden şu bilgileri iletin:

- Açığın kısa açıklaması
- Tekrarlama adımları
- Etkilenen sayfa veya sürüm
- Varsa ekran görüntüsü ya da zararsız örnek

Hesap parolası, oturum çerezi, erişim anahtarı veya başka bir kullanıcının kişisel verisini rapora eklemeyin.

## Masaüstü güvenlik sınırları

Kuzens masaüstü uygulaması yalnızca HTTPS kullanır. Node.js entegrasyonu kapalı, context isolation ve Chromium sandbox açıktır. Medya izinleri resmi Kuzens kaynağıyla sınırlandırılmıştır. Uygulama; geçersiz sertifikaları kabul etmez ve harici bağlantıları sistem tarayıcısına gönderir.
