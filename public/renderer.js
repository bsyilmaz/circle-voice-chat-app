let socket;
let peers = {};
let localStream;
let screenStream;
let currentRoom = null;
let isHost = false;
let username = '';
let isMuted = false;
let isScreenSharing = false;
let darkTheme = true;
let noiseSuppressionProcessor = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectTimeout = null;
if (window.electronAPI) {
  console.log('Electron API is available through contextBridge');
} else {
  console.warn('Electron API is not available through contextBridge');
}
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.google.com:19302' },
    { urls: 'stun:stun2.google.com:19302' },
    { urls: 'stun:stun3.google.com:19302' },
    { urls: 'stun:stun4.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:global.turn.twilio.com:3478?transport=udp',
      username: 'f4b4035eaa76f4a55de5f4351567653ee4ff6fa97b50b6b334fcc1be9c27212d',
      credential: 'w1WpapfvJSqv99YCyvgUSdQOQLw7mxy3dLqN7em3ABU='
    },
    {
      urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
      username: 'f4b4035eaa76f4a55de5f4351567653ee4ff6fa97b50b6b334fcc1be9c27212d',
      credential: 'w1WpapfvJSqv99YCyvgUSdQOQLw7mxy3dLqN7em3ABU='
    }
  ],
  iceCandidatePoolSize: 10
};
const SIGNALING_SERVERS = [
  'https:
  'http:
  'http:
  'https:
];
let currentServerIndex = 0;
const pendingSignals = {};
const processingSignal = {};
let NoiseSuppressionProcessor = null;
if (window.electron && window.electron.noiseSuppressionModule) {
  NoiseSuppressionProcessor = window.electron.noiseSuppressionModule.NoiseSuppressionProcessor;
} else {
  NoiseSuppressionProcessor = class SimpleNoiseSuppressionProcessor {
    constructor() {
      this.context = null;
      this.initialized = false;
    }
    async initialize(stream) {
      console.log('Using fallback noise suppression');
      return stream;
    }
    dispose() {
    }
  };
}
const screens = {
  welcome: document.getElementById('welcome-screen'),
  createRoom: document.getElementById('create-room-screen'),
  joinRoom: document.getElementById('join-room-screen'),
  room: document.getElementById('room-screen')
};
const elements = {
  usernameInput: document.getElementById('username'),
  createRoomBtn: document.getElementById('create-room-btn'),
  joinRoomBtn: document.getElementById('join-room-btn'),
  roomPasswordInput: document.getElementById('room-password'),
  createRoomSubmit: document.getElementById('create-room-submit'),
  roomIdInput: document.getElementById('room-id'),
  joinRoomPasswordInput: document.getElementById('join-room-password'),
  joinRoomSubmit: document.getElementById('join-room-submit'),
  roomIdDisplay: document.getElementById('room-id-display'),
  copyRoomIdBtn: document.getElementById('copy-room-id'),
  showQrCodeBtn: document.getElementById('show-qr-code'),
  toggleMuteBtn: document.getElementById('toggle-mute'),
  toggleScreenShareBtn: document.getElementById('toggle-screen-share'),
  leaveRoomBtn: document.getElementById('leave-room'),
  participantsList: document.getElementById('participants-list'),
  screenShareVideo: document.getElementById('screen-share-video'),
  noScreenMessage: document.getElementById('no-screen-message'),
  qrModal: document.getElementById('qr-modal'),
  qrCode: document.getElementById('qr-code'),
  modalRoomId: document.getElementById('modal-room-id'),
  closeModalBtn: document.querySelector('.close-modal'),
  notification: document.getElementById('notification'),
  notificationIcon: document.getElementById('notification-icon'),
  notificationMessage: document.getElementById('notification-message'),
  backBtns: document.querySelectorAll('.back-btn')
};
async function init() {
  setupEventListeners();
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    darkTheme = savedTheme === 'dark';
    updateTheme();
  }
  console.log('BizXM initialized');
  if (window.electronAPI) {
    window.electronAPI.receive('toggle-theme', () => {
      darkTheme = !darkTheme;
      updateTheme();
      localStorage.setItem('theme', darkTheme ? 'dark' : 'light');
    });
    console.log('IPC communication initialized through contextBridge');
  } else {
    console.warn('IPC communication not available');
  }
  setupScreenShareContainer();
}
function setupEventListeners() {
  elements.createRoomBtn.addEventListener('click', () => showScreen('createRoom'));
  elements.joinRoomBtn.addEventListener('click', () => showScreen('joinRoom'));
  elements.backBtns.forEach(btn => {
    btn.addEventListener('click', () => showScreen('welcome'));
  });
  elements.createRoomSubmit.addEventListener('click', createRoom);
  elements.joinRoomSubmit.addEventListener('click', joinRoom);
  elements.toggleMuteBtn.addEventListener('click', toggleMute);
  elements.toggleScreenShareBtn.addEventListener('click', toggleScreenShare);
  elements.leaveRoomBtn.addEventListener('click', leaveRoom);
  elements.copyRoomIdBtn.addEventListener('click', copyRoomId);
  elements.showQrCodeBtn.addEventListener('click', showQrCode);
  elements.closeModalBtn.addEventListener('click', () => elements.qrModal.classList.remove('active'));
  elements.usernameInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      elements.createRoomBtn.click();
    }
  });
  elements.roomPasswordInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      elements.createRoomSubmit.click();
    }
  });
  elements.roomIdInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      elements.joinRoomSubmit.click();
    }
  });
  elements.joinRoomPasswordInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      elements.joinRoomSubmit.click();
    }
  });
  window.addEventListener('click', (e) => {
    if (e.target === elements.qrModal) {
      elements.qrModal.classList.remove('active');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (currentRoom) {
      if (e.key === 'm') {
        toggleMute();
      }
      if (e.key === 's') {
        toggleScreenShare();
      }
      if (e.key === 'Escape') {
        leaveRoom();
      }
    }
  });
}
function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
  switch (screenName) {
    case 'welcome':
      elements.usernameInput.focus();
      break;
    case 'createRoom':
      elements.roomPasswordInput.focus();
      break;
    case 'joinRoom':
      elements.roomIdInput.focus();
      break;
  }
}
function connectToSignalingServer() {
  if (socket) {
    socket.disconnect();
  }
  const serverUrl = SIGNALING_SERVERS[currentServerIndex];
  console.log(`Connecting to signaling server: ${serverUrl}`);
  socket = io(serverUrl, {
    reconnectionAttempts: maxReconnectAttempts,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000
  });
  socket.on('connect', () => {
    console.log(`Connected to signaling server: ${serverUrl}`);
    reconnectAttempts = 0;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  });
  socket.on('disconnect', () => {
    console.log('Disconnected from signaling server');
    handleDisconnect();
  });
  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    reconnectAttempts++;
    if (reconnectAttempts >= maxReconnectAttempts) {
      currentServerIndex = (currentServerIndex + 1) % SIGNALING_SERVERS.length;
      showNotification('warning', `Failed to connect to server. Trying alternative server...`);
      if (!reconnectTimeout) {
        reconnectTimeout = setTimeout(() => {
          reconnectAttempts = 0;
          connectToSignalingServer();
        }, 3000);
      }
    }
  });
  socket.on('user-joined', async ({ userId, username }) => {
    showNotification('info', `${username} joined the room`);
    setTimeout(async () => {
      await createPeerConnection(userId, username, true);
    }, 1000);
  });
  socket.on('user-left', ({ userId, username }) => {
    showNotification('info', `${username} left the room`);
    removePeer(userId);
  });
  socket.on('signal', async ({ from, username, signal }) => {
    console.log('Received signal from', from, username, signal.type || 'candidate');
    if (processingSignal[from]) {
      if (!pendingSignals[from]) {
        pendingSignals[from] = [];
      }
      pendingSignals[from].push({ from, username, signal });
      console.log('Queueing signal for later processing');
      return;
    }
    await processSignal(from, username, signal);
  });
  socket.on('screen-sharing-update', ({ userId, username, active }) => {
    if (active) {
      showNotification('info', `${username} started sharing their screen`);
    } else {
      showNotification('info', `${username} stopped sharing their screen`);
      if (!isScreenSharing) {
        elements.screenShareVideo.style.display = 'none';
        elements.noScreenMessage.style.display = 'flex';
      }
    }
  });
  socket.on('user-mute-update', ({ userId, muted }) => {
    const participantItem = document.getElementById(`participant-${userId}`);
    if (participantItem) {
      const muteIcon = participantItem.querySelector('.mute-status');
      if (muteIcon) {
        muteIcon.classList.toggle('hidden', !muted);
      }
    }
  });
  socket.on('room-closed', ({ reason }) => {
    showNotification('warning', `Room closed: ${reason}`);
    leaveRoom();
  });
  setInterval(() => {
    if (currentRoom && socket && socket.connected) {
      socket.emit('heartbeat');
    }
  }, 60000);
}
async function processSignal(userId, username, signal) {
  try {
    processingSignal[userId] = true;
    if (!peers[userId] || !peers[userId].peer) {
      const shouldInitiate = signal.type !== 'offer';
      await createPeerConnection(userId, username, shouldInitiate);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (peers[userId] && peers[userId].peer) {
      try {
        if (peers[userId].peer.destroyed) {
          console.log('Peer was destroyed, recreating connection');
          removePeer(userId);
          await createPeerConnection(userId, username, signal.type !== 'offer');
          setTimeout(() => {
            if (peers[userId] && peers[userId].peer && !peers[userId].peer.destroyed) {
              try {
                peers[userId].peer.signal(signal);
              } catch (retryError) {
                console.error('Error reprocessing signal after recreation:', retryError);
              }
            }
          }, 500);
          return;
        }
        peers[userId].peer.signal(signal);
      } catch (error) {
        console.error('Error processing signal:', error);
        if (error.message.includes('cannot signal after peer is destroyed')) {
          removePeer(userId);
          if (!peers[userId] || !peers[userId].isRecreating) {
            if (!peers[userId]) {
              peers[userId] = { isRecreating: true, username };
            } else {
              peers[userId].isRecreating = true;
            }
            setTimeout(async () => {
              try {
                await createPeerConnection(userId, username, signal.type !== 'offer');
                if (peers[userId] && peers[userId].peer && !peers[userId].peer.destroyed) {
                  setTimeout(() => {
                    try {
                      peers[userId].peer.signal(signal);
                    } catch (retryError) {
                      console.error('Error reprocessing signal:', retryError);
                    }
                  }, 500);
                }
              } catch (recreateError) {
                console.error('Error recreating peer connection:', recreateError);
              } finally {
                if (peers[userId]) {
                  peers[userId].isRecreating = false;
                }
              }
            }, 2000);
          }
        }
      }
    }
  } finally {
    processingSignal[userId] = false;
    if (pendingSignals[userId] && pendingSignals[userId].length > 0) {
      const nextSignal = pendingSignals[userId].shift();
      setTimeout(() => {
        processSignal(nextSignal.from, nextSignal.username, nextSignal.signal);
      }, 500);
    }
  }
}
async function createRoom() {
  username = elements.usernameInput.value.trim() || 'Anonymous';
  const password = elements.roomPasswordInput.value.trim() || null;
  if (!username) {
    showNotification('error', 'Please enter your name');
    return;
  }
  try {
    await setupLocalMedia();
    connectToSignalingServer();
    socket.emit('create-room', { username, password }, (response) => {
      if (response.success) {
        currentRoom = response.roomId;
        isHost = true;
        elements.roomIdDisplay.textContent = currentRoom;
        elements.modalRoomId.textContent = currentRoom;
        showScreen('room');
        addParticipantToList(socket.id, username, true);
        showNotification('success', 'Room created successfully');
      } else {
        showNotification('error', response.error || 'Failed to create room');
      }
    });
  } catch (error) {
    console.error('Error creating room:', error);
    showNotification('error', 'Failed to access microphone');
  }
}
async function joinRoom() {
  username = elements.usernameInput.value.trim() || 'Anonymous';
  const roomId = elements.roomIdInput.value.trim();
  const password = elements.joinRoomPasswordInput.value.trim() || null;
  if (!username) {
    showNotification('error', 'Please enter your name');
    return;
  }
  if (!roomId) {
    showNotification('error', 'Please enter a room ID');
    return;
  }
  try {
    await setupLocalMedia();
    connectToSignalingServer();
    socket.emit('join-room', { roomId, username, password }, async (response) => {
      if (response.success) {
        currentRoom = response.roomId;
        isHost = response.isHost;
        elements.roomIdDisplay.textContent = currentRoom;
        elements.modalRoomId.textContent = currentRoom;
        showScreen('room');
        addParticipantToList(socket.id, username, isHost);
        if (response.participants && response.participants.length > 0) {
          for (const participant of response.participants) {
            if (participant.id !== socket.id) {
              addParticipantToList(participant.id, participant.username, participant.isHost);
              await createPeerConnection(participant.id, participant.username, true);
            }
          }
        }
        if (response.screenSharing) {
          elements.noScreenMessage.style.display = 'flex';
        }
        showNotification('success', 'Joined room successfully');
      } else {
        showNotification('error', response.error || 'Failed to join room');
      }
    });
  } catch (error) {
    console.error('Error joining room:', error);
    showNotification('error', 'Failed to access microphone');
  }
}
function leaveRoom() {
  if (currentRoom) {
    if (socket && socket.connected) {
      socket.emit('leave-room');
    }
    Object.values(peers).forEach(peer => {
      if (peer.peer) {
        peer.peer.destroy();
      }
    });
    peers = {};
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      screenStream = null;
    }
    if (noiseSuppressionProcessor) {
      noiseSuppressionProcessor.dispose();
      noiseSuppressionProcessor = null;
    }
    currentRoom = null;
    isHost = false;
    isMuted = false;
    isScreenSharing = false;
    elements.participantsList.innerHTML = '';
    elements.toggleMuteBtn.classList.add('active');
    elements.toggleMuteBtn.querySelector('.fa-microphone').classList.remove('hidden');
    elements.toggleMuteBtn.querySelector('.fa-microphone-slash').classList.add('hidden');
    elements.toggleScreenShareBtn.classList.remove('active');
    elements.screenShareVideo.style.display = 'none';
    elements.noScreenMessage.style.display = 'flex';
    showScreen('welcome');
  }
}
function handleDisconnect() {
  if (currentRoom) {
    showNotification('error', 'Disconnected from server. Attempting to reconnect...');
  }
  Object.keys(peers).forEach(peerId => {
    const peer = peers[peerId].peer;
    if (peer && peer._connected === false) {
      peer.destroy();
      delete peers[peerId];
    }
  });
}
async function setupLocalMedia() {
  try {
    console.log('Setting up local media stream');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const destination = audioContext.createMediaStreamDestination();
      const filterNode = audioContext.createBiquadFilter();
      filterNode.type = 'lowpass';
      filterNode.frequency.value = 8000;
      filterNode.Q.value = 0.5;
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -50;
      compressor.knee.value = 40;
      compressor.ratio.value = 12;
      compressor.attack.value = 0;
      compressor.release.value = 0.25;
      source.connect(filterNode);
      filterNode.connect(compressor);
      compressor.connect(destination);
      localStream = destination.stream;
      noiseSuppressionProcessor = {
        dispose: () => {
          source.disconnect();
          filterNode.disconnect();
          compressor.disconnect();
          if (audioContext.state !== 'closed') {
            audioContext.close();
          }
        }
      };
      console.log('Web Audio API noise suppression initialized');
    } catch (error) {
      console.error('Failed to initialize noise suppression:', error);
      localStream = stream;
    }
    return localStream;
  } catch (error) {
    console.error('Error getting user media:', error);
    showNotification('error', 'Failed to access microphone: ' + error.message);
    throw error;
  }
}
async function createPeerConnection(userId, peerUsername, initiator) {
  console.log('Creating peer connection to', userId, peerUsername, 'initiator:', initiator);
  try {
    if (peers[userId] && peers[userId].peer && !peers[userId].peer.destroyed) {
      console.log('Destroying existing peer connection with', userId);
      peers[userId].peer.destroy();
    }
    const peerOptions = {
      initiator,
      stream: localStream,
      config: rtcConfig,
      trickle: true,
      sdpTransform: (sdp) => {
        return sdp;
      }
    };
    const peer = new SimplePeer(peerOptions);
    if (peers[userId]) {
      peers[userId].peer = peer;
      peers[userId].username = peerUsername;
      peers[userId].isRecreating = false;
    } else {
      peers[userId] = { peer, username: peerUsername, isRecreating: false };
    }
    if (!document.getElementById(`participant-${userId}`)) {
      addParticipantToList(userId, peerUsername);
    }
    if (isScreenSharing && screenStream) {
      try {
        screenStream.getTracks().forEach(track => {
          peer.addTrack(track, screenStream);
        });
        console.log('Added screen sharing tracks to new peer connection with', userId);
      } catch (error) {
        console.error('Error adding screen track to new peer connection:', error);
      }
    }
    let connectionTimeout = null;
    peer.on('signal', signal => {
      console.log('Generated signal for', userId, signal.type || 'candidate');
      if (socket && socket.connected) {
        socket.emit('signal', { to: userId, signal });
      }
    });
    peer.on('stream', stream => {
      console.log('Received stream from', userId, peerUsername);
      console.log('Stream has video tracks:', stream.getVideoTracks().length);
      console.log('Stream has audio tracks:', stream.getAudioTracks().length);
      if (stream.getVideoTracks().length > 0) {
        console.log('Video tracks detected, displaying screen share');
        elements.screenShareVideo.srcObject = stream;
        elements.screenShareVideo.style.display = 'block';
        elements.noScreenMessage.style.display = 'none';
        const tryPlayVideo = (attempts = 0) => {
          elements.screenShareVideo.play().catch(err => {
            console.error('Error playing video:', err);
            if (attempts < 5) {
              setTimeout(() => tryPlayVideo(attempts + 1), 1000);
            } else {
              const playButton = document.createElement('button');
              playButton.textContent = 'Click to Start Video';
              playButton.className = 'play-button';
              playButton.onclick = () => {
                elements.screenShareVideo.play();
                if (playButton.parentNode) {
                  playButton.parentNode.removeChild(playButton);
                }
              };
              const container = document.querySelector('.screen-share-container');
              container.appendChild(playButton);
            }
          });
        };
        tryPlayVideo();
      }
      if (stream.getAudioTracks().length > 0) {
        console.log('Audio stream received from', peerUsername);
        let audioEl = document.getElementById(`audio-${userId}`);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.id = `audio-${userId}`;
          audioEl.autoplay = true;
          audioEl.controls = false;
          document.body.appendChild(audioEl);
        }
        audioEl.srcObject = stream;
        const tryPlayAudio = (attempts = 0) => {
          audioEl.play().catch(err => {
            console.error('Error playing audio:', err);
            if (attempts < 5) {
              setTimeout(() => tryPlayAudio(attempts + 1), 1000);
            }
          });
        };
        tryPlayAudio();
      }
    });
    peer.on('connect', () => {
      console.log('Peer connection established with', peerUsername);
      showNotification('success', `Connected to ${peerUsername}`);
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
    });
    peer.on('error', err => {
      console.error('Peer connection error:', err);
      if (err.message.includes('Failed to set remote answer sdp')) {
        setTimeout(() => {
          if (peers[userId] && !peers[userId].isRecreating) {
            peers[userId].isRecreating = true;
            console.log('Scheduled connection recovery with', userId);
            setTimeout(() => {
              if (peers[userId]) {
                console.log('Recreating peer connection after error');
                const newInitiator = !initiator;
                peers[userId].peer.destroy();
                createPeerConnection(userId, peerUsername, newInitiator);
              }
            }, 3000);
          }
        }, 1000);
      }
    });
    peer.on('close', () => {
      console.log('Peer connection closed with', userId);
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
    });
    connectionTimeout = setTimeout(() => {
      if (peers[userId] && peers[userId].peer === peer && !peer.connected) {
        console.log('Connection timeout with', userId, 'recreating with reversed initiator role');
        peers[userId].isRecreating = true;
        peer.destroy();
        createPeerConnection(userId, peerUsername, !initiator);
      }
    }, 15000);
    return peer;
  } catch (error) {
    console.error('Error creating peer connection:', error);
    throw error;
  }
}
function removePeer(userId) {
  if (peers[userId]) {
    if (peers[userId].peer && !peers[userId].peer.destroyed) {
      peers[userId].peer.destroy();
    }
    const isRecreating = peers[userId].isRecreating;
    const username = peers[userId].username;
    if (!isRecreating) {
      delete peers[userId];
    } else {
      peers[userId] = { 
        isRecreating: true,
        username: username
      };
    }
    const participantItem = document.getElementById(`participant-${userId}`);
    if (participantItem) {
      participantItem.remove();
    }
  }
}
function addParticipantToList(userId, username, isParticipantHost = false) {
  const participantItem = document.createElement('li');
  participantItem.id = `participant-${userId}`;
  participantItem.className = 'participant-item';
  const participantInfo = document.createElement('div');
  participantInfo.className = 'participant-info';
  const usernameElement = document.createElement('span');
  usernameElement.textContent = username;
  if (userId === socket.id) {
    const youBadge = document.createElement('span');
    youBadge.className = 'you-badge';
    youBadge.textContent = '(You)';
    usernameElement.appendChild(document.createTextNode(' '));
    usernameElement.appendChild(youBadge);
  }
  participantInfo.appendChild(usernameElement);
  if (isParticipantHost) {
    const hostBadge = document.createElement('span');
    hostBadge.className = 'host-badge';
    hostBadge.textContent = 'Host';
    participantInfo.appendChild(hostBadge);
  }
  const participantStatus = document.createElement('div');
  participantStatus.className = 'participant-status';
  const muteIcon = document.createElement('i');
  muteIcon.className = 'fas fa-microphone-slash mute-status hidden';
  const screenIcon = document.createElement('i');
  screenIcon.className = 'fas fa-desktop screen-status hidden';
  participantStatus.appendChild(muteIcon);
  participantStatus.appendChild(screenIcon);
  participantItem.appendChild(participantInfo);
  participantItem.appendChild(participantStatus);
  elements.participantsList.appendChild(participantItem);
}
function toggleMute() {
  if (!localStream) return;
  isMuted = !isMuted;
  elements.toggleMuteBtn.classList.toggle('active', !isMuted);
  elements.toggleMuteBtn.querySelector('.fa-microphone').classList.toggle('hidden', isMuted);
  elements.toggleMuteBtn.querySelector('.fa-microphone-slash').classList.toggle('hidden', !isMuted);
  if (socket) {
    const participantItem = document.getElementById(`participant-${socket.id}`);
    if (participantItem) {
      const muteIcon = participantItem.querySelector('.mute-status');
      if (muteIcon) {
        muteIcon.classList.toggle('hidden', !isMuted);
      }
    }
  }
  localStream.getAudioTracks().forEach(track => {
    track.enabled = !isMuted;
  });
  if (socket && socket.connected && currentRoom) {
    socket.emit('mute-update', { muted: isMuted });
  }
}
function setupScreenShareContainer() {
  const screenContainer = document.querySelector('.screen-share-container');
  const fullscreenBtn = document.createElement('button');
  fullscreenBtn.className = 'control-btn fullscreen-btn';
  fullscreenBtn.title = 'Toggle Fullscreen';
  fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
  if (!document.querySelector('.fullscreen-btn')) {
    screenContainer.appendChild(fullscreenBtn);
  }
  fullscreenBtn.addEventListener('click', toggleFullscreen);
}
function toggleFullscreen() {
  const videoEl = elements.screenShareVideo;
  const container = document.querySelector('.screen-share-container');
  if (!document.fullscreenElement) {
    if (videoEl.requestFullscreen) {
      videoEl.requestFullscreen();
    } else if (videoEl.webkitRequestFullscreen) { 
      videoEl.webkitRequestFullscreen();
    } else if (videoEl.msRequestFullscreen) { 
      videoEl.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) { 
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { 
      document.msExitFullscreen();
    }
  }
}
async function toggleScreenShare() {
  if (isScreenSharing && screenStream) {
    screenStream.getTracks().forEach(track => {
      track.stop();
    });
    screenStream = null;
    isScreenSharing = false;
    elements.toggleScreenShareBtn.classList.remove('active');
    elements.screenShareVideo.style.display = 'none';
    elements.noScreenMessage.style.display = 'flex';
    if (socket) {
      const participantItem = document.getElementById(`participant-${socket.id}`);
      if (participantItem) {
        const screenIcon = participantItem.querySelector('.screen-status');
        if (screenIcon) {
          screenIcon.classList.add('hidden');
        }
      }
    }
    if (socket && socket.connected && currentRoom) {
      socket.emit('screen-sharing', { active: false });
    }
    setTimeout(() => {
      recreateAllPeerConnections();
    }, 1000);
  } else {
    try {
      console.log('Starting screen sharing');
      let sourceId = null;
      if (window.electronAPI) {
        try {
          const sources = await window.electronAPI.getScreenSources();
          console.log('Found', sources.length, 'screen sources');
          if (sources.length === 0) {
            throw new Error('No screen sources found');
          }
          for (const source of sources) {
            if (source.name.toLowerCase().includes('primary') || 
                source.name.toLowerCase().includes('screen 1') ||
                source.name.toLowerCase().includes('display 1') ||
                source.name.toLowerCase().includes('main')) {
              sourceId = source.id;
              console.log('Automatically selected primary display:', source.name);
              break;
            }
          }
          if (!sourceId && sources.length > 0) {
            sourceId = sources[0].id;
            console.log('Selected first available screen source:', sources[0].name);
          }
          if (!sourceId) {
            sourceId = await showSourcePickerSimple(sources);
          }
        } catch (err) {
          console.error('Error getting screen sources:', err);
          showNotification('error', 'Failed to get screen sources: ' + err.message);
          return;
        }
      } else {
        showNotification('error', 'Screen sharing is only available in the Electron app');
        return;
      }
      if (!sourceId) {
        console.log('Screen sharing cancelled: No source selected');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false, 
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            maxWidth: 1280,
            maxHeight: 720,
            frameRate: { max: 15 }
          }
        }
      });
      console.log('Screen sharing stream obtained');
      screenStream = stream;
      isScreenSharing = true;
      setupScreenShareContainer();
      elements.toggleScreenShareBtn.classList.add('active');
      elements.screenShareVideo.srcObject = screenStream;
      elements.screenShareVideo.style.display = 'block';
      elements.noScreenMessage.style.display = 'none';
      elements.screenShareVideo.play().catch(error => {
        console.error('Error playing video, click to play:', error);
        showNotification('info', 'Click on the video to start playback');
        const playButton = document.createElement('button');
        playButton.textContent = 'Play Screen Share';
        playButton.className = 'play-button';
        playButton.style.position = 'absolute';
        playButton.style.top = '50%';
        playButton.style.left = '50%';
        playButton.style.transform = 'translate(-50%, -50%)';
        playButton.style.zIndex = '100';
        playButton.style.padding = '10px 20px';
        const container = document.querySelector('.screen-share-container');
        container.style.position = 'relative';
        container.appendChild(playButton);
        playButton.onclick = () => {
          elements.screenShareVideo.play();
          if (playButton.parentNode) {
            playButton.parentNode.removeChild(playButton);
          }
        };
      });
      if (socket) {
        const participantItem = document.getElementById(`participant-${socket.id}`);
        if (participantItem) {
          const screenIcon = participantItem.querySelector('.screen-status');
          if (screenIcon) {
            screenIcon.classList.remove('hidden');
          }
        }
      }
      if (socket && socket.connected && currentRoom) {
        socket.emit('screen-sharing', { active: true });
      }
      setTimeout(() => {
        sendScreenShareToPeers();
      }, 1000);
      screenStream.getVideoTracks()[0].onended = () => {
        console.log('Screen sharing stopped via browser UI');
        toggleScreenShare();
      };
    } catch (error) {
      console.error('Error sharing screen:', error);
      isScreenSharing = false;
      screenStream = null;
      showNotification('error', 'Failed to share screen: ' + (error.message || 'Unknown error'));
    }
  }
}
function sendScreenShareToPeers() {
  if (!isScreenSharing || !screenStream) return;
  console.log('Sending screen share to peers');
  Object.values(peers).forEach(peer => {
    if (peer.peer && !peer.peer.destroyed) {
      try {
        screenStream.getTracks().forEach(track => {
          peer.peer.addTrack(track, screenStream);
        });
      } catch (err) {
        console.error('Error adding screen track to peer:', err);
      }
    }
  });
}
async function showSourcePickerSimple(sources) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.style.zIndex = '1000';
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.maxWidth = '80%';
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    const title = document.createElement('h3');
    title.textContent = 'Choose what to share';
    const closeButton = document.createElement('button');
    closeButton.className = 'close-modal';
    closeButton.innerHTML = '&times;';
    closeButton.onclick = () => {
      document.body.removeChild(modal);
      resolve(null);
    };
    modalHeader.appendChild(title);
    modalHeader.appendChild(closeButton);
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    modalBody.style.display = 'flex';
    modalBody.style.flexWrap = 'wrap';
    modalBody.style.justifyContent = 'center';
    modalBody.style.gap = '15px';
    sources.forEach(source => {
      const sourceItem = document.createElement('div');
      sourceItem.className = 'source-item';
      sourceItem.style.cursor = 'pointer';
      sourceItem.style.padding = '10px';
      sourceItem.style.borderRadius = '5px';
      sourceItem.style.border = '1px solid var(--border-color)';
      sourceItem.style.textAlign = 'center';
      sourceItem.style.width = '150px';
      if (source.thumbnail) {
        const img = document.createElement('img');
        img.src = source.thumbnail.toDataURL();
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.marginBottom = '5px';
        sourceItem.appendChild(img);
      }
      const name = document.createElement('div');
      name.textContent = source.name;
      name.style.overflow = 'hidden';
      name.style.textOverflow = 'ellipsis';
      name.style.whiteSpace = 'nowrap';
      sourceItem.appendChild(name);
      sourceItem.onclick = () => {
        document.body.removeChild(modal);
        resolve(source.id);
      };
      modalBody.appendChild(sourceItem);
    });
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
  });
}
function copyRoomId() {
  if (!currentRoom) return;
  navigator.clipboard.writeText(currentRoom)
    .then(() => {
      showNotification('success', 'Room ID copied to clipboard');
    })
    .catch(err => {
      console.error('Failed to copy room ID:', err);
      showNotification('error', 'Failed to copy room ID');
    });
}
function showQrCode() {
  if (!currentRoom) return;
  const roomInfo = {
    id: currentRoom,
    host: username
  };
  const qrData = JSON.stringify(roomInfo);
  try {
    const qrContainer = document.getElementById('qr-code');
    qrContainer.innerHTML = '';
    const qr = qrcode(0, 'L');
    qr.addData(qrData);
    qr.make();
    const qrImg = qr.createImgTag(5);
    qrContainer.innerHTML = qrImg;
    elements.qrModal.classList.add('active');
    elements.modalRoomId.textContent = currentRoom;
  } catch (error) {
    console.error('Error generating QR code:', error);
    showNotification('error', 'Failed to generate QR code');
  }
}
function showNotification(type, message) {
  switch (type) {
    case 'success':
      elements.notificationIcon.className = 'fas fa-check-circle';
      elements.notificationIcon.style.color = 'var(--success)';
      break;
    case 'error':
      elements.notificationIcon.className = 'fas fa-exclamation-circle';
      elements.notificationIcon.style.color = 'var(--dark-danger)';
      break;
    case 'warning':
      elements.notificationIcon.className = 'fas fa-exclamation-triangle';
      elements.notificationIcon.style.color = 'var(--warning)';
      break;
    case 'info':
    default:
      elements.notificationIcon.className = 'fas fa-info-circle';
      elements.notificationIcon.style.color = 'var(--info)';
      break;
  }
  elements.notificationMessage.textContent = message;
  elements.notification.classList.add('active');
  setTimeout(() => {
    elements.notification.classList.remove('active');
  }, 3000);
}
function updateTheme() {
  document.body.classList.toggle('dark-theme', darkTheme);
  document.body.classList.toggle('light-theme', !darkTheme);
}
document.addEventListener('DOMContentLoaded', init); 