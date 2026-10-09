// Screen recording (MediaRecorder) of the live view, with the UI hidden.
import { state } from '../core/state.js';
import { globalGui } from './gui.js';

// --- Cinematic Recording Tool ---
let mediaRecorder;
let recordedChunks = [];
let recordingInterval;
let startTime;

const btnRecord = document.getElementById('btn-record');
const btnStop = document.getElementById('btn-stop');
const recTime = document.getElementById('recording-time');
export const uiContainer = document.getElementById('ui-container');
const recordingPanel = document.getElementById('recording-panel');
const btnToggleRec = document.getElementById('btn-toggle-rec');
const recQuality = document.getElementById('rec-quality');

if (btnToggleRec && recordingPanel) {
  btnToggleRec.addEventListener('click', () => {
    recordingPanel.classList.toggle('hidden');
  });
}

// Elements hidden during recording (everything except recording-container)
const _recHideEls = ['panel-toggle','scene-toggle','layers-toggle','style-toggle','mobility-toggle','furniture-toggle','analysis-toggle','narrative-toggle','advanced-toggle','walk-toggle','game-toggle','main-panel','layer-dock','scene-dock','style-dock','mobility-dock','furniture-dock','analysis-dock','narrative-dock'];

function _recHideUi() {
  _recHideEls.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.visibility = 'hidden';
  });
  if (globalGui) globalGui.domElement.style.visibility = 'hidden';
}
function _recShowUi() {
  _recHideEls.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.visibility = '';
  });
  if (globalGui) globalGui.domElement.style.visibility = '';
}

export function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  state.isRecording = false;
  mediaRecorder.stop();
  clearInterval(recordingInterval);
  _recShowUi();
  if (btnRecord) btnRecord.style.display = 'inline-block';
  if (btnStop)   btnStop.style.display   = 'none';
  if (recTime)   recTime.style.display   = 'none';
  if (recordingPanel) {
    recordingPanel.style.removeProperty('background');
    recordingPanel.style.removeProperty('border');
  }
  if (btnToggleRec) btnToggleRec.classList.remove('recording');
}

if (btnRecord && btnStop) {
  btnRecord.addEventListener('click', () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    // Hide non-recording UI, keep recording-container visible
    state.isRecording = true;
    _recHideUi();
    recordingPanel.classList.remove('hidden'); // ensure panel is open

    // Switch record ↔ stop buttons
    btnRecord.style.display = 'none';
    btnStop.style.display = 'inline-block';
    recTime.style.display = 'inline-block';
    btnToggleRec.classList.add('recording');

    // Start timer
    startTime = Date.now();
    recTime.innerText = '00:00';
    recordingInterval = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const m = String(Math.floor(diff / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      recTime.innerText = `${m}:${s}`;
    }, 1000);

    // Setup recorder
    const stream = canvas.captureStream(30);
    const bps = recQuality ? parseInt(recQuality.value, 10) : 5000000;
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm',
      videoBitsPerSecond: bps
    });
    recordedChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      state.isRecording = false;
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `planx_3d_city_${Date.now()}.webm`;
      document.body.appendChild(a); a.click();
      URL.revokeObjectURL(url); a.remove();
    };
    mediaRecorder.start();
  });

  btnStop.addEventListener('click', stopRecording);
}
