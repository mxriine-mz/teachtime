'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('state:get'),
  addPoints: (kind, pts, ref) => ipcRenderer.invoke('points:add', { kind, pts, ref }),
  countToday: (ref) => ipcRenderer.invoke('points:countToday', ref),

  getItem: (key) => ipcRenderer.invoke('items:get', key),
  setItem: (key, value) => ipcRenderer.invoke('items:set', key, value),
  delItem: (key) => ipcRenderer.invoke('items:del', key),
  listItems: (prefix) => ipcRenderer.invoke('items:list', prefix),

  content: (name) => ipcRenderer.invoke('content:get', name),

  setup: (opts) => ipcRenderer.invoke('setup:done', opts),
  checkCode: (code) => ipcRenderer.invoke('code:check', code),
  emergencyUnlock: (code) => ipcRenderer.invoke('lock:emergency', code),
  updateSettings: (code, patch) => ipcRenderer.invoke('settings:update', { code, patch }),
  setVoice: (voice) => ipcRenderer.invoke('settings:voice', voice),
  setBlockerColors: (colors) => ipcRenderer.invoke('appearance:blocker', colors),

  sttStatus: () => ipcRenderer.invoke('stt:status'),
  sttWarmup: () => ipcRenderer.invoke('stt:warmup'),
  transcribe: (samples) => ipcRenderer.invoke('stt:transcribe', samples),

  voiceStatus: () => ipcRenderer.invoke('voice:status'),
  voiceWarmup: () => ipcRenderer.invoke('voice:warmup'),
  voiceSpeak: (text, id, speed) => ipcRenderer.invoke('voice:speak', text, id, speed),

  cloudStatus: () => ipcRenderer.invoke('cloud:status'),
  cloudConnect: (p) => ipcRenderer.invoke('cloud:connect', p),
  cloudGoogle: () => ipcRenderer.invoke('cloud:google'),
  cloudLogout: () => ipcRenderer.invoke('cloud:logout'),
  cloudSync: () => ipcRenderer.invoke('cloud:sync'),
  cloudLink: (webUrl) => ipcRenderer.invoke('cloud:link', webUrl),

  hide: () => ipcRenderer.invoke('app:hide'),

  onState: (cb) => {
    const h = (_e, s) => cb(s);
    ipcRenderer.on('state', h);
    return () => ipcRenderer.removeListener('state', h);
  },
});
