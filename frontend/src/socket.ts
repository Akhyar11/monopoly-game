import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from './types';
import { useStore } from './store';

const URL = import.meta.env.VITE_API_URL || window.location.origin;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(URL, {
  autoConnect: false,
});

export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

const audioCache: Record<string, HTMLAudioElement> = {};

const preloadSfx = (sfx: Record<string, string>) => {
  Object.values(sfx).forEach(url => {
    if (url && !audioCache[url]) {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audioCache[url] = audio;
    }
  });
};

const playSfxFromCache = (url: string) => {
  if (!url) return;
  const audio = audioCache[url] || new Audio(url);
  const clone = audio.cloneNode() as HTMLAudioElement;
  clone.volume = 0.5; // Optional: default volume
  clone.play().catch(e => console.warn('SFX play failed', e));
};

socket.on('room_state_updated', (room) => {
  useStore.getState().setRoom(room);
  if (room.sfx) {
    preloadSfx(room.sfx);
  }
});

socket.on('dice_rolled', (data) => {
  useStore.getState().setDiceRoll(data);
  const room = useStore.getState().room;
  if (room?.sfx?.rollDice) {
    playSfxFromCache(room.sfx.rollDice);
  }
  setTimeout(() => {
    useStore.getState().setDiceRoll(null);
  }, 3000); // clear after 3 seconds
});

socket.on('play_sfx', (sfxKey) => {
  const room = useStore.getState().room;
  const url = room?.sfx?.[sfxKey];
  if (url) {
    playSfxFromCache(url);
  }
});

socket.on('error_message', (message) => {
  alert(message); // Simple alert for MVP, can use toast
});
