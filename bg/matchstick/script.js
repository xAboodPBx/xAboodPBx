const match = document.getElementById('match');
const instruction = document.getElementById('instruction');

let lastTime = 0;
let lastX = 0;
let lastY = 0;
let isLit = false;
let heat = 0;
let lastStrikeSoundTime = 0;
let resetTimeout = null;

// Config
const MIN_SPEED_THRESHOLD = 0.5; // px per ms
const IGNITION_HEAT = 30;

// --- Web Audio API Engine ---
let audioCtx;
let fireNoiseSource;
let fireGainNode;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playStrikeSound(intensity) {
  initAudio();
  if (!audioCtx) return;

  const bufferSize = audioCtx.sampleRate * 0.05; 
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 800 + (Math.min(intensity, 5) * 400); 

  const gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04);

  noiseSource.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  noiseSource.start();
}

function playIgniteSound() {
  initAudio();
  if (!audioCtx) return;
  
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.5);
  
  const oscGain = audioCtx.createGain();
  oscGain.gain.setValueAtTime(1, audioCtx.currentTime);
  oscGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
  
  osc.connect(oscGain);
  oscGain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.5);

  const bufferSize = audioCtx.sampleRate * 2; 
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1; 
  }

  fireNoiseSource = audioCtx.createBufferSource();
  fireNoiseSource.buffer = buffer;
  fireNoiseSource.loop = true;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300; 

  fireGainNode = audioCtx.createGain();
  fireGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  fireGainNode.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 1); 

  fireNoiseSource.connect(filter);
  filter.connect(fireGainNode);
  fireGainNode.connect(audioCtx.destination);

  fireNoiseSource.start();
}

function playHissSound() {
  initAudio();
  if (!audioCtx) return;
  
  const bufferSize = audioCtx.sampleRate * 0.3; 
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1; 
  }

  const noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2000; // high pitch hiss for smoke

  const gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

  noiseSource.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  noiseSource.start();
}

function stopFireSound() {
  if (fireNoiseSource && fireGainNode) {
    fireGainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
    setTimeout(() => {
      if (fireNoiseSource) {
        fireNoiseSource.stop();
        fireNoiseSource = null;
      }
    }, 300);
  }
}
// -----------------------------

function getEventPos(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function handleMove(e) {
  if (isLit) return;
  
  if (e.type === 'touchmove') {
    e.preventDefault();
  }

  // If user starts swiping while it's "extinguished", reset it immediately
  if (document.body.classList.contains('extinguished')) {
    document.body.classList.remove('extinguished');
    clearTimeout(resetTimeout);
  }

  const pos = getEventPos(e);
  const currentTime = Date.now();
  
  if (lastTime !== 0) {
    const deltaTime = currentTime - lastTime;
    
    if (deltaTime > 0) {
      const dx = pos.x - lastX;
      const dy = pos.y - lastY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const speed = distance / deltaTime;
      
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const isOverMatch = Math.abs(pos.x - centerX) < 150 && Math.abs(pos.y - centerY) < 250;
      
      if (isOverMatch && speed > MIN_SPEED_THRESHOLD) {
        heat += speed;
        
        if (currentTime - lastStrikeSoundTime > 80) {
          playStrikeSound(speed);
          lastStrikeSoundTime = currentTime;
        }

        const shakeX = (Math.random() - 0.5) * Math.min(speed * 2, 10);
        match.style.transform = `translateX(${shakeX}px) rotate(${shakeX / 2}deg)`;
        
        if (heat > IGNITION_HEAT) {
          ignite();
        }
      } else {
        heat = Math.max(0, heat - 2);
        if (heat === 0) {
           match.style.transform = `translate(0px) rotate(0deg)`;
        }
      }
    }
  }
  
  lastX = pos.x;
  lastY = pos.y;
  lastTime = currentTime;
}

function ignite() {
  isLit = true;
  document.body.classList.remove('extinguished');
  document.body.classList.add('lit');
  match.style.transform = `translate(0px) rotate(0deg)`;
  instruction.innerText = "Click to extinguish";
  
  playIgniteSound();
  
  setTimeout(() => {
    instruction.style.opacity = '0.5';
  }, 2000);
}

document.addEventListener('mousemove', handleMove);
document.addEventListener('touchmove', handleMove, { passive: false });

document.body.addEventListener('click', () => {
  initAudio(); 
  
  if (isLit) {
    isLit = false;
    heat = 0;
    
    // Extinguish the match!
    document.body.classList.remove('lit');
    document.body.classList.add('extinguished');
    
    instruction.style.opacity = '1';
    instruction.innerText = "Swipe fast to strike";
    
    stopFireSound();
    playHissSound(); // Play the little "tsss" smoke sound
    
    // Fully reset match visuals after smoke clears
    clearTimeout(resetTimeout);
    resetTimeout = setTimeout(() => {
      if (document.body.classList.contains('extinguished')) {
        document.body.classList.remove('extinguished');
      }
    }, 4000);
  }
});