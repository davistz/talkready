const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (fn) => ipcRenderer.on(channel, (_e, v) => fn(v));

contextBridge.exposeInMainWorld('api', {
  hasKey: () => ipcRenderer.invoke('key:has'),
  setKey: (key) => ipcRenderer.invoke('key:set', key),
  ai: (kind, payload) => ipcRenderer.invoke('ai', kind, payload),
  speechReady: () => ipcRenderer.invoke('speech:ready'),
  transcribe: (pcm, lang) => ipcRenderer.invoke('speech:transcribe', pcm, lang),
  speak: (text, voice, speed) => ipcRenderer.invoke('speech:speak', text, voice, speed),
  onSpeechProgress: on('speech:progress'),
  dailyAudio: (cards) => ipcRenderer.invoke('audio:daily', cards),
  onAudioProgress: on('audio:progress'),
  saveFile: (name, data) => ipcRenderer.invoke('files:save', name, data),
  readFile: (name) => ipcRenderer.invoke('files:read', name),
  setReminder: (time) => ipcRenderer.invoke('reminder:set', time)
});
