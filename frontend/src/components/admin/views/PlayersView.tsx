import React from 'react';
import type { PlayerDetail, PlayerSummary } from '../types';
import { formatCountdown, statusTone } from '../utils';

type Props = {
  players: PlayerSummary[];
  selectedPlayerId: string | null;
  setSelectedPlayerId: (id: string | null) => void;
  selectedPlayer: PlayerDetail | null;
  canManageBalances: boolean;
  canManageCooldowns: boolean;
  canKickPlayers: boolean;
  runPlayerAction: (action: 'kick' | 'reset-cooldown' | 'release-jail' | 'bankrupt' | 'balance') => Promise<void>;
};

export const PlayersView: React.FC<Props> = ({
  players,
  selectedPlayerId,
  setSelectedPlayerId,
  selectedPlayer,
  canManageBalances,
  canManageCooldowns,
  canKickPlayers,
  runPlayerAction,
}) => {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[30px] border border-slate-800 bg-slate-950/70 p-6">
        <h2 className="text-xl font-bold text-white">Player Surface</h2>
        <div className="mt-5 space-y-3">
          {players.map((player) => (
            <button key={player.id} onClick={() => setSelectedPlayerId(player.id)} className={`block w-full rounded-3xl border bg-slate-900/70 p-4 text-left ${selectedPlayerId === player.id ? 'border-cyan-500/40' : 'border-slate-800'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">{player.avatar} {player.name}</div>
                  <div className="mt-1 text-sm text-slate-400">ID {player.id} • Room {player.roomCode}</div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusTone(player.status)}`}>{player.status}</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Balance</div><div className="mt-1 font-semibold text-slate-100">${player.balance}</div></div>
                <div><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Properties</div><div className="mt-1 font-semibold text-slate-100">{player.properties}</div></div>
                <div><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Connection</div><div className="mt-1 font-semibold text-slate-100">{player.isConnected ? 'Online' : 'Offline'}</div></div>
                <div><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Debt Window</div><div className="mt-1 font-semibold text-amber-200">{formatCountdown(player.debtDeadline)}</div></div>
              </div>
            </button>
          ))}
          {players.length === 0 && <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">No players found.</div>}
        </div>
      </div>
      <div className="rounded-[30px] border border-slate-800 bg-slate-950/70 p-6">
        <h2 className="text-xl font-bold text-white">Player Detail</h2>
        {selectedPlayer ? (
          <>
            <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">{selectedPlayer.avatar} {selectedPlayer.name}</div>
                  <div className="mt-1 text-sm text-slate-400">Room {selectedPlayer.roomCode} • Position {selectedPlayer.position}</div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusTone(selectedPlayer.status)}`}>{selectedPlayer.status}</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300">Balance: <span className="font-semibold text-white">${selectedPlayer.balance}</span></div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300">Cooldown: <span className="font-semibold text-white">{formatCountdown(selectedPlayer.cooldownUntil)}</span></div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300">Debt Window: <span className="font-semibold text-amber-200">{formatCountdown(selectedPlayer.debtDeadline)}</span></div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300">Assets: <span className="font-semibold text-white">{selectedPlayer.ownedTiles.length}</span></div>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {canManageBalances && <button onClick={() => runPlayerAction('balance')} className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-left text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20">Adjust balance</button>}
              {canManageCooldowns && <button onClick={() => runPlayerAction('release-jail')} className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-left text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20">Release from jail</button>}
              {canManageCooldowns && <button onClick={() => runPlayerAction('reset-cooldown')} className="rounded-2xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-left text-sm font-semibold text-slate-100 transition hover:border-slate-500">Reset cooldown</button>}
              {canManageBalances && <button onClick={() => runPlayerAction('bankrupt')} className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20">Force bankrupt</button>}
              {canKickPlayers && <button onClick={() => runPlayerAction('kick')} className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-left text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20">Kick from room</button>}
              {!canKickPlayers && !canManageCooldowns && !canManageBalances && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-500">
                  Your role is read-only for player interventions.
                </div>
              )}
            </div>

            <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="font-semibold text-white">Recent Events</div>
              <div className="mt-3 space-y-2">
                {selectedPlayer.recentEvents.slice(0, 8).map((event) => (
                  <div key={event} className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">{event}</div>
                ))}
                {selectedPlayer.recentEvents.length === 0 && <div className="text-sm text-slate-500">No recent events.</div>}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">Select a player to inspect and act on.</div>
        )}
      </div>
    </div>
  );
};
