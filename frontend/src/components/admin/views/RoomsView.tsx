import React from 'react';
import type { RoomDetail, RoomSummary } from '../types';
import { formatCountdown, formatDateTime, statusTone } from '../utils';

type Props = {
  rooms: RoomSummary[];
  selectedRoomSummary: RoomSummary | null;
  setSelectedRoomCode: (code: string | null) => void;
  selectedRoom: RoomDetail | null;
  canManageRooms: boolean;
  handleBroadcast: () => Promise<void>;
  handleForceEnd: () => Promise<void>;
};

export const RoomsView: React.FC<Props> = ({
  rooms,
  selectedRoomSummary,
  setSelectedRoomCode,
  selectedRoom,
  canManageRooms,
  handleBroadcast,
  handleForceEnd,
}) => {
  return (
    <div className="rounded-[30px] border border-slate-800 bg-slate-950/70 p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Room List</h2>
          <p className="text-sm text-slate-400">Live room overview with intervention-ready summaries.</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-3xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-left">
          <thead className="bg-slate-900/80 text-xs uppercase tracking-[0.2em] text-slate-500">
            <tr>
              <th className="px-5 py-4">Code</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Players</th>
              <th className="px-5 py-4">Debt / Auction</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40">
            {rooms.map((entry) => (
              <tr key={entry.code}>
                <td className="px-5 py-4 font-semibold text-white">{entry.code}</td>
                <td className="px-5 py-4">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusTone(entry.status)}`}>{entry.status}</span>
                </td>
                <td className="px-5 py-4 text-slate-300">{entry.playerCount}</td>
                <td className="px-5 py-4">
                  <div className="text-xs text-slate-400">
                    Debt: <span className="font-semibold text-amber-200">{entry.debtCases}</span> • Auction: <span className="font-semibold text-white">{entry.hasAuction ? 'Yes' : 'No'}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <button onClick={() => setSelectedRoomCode(selectedRoomSummary?.code === entry.code ? null : entry.code)} className="rounded-xl bg-slate-900 px-3 py-1 text-sm font-semibold text-cyan-200 hover:bg-slate-800">
                    {selectedRoomSummary?.code === entry.code ? 'Hide' : 'Inspect'}
                  </button>
                </td>
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                  No rooms active.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {selectedRoom && (
        <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="text-lg font-bold text-white">Room Snapshot: {selectedRoom.code}</h3>
            <div className="mt-2 text-sm text-slate-400">Started {formatDateTime(selectedRoom.gameStartedAt)} • Trades {selectedRoom.tradeOffers.length} • Auction {selectedRoom.auction ? 'active' : 'none'}</div>
            <div className="mt-4 space-y-3">
              {selectedRoom.players.map((player) => (
                <div key={player.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                  <div>
                    <div className="font-semibold text-white">{player.avatar} {player.name}</div>
                    <div className="text-sm text-slate-400">Balance ${player.balance} • Properties {player.properties.length}</div>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusTone(player.status)}`}>{player.status}</span>
                    <div className="mt-2 text-xs text-slate-500">Debt window {formatCountdown(player.debtDeadline)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="text-lg font-bold text-white">Room Actions</h3>
            <div className="mt-4 grid gap-3">
              {canManageRooms && (
                <button onClick={handleBroadcast} className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-left text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20">
                  Broadcast maintenance notice
                </button>
              )}
              {canManageRooms && (
                <button onClick={handleForceEnd} className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-left text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20">
                  Force end current match
                </button>
              )}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-400">
                Event log entries: {selectedRoom.eventLog.length}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-400">
                Auction state: {selectedRoom.auction ? `Bid $${selectedRoom.auction.currentBid}` : 'No active auction'}
              </div>
              {!canManageRooms && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-500">
                  Your role is read-only for room interventions.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
