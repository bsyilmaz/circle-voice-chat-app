# İki Bilgisayar Arasında Sesli İletişim ve Ekran Paylaşımı Kılavuzu

Bu kılavuz, BizXM uygulamasını kullanarak iki farklı bilgisayar arasında sesli iletişim ve ekran paylaşımı yapmak için adım adım talimatları içerir.

## Ön Koşullar

- Her iki bilgisayarda da BizXM uygulaması kurulu olmalıdır
- Bilgisayarların aynı ağa bağlı olması veya internet bağlantısı olması gerekir
- Mikrofon erişimi izinlerinin verilmiş olması gerekir
- Ekran paylaşımı için ekran kaydetme izinlerinin verilmiş olması gerekir

## Yerel Ağ Üzerinden Bağlantı (Aynı Wi-Fi veya LAN)

En basit ve doğrudan yöntem, her iki bilgisayarın da aynı yerel ağa bağlı olmasıdır.

### Adım 1: Signaling Server'ı Başlatma

1. Bir bilgisayarda (işlem sırasında açık kalacak) komut satırı/terminal açın
2. BizXM uygulamasının kurulu olduğu dizine gidin
3. Signaling server'ı başlatmak için şu komutu çalıştırın:
   ```
   npm run start:signaling
   ```
4. Server başladığında "Signaling server running on port 3001" mesajını görmelisiniz

### Adım 2: Oda Oluşturma

1. İlk bilgisayarda BizXM uygulamasını başlatın
2. İsminizi girin
3. "Create Room" butonuna tıklayın
4. İsterseniz oda şifresi belirleyin
5. "Create Room" butonuna tıklayarak odayı oluşturun
6. Ekranda görünen oda ID'sini not alın veya kopyalayın (örneğin: f8be0197)

### Adım 3: Odaya Katılma

1. İkinci bilgisayarda BizXM uygulamasını başlatın
2. İsminizi girin
3. "Join Room" butonuna tıklayın
4. Birinci adımda aldığınız oda ID'sini girin
5. Oda şifresi belirlenmişse şifreyi girin
6. "Join Room" butonuna tıklayarak odaya katılın

### Adım 4: Sesli İletişim ve Ekran Paylaşımı

1. Bağlantı başarılı olduğunda, her iki taraf da birbirini katılımcılar listesinde görecektir
2. Sesli iletişim otomatik olarak başlar
3. Ekran paylaşımı yapmak için:
   - Ekranını paylaşmak isteyen kişi "Share Screen" butonuna tıklar
   - Paylaşmak istediği ekranı veya pencereyi seçer
   - Diğer katılımcı otomatik olarak paylaşılan ekranı görmeye başlar

## Internet Üzerinden Bağlantı

İnternet üzerinden bağlantı kurmak biraz daha karmaşıktır ve router ayarlarında değişiklik gerektirir.

### Adım 1: Router'da Port Forwarding Ayarı

1. Signaling server'ı çalıştıracağınız bilgisayarın yerel IP adresini bulun (örn. 192.168.1.5)
2. Router'ınızın yönetim paneline giriş yapın (genellikle 192.168.1.1 veya 192.168.0.1)
3. Port Forwarding (Port Yönlendirme) bölümünü bulun
4. Yeni bir kural ekleyin:
   - Port: 3001
   - Protokol: TCP/UDP
   - Hedef IP: Bilgisayarınızın yerel IP adresi
   - Durum: Aktif
5. Değişiklikleri kaydedin

### Adım 2: Signaling Server'ı Başlatma

1. Signaling server'ı çalıştıracağınız bilgisayarda komutu çalıştırın:
   ```
   npm run start:signaling
   ```

### Adım 3: Dış IP Adresinizi Öğrenme

1. Dış (public) IP adresinizi öğrenmek için [whatismyip.com](https://www.whatismyip.com/) adresini ziyaret edin
2. Görüntülenen IP adresini not alın (örn. 94.54.250.94)

### Adım 4: Oda Oluşturma

1. Signaling server'ın çalıştığı bilgisayarda BizXM uygulamasını başlatın
2. İsminizi girin ve "Create Room" ile oda oluşturun
3. Oda ID'sini not alın

### Adım 5: Odaya Katılma

1. İkinci bilgisayarda BizXM uygulamasını başlatın
2. İsminizi girin ve "Join Room" ile odaya katılın
3. Oda ID'sini ve (gerekiyorsa) şifreyi girin

## Sorun Giderme

### Bağlantı Sorunları

1. **Signaling Server Hatası**: Server'ın çalıştığından emin olun, konsol çıktısını kontrol edin
2. **Port Forwarding Hatası**: Router ayarlarını kontrol edin, port 3001'in doğru yönlendirildiğinden emin olun
3. **Firewall Engeli**: Güvenlik duvarının 3001 portuna izin verdiğinden emin olun

### Ses/Mikrofon Sorunları

1. Mikrofon izinlerinin verildiğinden emin olun
2. Sistem ayarlarından mikrofonun çalıştığını kontrol edin
3. Uygulamada mikrofon düğmesinin aktif olduğundan emin olun

### Ekran Paylaşımı Sorunları

1. Ekran kaydetme izinlerinin verildiğinden emin olun
2. macOS'ta Sistem Ayarları > Gizlilik ve Güvenlik > Ekran Kaydı izinlerini kontrol edin
3. Windows'ta uygulama izinlerini kontrol edin

## Klavye Kısayolları

- **M**: Mikrofonu açma/kapatma
- **S**: Ekran paylaşımını başlatma/durdurma
- **Esc**: Odadan ayrılma 