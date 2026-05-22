import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { socket, connectSocket } from '../socket';
import { Users, Play, Copy, Check } from 'lucide-react';

export const Lobby: React.FC = () => {
  const { playerName, setPlayerName, avatar, setAvatar, room, roomCode, setRoomCode } = useStore();
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [boards, setBoards] = useState<{ id: number, versionName: string }[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<number | ''>('');

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || window.location.origin}/api/boards`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBoards(data);
          if (data.length > 0) setSelectedBoardId(data[0].id);
        }
      })
      .catch(console.error);

    // Auto-reconnect if we have a roomCode and playerId saved
    const state = useStore.getState();
    if (state.roomCode && state.playerId && state.playerName) {
      connectSocket();
      socket.emit('join_room', { code: state.roomCode, name: state.playerName, avatar: state.avatar, playerId: state.playerId }, (res) => {
        if (!res.success) {
          // If room doesn't exist or game ended, clear the saved roomCode
          useStore.getState().setRoomCode('');
          setError('Previous session could not be restored.');
        }
      });
    }
  }, []);

  const handleCreateRoom = () => {
    if (!playerName) {
      setError('Please enter a name');
      return;
    }
    connectSocket();
    let idToUse = useStore.getState().playerId;
    if (!idToUse) {
      idToUse = crypto.randomUUID();
      useStore.getState().setPlayerId(idToUse);
    }
    socket.emit('create_room', { name: playerName, avatar, boardId: selectedBoardId || undefined, playerId: idToUse }, (res) => {
      setRoomCode(res.code);
    });
  };

  const handleJoinRoom = () => {
    if (!playerName || !joinCode) {
      setError('Name and Room Code are required');
      return;
    }
    connectSocket();
    let idToUse = useStore.getState().playerId;
    if (!idToUse) {
      idToUse = crypto.randomUUID();
      useStore.getState().setPlayerId(idToUse);
    }
    socket.emit('join_room', { code: joinCode.toUpperCase(), name: playerName, avatar, playerId: idToUse }, (res) => {
      if (res.success && res.playerId) {
        setRoomCode(joinCode.toUpperCase());
        useStore.getState().setPlayerId(res.playerId);
      } else {
        setError(res.message || 'Failed to join');
      }
    });
  };

  const copyToClipboard = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartGame = () => {
    if (roomCode) {
      socket.emit('start_game', { code: roomCode });
    }
  };

  if (room && roomCode) {
    const isHost = room.hostPlayerId === useStore.getState().playerId;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="glassmorphism rounded-2xl p-8 w-full max-w-md text-center">
          <h2 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Lobby</h2>
          
          <div className="bg-slate-800/50 rounded-lg p-4 mb-6 flex items-center justify-between">
            <span className="text-slate-300">Room Code:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-bold tracking-widest text-white">{roomCode}</span>
              <button onClick={copyToClipboard} className="p-2 hover:bg-slate-700 rounded-md transition">
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
              </button>
            </div>
          </div>

          <div className="text-left mb-6">
            <h3 className="text-sm uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> Players ({room.players.length}/4)
            </h3>
            <div className="space-y-2">
              {room.players.map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-slate-800/30 p-3 rounded-lg">
                  <span className="text-2xl">{p.avatar}</span>
                  <span className="font-medium text-slate-200">{p.name} {p.id === room.hostPlayerId && '(Host)'}</span>
                </div>
              ))}
            </div>
          </div>

          {isHost ? (
            <button 
              onClick={handleStartGame}
              disabled={room.players.length < 2}
              className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(59,130,246,0.5)] bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 disabled:opacity-50 disabled:shadow-none"
            >
              <Play className="w-5 h-5" /> Start Game
            </button>
          ) : (
            <div className="text-slate-400 italic">Waiting for host to start...</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0f172a] to-slate-950">
      <div className="glassmorphism rounded-3xl p-10 w-full max-w-md">
        <h1 className="text-5xl font-black mb-8 text-center text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 drop-shadow-sm">
          TURNLESS<br/>MONOPOLY
        </h1>

        {error && <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm">{error}</div>}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Your Name</label>
            <input 
              type="text" 
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="Enter name..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Avatar</label>
            <div className="flex gap-2">
              {['🚗', '🎩', '🐕', '🚢', '🦖'].map(a => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={`text-2xl p-3 rounded-xl transition-all ${avatar === a ? 'bg-blue-500/30 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-slate-800/50 border-transparent hover:bg-slate-700'} border`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 space-y-4">
            {boards.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Select Board</label>
                <select
                  value={selectedBoardId}
                  onChange={(e) => setSelectedBoardId(Number(e.target.value))}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  {boards.map(b => (
                    <option key={b.id} value={b.id}>{b.versionName}</option>
                  ))}
                </select>
              </div>
            )}
            
            <button 
              onClick={handleCreateRoom}
              className="w-full py-3.5 rounded-xl font-bold bg-white text-slate-900 hover:bg-slate-200 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              Create New Room
            </button>
            
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-700"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-sm">or join existing</span>
              <div className="flex-grow border-t border-slate-700"></div>
            </div>

            <div className="flex gap-2">
              <input 
                type="text" 
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                maxLength={4}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase"
              />
              <button 
                onClick={handleJoinRoom}
                className="px-6 py-3 rounded-xl font-bold bg-slate-700 text-white hover:bg-slate-600 transition-all border border-slate-600"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
