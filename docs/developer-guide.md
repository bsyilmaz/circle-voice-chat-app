# BizXM Geliştirici Kılavuzu

Bu dokümantasyon, BizXM uygulamasını geliştirmeye başlamak için gereken bilgileri içerir.

## Proje Yapısı

```
bizxm/
├── build/                  # Derleme için gerekli dosyalar
├── dist/                   # Derlenmiş paketler
├── docs/                   # Dokümantasyon
├── public/                 # Statik dosyalar
│   ├── assets/             # Görsel ve ikonlar
│   ├── libs/               # Üçüncü parti kütüphaneler
│   ├── index.html          # Ana HTML dosyası
│   ├── renderer.js         # Renderer işlemi JavaScript dosyası
│   └── styles.css          # Stil dosyası
├── src/                    # Kaynak kodlar
│   ├── main/               # Electron ana işlem dosyaları
│   │   ├── main.js         # Ana Electron işlemi
│   │   └── preload.js      # Preload script
│   ├── renderer/           # Renderer işlemi modülleri
│   │   └── noise-suppression.js # Gürültü bastırma modülü
│   └── signaling/          # Sinyal sunucusu
│       └── server.js       # WebSocket sinyal sunucusu
└── package.json            # Proje konfigürasyonu
```

## Geliştirme Ortamı Kurulumu

1. Node.js ve npm kurulu olduğundan emin olun
2. Projeyi klonlayın
3. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```
4. Geliştirme modunda başlatın:
   ```bash
   npm run dev
   ```

## Temel Bileşenler

### 1. Electron Ana İşlem (main.js)

Ana işlem, Electron penceresini oluşturur ve yönetir.

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Ana pencere referansı
let mainWindow;

function createWindow() {
  // Tarayıcı penceresi oluştur
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // HTML dosyasını yükle
  mainWindow.loadFile(path.join(__dirname, '../../public/index.html'));
}

// Uygulama hazır olduğunda
app.whenReady().then(createWindow);
```

### 2. Preload Script (preload.js)

Preload script, renderer işleminin güvenli bir şekilde ana işlemle iletişim kurmasını sağlar.

```javascript
const { contextBridge, ipcRenderer } = require('electron');

// API'leri renderer işlemine sunma
contextBridge.exposeInMainWorld('electronAPI', {
  // IPC fonksiyonları
  send: (channel, data) => {
    // Kanal listesini sınırla
    const validChannels = ['app-quit', 'leave-room', 'toggle-theme'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  receive: (channel, func) => {
    // Kanal listesini sınırla
    const validChannels = ['toggle-theme', 'user-joined', 'user-left'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => func(...args));
    }
  },
  
  // Ekran paylaşımı
  getScreenSources: async () => {
    return await ipcRenderer.invoke('get-screen-sources');
  }
});
```

### 3. Renderer İşlemi (renderer.js)

Renderer işlemi, kullanıcı arayüzünü ve WebRTC bağlantılarını yönetir.

```javascript
// Global değişkenler
let socket;
let peers = {};
let localStream;
let screenStream;
let currentRoom = null;

// WebRTC konfigürasyonu
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { 
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

// Sinyal sunucusuna bağlan
function connectToSignalingServer() {
  socket = io('http://localhost:3001');
  
  socket.on('connect', () => {
    console.log('Sinyal sunucusuna bağlandı');
  });
  
  socket.on('user-joined', async ({ userId, username }) => {
    // Yeni kullanıcı için peer bağlantısı kur
    await createPeerConnection(userId, username, true);
  });
  
  socket.on('signal', ({ from, signal }) => {
    // Sinyal verisini işle
    if (peers[from]) {
      peers[from].peer.signal(signal);
    }
  });
}

// Peer bağlantısı oluştur
async function createPeerConnection(userId, username, initiator) {
  const peer = new SimplePeer({
    initiator,
    stream: localStream,
    config: rtcConfig
  });
  
  peers[userId] = { peer, username };
  
  peer.on('signal', signal => {
    // Sinyal verisini diğer tarafa gönder
    socket.emit('signal', { to: userId, signal });
  });
  
  peer.on('stream', stream => {
    // Gelen akışı işle (video için)
    if (stream.getVideoTracks().length > 0) {
      document.getElementById('screen-share-video').srcObject = stream;
    }
  });
}

// Oda oluştur
async function createRoom() {
  // Kullanıcı medyasını al
  await setupLocalMedia();
  
  // Sinyal sunucusuna bağlan
  connectToSignalingServer();
  
  // Sunucuda oda oluştur
  socket.emit('create-room', { username }, response => {
    if (response.success) {
      currentRoom = response.roomId;
      // UI'ı güncelle
    }
  });
}
```

### 4. Sinyal Sunucusu (server.js)

Sinyal sunucusu, istemcilerin WebRTC bağlantıları için sinyal verilerini paylaşmalarını sağlar.

```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Oda verileri
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Kullanıcı bağlandı:', socket.id);
  
  // Oda oluşturma
  socket.on('create-room', ({ username, password }, callback) => {
    const roomId = generateRoomId();
    rooms.set(roomId, {
      host: socket.id,
      password: password || null,
      participants: new Map([[socket.id, { username, isHost: true }]])
    });
    
    socket.join(roomId);
    socket.room = roomId;
    
    callback({ success: true, roomId });
  });
  
  // Odaya katılma
  socket.on('join-room', ({ roomId, username, password }, callback) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      return callback({ success: false, error: 'Oda bulunamadı' });
    }
    
    if (room.password && room.password !== password) {
      return callback({ success: false, error: 'Yanlış şifre' });
    }
    
    // Odaya katıl
    socket.join(roomId);
    socket.room = roomId;
    
    // Kullanıcıyı listeye ekle
    room.participants.set(socket.id, { username, isHost: false });
    
    // Katılımcıları listele
    const participants = Array.from(room.participants).map(([id, data]) => ({
      id,
      username: data.username,
      isHost: data.isHost
    }));
    
    // Başarılı katılım bildirimi
    callback({ success: true, roomId, participants });
    
    // Diğer katılımcılara yeni kullanıcı bilgisi gönder
    socket.to(roomId).emit('user-joined', { userId: socket.id, username });
  });
  
  // Sinyal verisi iletimi
  socket.on('signal', ({ to, signal }) => {
    io.to(to).emit('signal', {
      from: socket.id,
      username: socket.room ? rooms.get(socket.room).participants.get(socket.id).username : null,
      signal
    });
  });
  
  // Bağlantı kesildiğinde
  socket.on('disconnect', () => {
    if (socket.room) {
      const room = rooms.get(socket.room);
      
      if (room) {
        // Kullanıcıyı odadan çıkar
        room.participants.delete(socket.id);
        
        // Diğer kullanıcılara bildir
        socket.to(socket.room).emit('user-left', {
          userId: socket.id,
          username: room.participants.get(socket.id)?.username
        });
        
        // Eğer oda boşsa silelim
        if (room.participants.size === 0) {
          rooms.delete(socket.room);
        }
        // Eğer host ayrıldıysa, odayı kapatalım
        else if (socket.id === room.host) {
          socket.to(socket.room).emit('room-closed', { reason: 'Host ayrıldı' });
          rooms.delete(socket.room);
        }
      }
    }
  });
});

// 8 karakterlik rastgele oda ID'si oluşturma
function generateRoomId() {
  return Math.random().toString(16).substring(2, 10);
}

// Sunucuyu başlat
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
```

## API Referansı

### Renderer Process API

#### `window.electronAPI`

- `send(channel: string, data: any)`: Ana işleme mesaj gönderir
- `receive(channel: string, callback: Function)`: Ana işlemden mesaj dinler
- `getScreenSources()`: Ekran kaynak listesini alır

### IPC Kanalları

- `app-quit`: Uygulamadan çıkış
- `leave-room`: Odadan ayrılma
- `toggle-theme`: Tema değiştirme
- `get-screen-sources`: Ekran kaynaklarını getirme

### Socket.IO Olayları

- `create-room`: Oda oluşturma
- `join-room`: Odaya katılma
- `signal`: WebRTC sinyal verisi iletimi
- `user-joined`: Kullanıcı katılımı
- `user-left`: Kullanıcı ayrılması
- `screen-sharing`: Ekran paylaşımı durumu
- `mute-update`: Mikrofon durumu

## WebRTC Akışı

1. Kullanıcı A oda oluşturur veya var olan bir odaya katılır
2. Kullanıcı B aynı odaya katılır
3. Sinyal sunucusu Kullanıcı B'nin katıldığını Kullanıcı A'ya bildirir
4. Kullanıcı A yeni peer bağlantısı oluşturur (initiator=true)
5. WebRTC offer oluşturulur ve sinyal sunucusu üzerinden Kullanıcı B'ye iletilir
6. Kullanıcı B offer'ı alır ve answer oluşturur
7. Answer sinyal sunucusu üzerinden Kullanıcı A'ya iletilir
8. ICE adayları karşılıklı değiştirilir
9. Bağlantı kurulduğunda peer-to-peer iletişim başlar

## Uygulama Derleme

Uygulamayı paketlemek ve dağıtım dosyalarını oluşturmak için:

```bash
# Tüm platformlar için derleme
npm run build

# Sadece macOS için derleme
npm run build:mac

# Sadece Windows için derleme
npm run build:win

# Sadece Linux için derleme
npm run build:linux
```

Çıktı dosyaları `dist/` dizininde oluşturulur.

## Bağımlılıklar

- **Electron**: Masaüstü uygulaması çatısı
- **Socket.IO**: WebSocket tabanlı gerçek zamanlı iletişim
- **Simple-Peer**: WebRTC peer bağlantıları
- **Express**: HTTP sunucusu ve REST API

## En İyi Uygulamalar

1. **Güvenlik**:
   - `contextIsolation: true` kullanarak renderer-main işlem arası izolasyon sağlayın
   - `nodeIntegration: false` ile Node.js entegrasyonunu kapatın

2. **Performans**:
   - Büyük veri aktarımlarını optimize edin
   - Gürültü bastırma işlemini WebWorkers üzerinde yapın

3. **Kullanıcı Deneyimi**:
   - Bağlantı sorunlarında otomatik yeniden bağlanma sağlayın
   - İşlem durumunu kullanıcıya bildir

## Sorun Giderme İpuçları

1. WebRTC bağlantı sorunları için ICE adaylarını kontrol edin
2. Mikrofon erişimi sorunları için izinleri doğrulayın
3. Ekran paylaşımı çalışmıyorsa sistem izinlerini kontrol edin 