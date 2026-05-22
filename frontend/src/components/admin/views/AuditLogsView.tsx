import React, { useState } from 'react';
import type { AuditLog } from '../types';
import { formatDateTime, formatJsonValue, getChangedFields } from '../utils';

type Props = {
  auditLogs: AuditLog[];
};

export const AuditLogsView: React.FC<Props> = ({ auditLogs }) => {
  const [expandedAuditLogIds, setExpandedAuditLogIds] = useState<Set<string>>(new Set());

  const toggleAuditExpand = (id: string) => {
    const newExpanded = new Set(expandedAuditLogIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedAuditLogIds(newExpanded);
  };

  return (
    <div className="rounded-[30px] border border-slate-800 bg-slate-950/70 p-6">
      <h2 className="text-xl font-bold text-white">Audit Trail</h2>
      <p className="mt-1 text-sm text-slate-400">Latest admin interventions captured by the backend in-memory audit log. Click an entry to view before/after details.</p>
      <div className="mt-5 space-y-2">
        {auditLogs.map((entry) => {
          const isExpanded = expandedAuditLogIds.has(entry.id);
          const changes = getChangedFields(entry.before, entry.after);

          return (
            <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-900/50">
              <button
                onClick={() => toggleAuditExpand(entry.id)}
                className="w-full px-5 py-4 text-left hover:bg-slate-900/70 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="text-xl text-slate-500">
                    {isExpanded ? '▼' : '▶'}
                  </div>
                  <div className="flex-1 grid gap-2 md:grid-cols-4 md:gap-4">
                    <div className="text-sm text-slate-300">{formatDateTime(entry.timestamp)}</div>
                    <div className="text-sm text-slate-100">{entry.adminId} <span className="text-slate-500 text-xs">({entry.role})</span></div>
                    <div className="text-sm text-cyan-200">{entry.action}</div>
                    <div className="text-sm text-slate-400">{entry.targetType}:{entry.targetId}</div>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-800 px-5 py-4 bg-slate-950/70">
                  {changes.length > 0 ? (
                    <div className="space-y-3">
                      <div className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Changes ({changes.length})</div>
                      {changes.map((change) => (
                        <div key={change.key} className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 space-y-2">
                          <div className="font-mono text-xs text-slate-300">{change.key}</div>
                          <div className="grid md:grid-cols-2 gap-3">
                            <div className="text-xs">
                              <div className="text-slate-500 mb-1">Before:</div>
                              <div className="font-mono text-slate-300 bg-slate-950/80 rounded px-2 py-1 overflow-auto max-h-24 text-[0.7rem] whitespace-pre-wrap">
                                {formatJsonValue(change.from)}
                              </div>
                            </div>
                            <div className="text-xs">
                              <div className="text-slate-500 mb-1">After:</div>
                              <div className="font-mono text-slate-300 bg-slate-950/80 rounded px-2 py-1 overflow-auto max-h-24 text-[0.7rem] whitespace-pre-wrap">
                                {formatJsonValue(change.to)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">No before/after data captured for this action.</div>
                  )}

                  {!entry.before && !entry.after && (
                    <div className="text-xs text-slate-500 italic">This audit entry does not have before/after details.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {auditLogs.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">No audit logs found.</div>
        )}
      </div>
    </div>
  );
};
