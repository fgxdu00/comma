const ws = new WebSocket(`ws://${location.host}`);
let pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
});

const btnCall = document.getElementById('btnCall');
const btnAnswer = document.getElementById('btnAnswer');
const btnEnd = document.getElementById('btnEnd');
const btnDecline = document.getElementById('btnDecline');
const btnMute = document.getElementById('btnMute');
const btnApplyAudio = document.getElementById('btnApplyAudio');
const localVid = document.getElementById('localVideo');
const remoteVid = document.getElementById('remoteVideo');

const chkEcho = document.getElementById('chkEcho');
const chkNoise = document.getElementById('chkNoise');
const selSample = document.getElementById('selSample');

let isCaller = false;
let latestOffer = null;
let isMuted = false;

let audioConstraints = {
  echoCancellation: false,
  noiseSuppression: true,
  sampleRate: 48000,
  channelCount: 1,
};

function replaceAudioTrack(newStream) {
  const newAudioTrack = newStream.getAudioTracks()[0];
  const sender = pc
    .getSenders()
    .find((s) => s.track && s.track.kind === 'audio');
  if (sender) {
    sender.replaceTrack(newAudioTrack);
  }
}

function startMedia() {
  return navigator.mediaDevices
    .getUserMedia({
      audio: audioConstraints,
    })
    .then((stream) => {
      if (!stream) throw new Error('No media stream acquired');
      localVid.srcObject = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    })
    .catch((err) => console.error('getUserMedia failed:', err));
}

// Start initial media
startMedia();

// ICE handling
pc.onicecandidate = ({ candidate }) => {
  if (candidate) ws.send(JSON.stringify({ type: 'ice', candidate }));
};

pc.ontrack = (e) => {
  remoteVid.srcObject = e.streams[0];
};

// WebSocket message handling
ws.onmessage = async (event) => {
  const raw =
    typeof event.data === 'string' ? event.data : await event.data.text();
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    console.error('Invalid JSON from server:', raw);
    return;
  }

  console.log('Received:', msg.type);

  if (msg.type === 'offer') {
    latestOffer = msg.sdp;
    btnAnswer.disabled = false;
    btnDecline.disabled = false;
  } else if (msg.type === 'answer' && isCaller) {
    pc.setRemoteDescription(msg.sdp)
      .then(() => console.log('Caller: Remote description set (answer)'))
      .catch(console.error);
  } else if (msg.type === 'ice') {
    pc.addIceCandidate(msg.candidate)
      .then(() => console.log('Added ICE'))
      .catch(console.error);
  } else if (msg.type === 'end') {
    console.log('🛑 Remote ended the call');

    pc.close();

    if (localVid.srcObject) {
      localVid.srcObject.getTracks().forEach((track) => track.stop());
    }

    localVid.srcObject = null;
    remoteVid.srcObject = null;

    btnCall.disabled = false;
    btnAnswer.disabled = true;
    btnDecline.disabled = true;
    btnEnd.disabled = true;
    btnMute.disabled = true;

    location.reload();
  } else if (msg.type === 'decline') {
    console.log('🙅 Your call was declined.');

    btnCall.disabled = false;
    btnAnswer.disabled = true;
    btnDecline.disabled = true;
    btnEnd.disabled = true;
    btnMute.disabled = true;

    pc.close();

    if (localVid.srcObject) {
      localVid.srcObject.getTracks().forEach((track) => track.stop());
    }

    localVid.srcObject = null;
    remoteVid.srcObject = null;

    location.reload();
  }
};

chkEcho.checked = audioConstraints.echoCancellation;
chkNoise.checked = audioConstraints.noiseSuppression;
selSample.value = audioConstraints.sampleRate;

chkEcho.addEventListener('change', () => {
  audioConstraints.echoCancellation = chkEcho.checked;
});
chkNoise.addEventListener('change', () => {
  audioConstraints.noiseSuppression = chkNoise.checked;
});
selSample.addEventListener('change', () => {
  audioConstraints.sampleRate = parseInt(selSample.value);
});

// Button logic
btnCall.addEventListener('click', () => {
  isCaller = true;
  btnCall.disabled = true;
  btnEnd.disabled = false;
  btnMute.disabled = false;
  pc.createOffer()
    .then((offer) => pc.setLocalDescription(offer))
    .then(() => {
      ws.send(JSON.stringify({ type: 'offer', sdp: pc.localDescription }));
      console.log('Caller: Offer sent');
    })
    .catch(console.error);
});

btnAnswer.addEventListener('click', () => {
  if (!latestOffer) return;
  btnAnswer.disabled = true;
  btnDecline.disabled = true;
  btnEnd.disabled = false;
  btnMute.disabled = false;
  pc.setRemoteDescription(latestOffer)
    .then(() => pc.createAnswer())
    .then((answer) => pc.setLocalDescription(answer))
    .then(() => {
      ws.send(JSON.stringify({ type: 'answer', sdp: pc.localDescription }));
      console.log('Callee: Answer sent');
    })
    .catch(console.error);
});

btnEnd.addEventListener('click', () => {
  console.log('🔴 Ending call...');

  ws.send(JSON.stringify({ type: 'end' }));

  pc.close();

  if (localVid.srcObject) {
    localVid.srcObject.getTracks().forEach((track) => track.stop());
  }

  localVid.srcObject = null;
  remoteVid.srcObject = null;

  btnCall.disabled = false;
  btnAnswer.disabled = true;
  btnDecline.disabled = true;
  btnEnd.disabled = true;
  btnMute.disabled = true;

  location.reload();
});

btnDecline.addEventListener('click', () => {
  console.log('🙅 Declined the call');

  ws.send(JSON.stringify({ type: 'decline' }));

  btnAnswer.disabled = true;
  btnDecline.disabled = true;
});

// Mute button logic
btnMute.addEventListener('click', () => {
  if (!localVid.srcObject) return;
  const audioTracks = localVid.srcObject.getAudioTracks();
  if (audioTracks.length === 0) return;

  isMuted = !isMuted;
  audioTracks[0].enabled = !isMuted;

  btnMute.textContent = isMuted ? 'Unmute' : 'Mute';
  console.log(isMuted ? '🔇 Muted microphone' : '🎤 Unmuted microphone');
});

btnApplyAudio.addEventListener('click', () => {
  console.log('🎛 Reapplying audio settings...', audioConstraints);

  if (localVid.srcObject) {
    localVid.srcObject.getTracks().forEach((track) => track.stop());
  }

  navigator.mediaDevices
    .getUserMedia({
      audio: audioConstraints,
    })
    .then((newStream) => {
      localVid.srcObject = newStream;
      replaceAudioTrack(newStream);
      Pconsole.log('✅ Audio settings applied.');
    })
    .catch((err) => console.error('Error applying new audio settings:', err));
});
