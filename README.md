# BizXM - Sesli Sohbet ve Ekran Paylaşımı Uygulaması

BizXM, WebRTC teknolojisini kullanarak sesli sohbet ve ekran paylaşımı yapmanızı sağlayan masaüstü uygulamasıdır. Gürültü bastırma, oda yönetimi, şifre koruması ve QR kod paylaşımı gibi özellikler içerir.

## Özellikler

- Yüksek kaliteli sesli sohbet
- Ekran paylaşımı
- Gürültü bastırma
- Oda yönetimi ve parola koruması
- QR kod ile oda paylaşımı
- Açık/koyu tema desteği
- Cross-platform (macOS ve Windows desteği)

## Kurulum

İşletim sisteminize uygun olan kurulum dosyasını indirin:

- **Windows**: `BizXM-Setup.exe` (Kurulum Sihirbazı) veya `BizXM.exe` (Taşınabilir)
- **macOS**: `BizXM.dmg` (Sürükle-Bırak Kurulum) veya `BizXM-mac.zip` (Arşiv)

## Kullanım

### Oda Oluşturma

1. Uygulamayı başlatın
2. İsminizi girin
3. "Create Room" butonuna tıklayın
4. İsteğe bağlı olarak oda şifresi belirleyin
5. "Create Room" butonuna tıklayarak odayı oluşturun
6. Oluşturulan oda ID'sini kopyalayın veya QR kodu paylaşın

### Odaya Katılma

1. Uygulamayı başlatın
2. İsminizi girin
3. "Join Room" butonuna tıklayın
4. Oda ID'sini girin
5. Gerekiyorsa oda şifresini girin
6. "Join Room" butonuna tıklayarak odaya katılın

### Klavye Kısayolları

- `M`: Mikrofonu açma/kapatma
- `S`: Ekran paylaşımını başlatma/durdurma
- `Esc`: Odadan ayrılma

## Internet Üzerinden Bağlantı

İnternet üzerinden bağlantı kurmak için:

1. Öncelikle sunucu bilgisayarda router üzerinden 3001 portunu açmanız gerekir (port forwarding)
2. Oda oluşturan kişi signaling server'ı çalıştırmalıdır (`npm run start:signaling`)
3. Diğer kullanıcılar doğrudan odaya katılabilirler

## İki Bilgisayar Arasında Kullanım

İki bilgisayar arasında bağlantı kurmak için:

1. İlk bilgisayarda uygulamayı başlatın ve oda oluşturun
2. Oda ID'sini not alın veya kopyalayın
3. İkinci bilgisayarda uygulamayı başlatın ve "Join Room" seçeneğini kullanarak aynı oda ID'si ile odaya katılın

## Sorun Giderme

- **Bağlantı Hatası**: Signaling server'ın çalıştığından emin olun
- **Ses Sorunları**: Mikrofonunuzun bağlı ve çalışır durumda olduğunu kontrol edin
- **Ekran Paylaşımı Çalışmıyor**: İzinlerin doğru şekilde ayarlandığından emin olun

## Geliştirme

Uygulamayı geliştirme modunda çalıştırmak için:

```bash
npm install
npm run start:signaling
npm run dev
```

## System Requirements

- macOS 10.13+ (Apple Silicon or Intel)
- Windows 10+ (x64 or ARM64)
- Microphone access
- Screen sharing permissions

## Troubleshooting

### Connection Issues
- Ensure both users are connected to the internet
- Try restarting the application
- Make sure your firewall isn't blocking the application

### Screen Sharing Issues
- On macOS, ensure screen recording permissions are granted in System Preferences > Security & Privacy > Privacy
- On Windows, try running the application as administrator if screen sharing doesn't work

### Audio Issues
- Check that your microphone is properly connected and selected in your system settings
- Ensure the application has permission to access your microphone

## License

[MIT License](LICENSE)

## Acknowledgements

- [Electron](https://www.electronjs.org/)
- [WebRTC](https://webrtc.org/)
- [Simple-Peer](https://github.com/feross/simple-peer)
- [Socket.IO](https://socket.io/)
- [RNNoise](https://github.com/xiph/rnnoise) 