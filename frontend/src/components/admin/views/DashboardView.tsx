import React from 'react';
import { Bell } from 'lucide-react';
import type { DashboardSummary, RoomSummary, AdminRoute, AuditLog } from '../types';
import { formatDuration, navigate, statusTone } from '../utils';

type Props = {
  summary: DashboardSummary | null;
  rooms: RoomSummary[];
  auditLogs: AuditLog[];
  setPath: (path: AdminRoute) => void;
};

export const DashboardView: React.FC<Props> = ({ summary, rooms, auditLogs, setPath }) => {
  const cards = [
    { label: 'Active Rooms', value: summary?.activeRooms ?? 0, note: 'Rooms still accepting or running matches' },
    { label: 'Online Players', value: summary?.onlinePlayers ?? 0, note: 'Connected players from backend state' },
    { label: 'Live Matches', value: summary?.liveMatches ?? 0, note: 'Currently consuming server game state' },
    { label: 'Debt Cases', value: summary?.debtCases ?? 0, note: 'Players locked into rescue flow' },
    { label: 'Active Trades', value: summary?.activeTrades ?? 0, note: 'Open offers waiting for response' },
    { label: 'Auctions Running', value: summary?.activeAuctions ?? 0, note: 'Conflicts requiring live adjudication' },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-[28px] border border-slate-800 bg-[linear-gradient(160deg,rgba(15,23,42,0.96),rgba(20,33,61,0.88))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{card.label}</div>
            <div className="mt-3 text-4xl font-black text-white">{card.value}</div>
            <div className="mt-2 text-sm text-slate-400">{card.note}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[30px] border border-slate-800 bg-slate-950/70 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Critical Rooms</h2>
              <p className="text-sm text-slate-400">Top rooms with debt, auction, or active match pressure.</p>
            </div>
            <button
              onClick={() => navigate('/admin/rooms', setPath)}
              className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200"
            >
              Open Room Monitor
            </button>
          </div>
          <div className="space-y-3">
            {rooms.slice(0, 4).map((entry) => (
              <div key={entry.code} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-[1.2fr_0.6fr_0.6fr_0.8fr]">
                <div>
                  <div className="text-lg font-bold text-white">{entry.code}</div>
                  <div className="text-sm text-slate-400">Host: {entry.hostName}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Players</div>
                  <div className="mt-1 font-semibold text-slate-100">{entry.playerCount}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Debt</div>
                  <div className="mt-1 font-semibold text-amber-200">{entry.debtCases}</div>
                </div>
                <div className="flex items-center justify-start md:justify-end">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusTone(entry.status)}`}>
                    {entry.status}
                  </span>
                </div>
              </div>
            ))}
            {rooms.length === 0 && <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">No rooms found.</div>}
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-800 bg-[radial-gradient(circle_at_top,#1e293b_0%,#020617_80%)] p-6">
          <div className="mb-4 flex items-center gap-3">
            <Bell className="h-5 w-5 text-amber-300" />
            <h2 className="text-xl font-bold text-white">System Notes</h2>
          </div>
          <div className="space-y-3">
            {[
              `Average match duration: ${formatDuration(summary?.averageMatchDurationMs ?? 0)}`,
              `Ended matches today: ${summary?.endedMatchesToday ?? 0}`,
              `Latest audit entries: ${auditLogs.length}`,
            ].map((message) => (
              <div key={message} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                {message}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
