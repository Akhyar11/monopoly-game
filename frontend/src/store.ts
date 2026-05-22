import { create } from 'zustand';
import type { Room } from './types';

export interface AppState {
  playerId: string | null;
  playerName: string;
  avatar: string;
  roomCode: string | null;
  room: Room | null;
  eventLogs: string[];
  setPlayerId: (id: string) => void;
  setPlayerName: (name: string) => void;
  setAvatar: (avatar: string) => void;
  setRoomCode: (code: string) => void;
  setRoom: (room: Room) => void;
  addEventLog: (log: string) => void;
  diceRoll: { playerId: string, roll: number, dice1: number, dice2: number } | null;
  setDiceRoll: (roll: { playerId: string, roll: number, dice1: number, dice2: number } | null) => void;
}

import { persist } from 'zustand/middleware';

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      playerId: null,
      playerName: '',
      avatar: '🚗',
      roomCode: null,
      room: null,
      eventLogs: [],
      setPlayerId: (id) => set({ playerId: id }),
      setPlayerName: (name) => set({ playerName: name }),
      setAvatar: (avatar) => set({ avatar }),
      setRoomCode: (code) => set({ roomCode: code }),
      setRoom: (room) => set({ room }),
      addEventLog: (log) => set((state) => ({ eventLogs: [log, ...state.eventLogs].slice(0, 50) })),
      diceRoll: null,
      setDiceRoll: (roll) => set({ diceRoll: roll })
    }),
    {
      name: 'monopoly-storage',
      partialize: (state) => ({ 
        playerId: state.playerId, 
        playerName: state.playerName, 
        avatar: state.avatar, 
        roomCode: state.roomCode 
      }),
    }
  )
);
