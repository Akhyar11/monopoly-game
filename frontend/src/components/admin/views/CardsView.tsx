import React, { useState } from 'react';
import type { GameCard, CardAction } from '../types';
import { Trash2 } from 'lucide-react';

type Props = {
  cards: GameCard[];
  handleCreateCard: (type: 'chance' | 'community_chest', title: string, message: string, action: CardAction) => Promise<void>;
  handleDeleteCard: (id: string) => Promise<void>;
  handleImportCards: (cards: Partial<GameCard>[]) => Promise<void>;
};

export const CardsView: React.FC<Props> = ({
  cards,
  handleCreateCard,
  handleDeleteCard,
  handleImportCards,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [newCard, setNewCard] = useState({
    type: 'chance' as 'chance' | 'community_chest',
    title: '',
    message: '',
    actionType: 'money' as 'money' | 'move' | 'jail',
    amount: '',
    position: '',
    relativePosition: '',
    target: 'self' as 'self' | 'all_others' | 'everyone',
  });

  const onSubmit = async () => {
    if (!newCard.title || !newCard.message) return;
    
    let action: CardAction = { type: newCard.actionType, target: newCard.target };
    if (newCard.actionType === 'money') {
      action.amount = Number(newCard.amount) || 0;
    } else if (newCard.actionType === 'move') {
      if (newCard.position !== '') action.position = Number(newCard.position);
      if (newCard.relativePosition !== '') action.relativePosition = Number(newCard.relativePosition);
    }

    await handleCreateCard(newCard.type, newCard.title, newCard.message, action);
    setNewCard({
      type: 'chance',
      title: '',
      message: '',
      actionType: 'money',
      amount: '',
      position: '',
      relativePosition: '',
      target: 'self',
    });
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cards.map(c => ({ type: c.type, title: c.title, message: c.message, action: c.action })), null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `monopoly-cards-export.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleDownloadTemplate = () => {
    const template: Partial<GameCard>[] = [
      { type: 'chance', title: 'Speeding Fine', message: 'Pay $15', action: { type: 'money', amount: -15, target: 'self' } },
      { type: 'community_chest', title: 'Bank error in your favor', message: 'Collect $200', action: { type: 'money', amount: 200, target: 'self' } },
      { type: 'chance', title: 'Go Back 3 Spaces', message: 'Go back 3 spaces.', action: { type: 'move', relativePosition: -3, target: 'self' } },
      { type: 'community_chest', title: 'Go to Jail', message: 'Go directly to jail.', action: { type: 'jail', target: 'self' } },
      { type: 'chance', title: 'Chairman of the Board', message: 'Pay each player $50', action: { type: 'money', amount: 50, target: 'all_others' } },
    ];
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(template, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `monopoly-cards-template.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (Array.isArray(json)) {
          void handleImportCards(json);
        } else {
          alert('Invalid cards format. Expected an array of cards.');
        }
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="rounded-[30px] border border-slate-800 bg-slate-950/70 p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Cards Editor</h2>
          <p className="text-sm text-slate-400">Manage Chance and Community Chest cards.</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={handleExportJSON} className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/20">
            Export JSON
          </button>
          <div className="flex flex-col gap-1 items-center">
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
            />
            <button onClick={() => fileInputRef.current?.click()} className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-2 text-xs font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/20">
              Import JSON
            </button>
            <button onClick={handleDownloadTemplate} className="text-[10px] text-slate-400 hover:text-slate-300 underline">
              Download Template
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h3 className="mb-4 text-sm font-bold text-slate-300">Create New Card</h3>
          <div className="space-y-4 text-sm">
            <label className="block">
              <span className="mb-1 block text-slate-400">Card Deck</span>
              <select
                value={newCard.type}
                onChange={(e) => setNewCard({ ...newCard, type: e.target.value as 'chance' | 'community_chest' })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              >
                <option value="chance">Chance</option>
                <option value="community_chest">Community Chest</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-400">Title</span>
              <input
                type="text"
                value={newCard.title}
                onChange={(e) => setNewCard({ ...newCard, title: e.target.value })}
                placeholder="e.g. Bank error in your favor"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-400">Message</span>
              <textarea
                value={newCard.message}
                onChange={(e) => setNewCard({ ...newCard, message: e.target.value })}
                placeholder="Collect $200"
                rows={3}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-400">Action Type</span>
              <select
                value={newCard.actionType}
                onChange={(e) => setNewCard({ ...newCard, actionType: e.target.value as 'money' | 'move' | 'jail' })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              >
                <option value="money">Money (Add/Remove)</option>
                <option value="move">Move Player</option>
                <option value="jail">Send to Jail</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-400">Target</span>
              <select
                value={newCard.target}
                onChange={(e) => setNewCard({ ...newCard, target: e.target.value as 'self' | 'all_others' | 'everyone' })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              >
                <option value="self">Self (Player who drew the card)</option>
                <option value="all_others">All Others (Every other player)</option>
                <option value="everyone">Everyone (All players in room)</option>
              </select>
            </label>

            {newCard.actionType === 'money' && (
              <label className="block">
                <span className="mb-1 block text-slate-400">Amount (positive=gain, negative=lose)</span>
                <input
                  type="number"
                  value={newCard.amount}
                  onChange={(e) => setNewCard({ ...newCard, amount: e.target.value })}
                  placeholder="200"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                />
              </label>
            )}

            {newCard.actionType === 'move' && (
              <>
                <label className="block">
                  <span className="mb-1 block text-slate-400">Exact Position (0-39)</span>
                  <input
                    type="number"
                    value={newCard.position}
                    onChange={(e) => setNewCard({ ...newCard, position: e.target.value })}
                    placeholder="e.g. 0 for GO"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-slate-400">Relative Position (e.g. -3)</span>
                  <input
                    type="number"
                    value={newCard.relativePosition}
                    onChange={(e) => setNewCard({ ...newCard, relativePosition: e.target.value })}
                    placeholder="-3"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                  />
                </label>
              </>
            )}

            <button
              onClick={onSubmit}
              disabled={!newCard.title || !newCard.message}
              className="mt-4 w-full rounded-xl bg-cyan-500 py-2 font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
            >
              Add Card
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {cards.map((card) => (
            <div key={card.id} className="flex items-start justify-between rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${card.type === 'chance' ? 'bg-orange-500/20 text-orange-300' : 'bg-blue-500/20 text-blue-300'}`}>
                    {card.type === 'chance' ? 'Chance' : 'Community Chest'}
                  </span>
                  <span className="font-bold text-white">{card.title}</span>
                </div>
                <div className="text-sm text-slate-300">"{card.message}"</div>
                <div className="mt-2 text-xs text-slate-500">
                  Action: {card.action.type}
                  {card.action.amount !== undefined ? ` ($${card.action.amount})` : ''}
                  {card.action.position !== undefined ? ` (Goto pos ${card.action.position})` : ''}
                  {card.action.relativePosition !== undefined ? ` (Move ${card.action.relativePosition} spaces)` : ''}
                  {card.action.target && card.action.target !== 'self' ? ` [Target: ${card.action.target}]` : ''}
                </div>
              </div>
              <button
                onClick={() => handleDeleteCard(card.id)}
                className="rounded-lg bg-rose-500/10 p-2 text-rose-400 transition hover:bg-rose-500/20"
                title="Delete Card"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {cards.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
              No cards have been created yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
