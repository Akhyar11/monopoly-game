import React from 'react';
import type { GameConfigResponse, GameConfigValue } from '../types';
import { formatDateTime } from '../utils';

type Props = {
  configData: GameConfigResponse | null;
  configDraft: GameConfigValue | null;
  canManageBalances: boolean;
  updateConfigNumber: (key: keyof Omit<GameConfigValue, 'featureFlags' | 'sfx'>, value: string) => void;
  updateConfigFlag: (key: keyof GameConfigValue['featureFlags'], checked: boolean) => void;
  updateConfigSfx: (key: keyof NonNullable<GameConfigValue['sfx']>, value: string) => void;
  handleUploadAudio: (file: File) => Promise<string | null>;
  handleSaveConfig: () => void;
  refreshConfig: () => Promise<void>;
  renderLoading: () => React.ReactNode;
};

export const EconomyView: React.FC<Props> = ({
  configData,
  configDraft,
  canManageBalances,
  updateConfigNumber,
  updateConfigFlag,
  updateConfigSfx,
  handleUploadAudio,
  handleSaveConfig,
  refreshConfig,
  renderLoading,
}) => {
  if (!configDraft || !configData) return <>{renderLoading()}</>;

  const numericFields: Array<{ key: keyof Omit<GameConfigValue, 'featureFlags' | 'sfx'>; label: string; note: string }> = [
    { key: 'initialBalance', label: 'Initial Balance', note: 'Starting cash per player.' },
    { key: 'passGoReward', label: 'Pass GO Reward', note: 'Cash reward when crossing GO.' },
    { key: 'cooldownMs', label: 'Cooldown (ms)', note: 'Delay after completing a turn.' },
    { key: 'propertyDecisionMs', label: 'Property Decision (ms)', note: 'Buy/skip timeout on unowned tiles.' },
    { key: 'debtDecisionMs', label: 'Debt Window (ms)', note: 'Rescue window before bankruptcy.' },
    { key: 'tradeExpiryMs', label: 'Trade Expiry (ms)', note: 'Outgoing trade lifetime.' },
    { key: 'jailFee', label: 'Jail Fee', note: 'Cost to leave jail immediately.' },
  ];

  const featureFields: Array<{ key: keyof GameConfigValue['featureFlags']; label: string; note: string }> = [
    { key: 'auction', label: 'Auction', note: 'Allow contested property auctions.' },
    { key: 'trade', label: 'Trade', note: 'Allow player-to-player barter.' },
    { key: 'mortgage', label: 'Mortgage', note: 'Allow rescue financing via bank.' },
    { key: 'housesHotels', label: 'Houses / Hotels', note: 'Allow building upgrades on full color sets.' },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-slate-800 bg-slate-950/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Global Economy Config</h2>
            <p className="mt-1 text-sm text-slate-400">This data is loaded from MySQL and applied by the backend runtime cache.</p>
          </div>
          <div className="text-sm text-slate-400">
            Updated by <span className="font-semibold text-white">{configData.updatedBy}</span> at {formatDateTime(configData.updatedAt)}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {numericFields.map((field) => (
            <label key={field.key} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="text-sm font-semibold text-white">{field.label}</div>
              <div className="mt-1 text-xs text-slate-500">{field.note}</div>
              <input
                type="number"
                value={configDraft[field.key]}
                disabled={!canManageBalances}
                onChange={(event) => updateConfigNumber(field.key, event.target.value)}
                className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featureFields.map((field) => (
            <label key={field.key} className="flex items-start gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
              <input
                type="checkbox"
                checked={configDraft.featureFlags[field.key]}
                disabled={!canManageBalances}
                onChange={(event) => updateConfigFlag(field.key, event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950"
              />
              <div>
                <div className="text-sm font-semibold text-white">{field.label}</div>
                <div className="mt-1 text-xs text-slate-500">{field.note}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-8 border-t border-slate-800 pt-8">
          <h3 className="text-lg font-bold text-white">Sound Effects (SFX)</h3>
          <p className="mt-1 text-sm text-slate-400">Configure audio URLs for game events. You can upload an audio file directly or paste an external URL.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(
              [
                { key: 'rollDice', label: 'Roll Dice', note: 'Sound when dice is rolled.' },
                { key: 'buyProperty', label: 'Buy Property', note: 'Sound when buying a property/building.' },
                { key: 'payRent', label: 'Pay Rent', note: 'Sound when paying rent.' },
                { key: 'bankrupt', label: 'Bankrupt', note: 'Sound when a player goes bankrupt.' },
                { key: 'jail', label: 'Jail', note: 'Sound when sent to jail.' },
                { key: 'cardDrawn', label: 'Card Drawn', note: 'Sound when drawing a card.' },
                { key: 'passGo', label: 'Pass GO', note: 'Sound when passing GO.' },
              ] as const
            ).map((field) => (
              <div key={field.key} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="text-sm font-semibold text-white">{field.label}</div>
                <div className="mt-1 text-xs text-slate-500">{field.note}</div>
                <div className="mt-4 flex gap-2">
                  <input
                    type="text"
                    placeholder="https://..."
                    value={configDraft.sfx?.[field.key] || ''}
                    disabled={!canManageBalances}
                    onChange={(event) => updateConfigSfx(field.key, event.target.value)}
                    className="flex-1 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  {canManageBalances && (
                    <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white transition hover:bg-slate-700">
                      Upload
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = await handleUploadAudio(file);
                            if (url) updateConfigSfx(field.key, url);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
                {configDraft.sfx?.[field.key] && (
                  <audio controls src={configDraft.sfx[field.key]} className="mt-3 h-8 w-full" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {canManageBalances && (
            <button onClick={handleSaveConfig} className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20">
              Save Config
            </button>
          )}
          <button onClick={() => void refreshConfig()} className="rounded-2xl border border-slate-700 bg-slate-900/80 px-5 py-3 text-sm font-semibold text-slate-100">
            Reload from DB
          </button>
          {!canManageBalances && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-500">
              Your role can inspect config but cannot change it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
