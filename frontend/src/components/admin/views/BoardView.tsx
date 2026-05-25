import React from 'react';
import type { BoardTile, BoardVersionSummary, PublishedBoardResponse, BoardSkin } from '../types';
import { formatDateTime } from '../utils';

type Props = {
  boardData: PublishedBoardResponse | null;
  boardVersions: BoardVersionSummary[];
  boardSkins: BoardSkin[];
  boardVersionName: string;
  setBoardVersionName: (name: string) => void;
  boardSkinId: string;
  setBoardSkinId: (id: string) => void;
  selectedBoardTileId: string | null;
  setSelectedBoardTileId: (id: string | null) => void;
  selectedBoardTile: BoardTile | null;
  canManageBalances: boolean;
  draggedTileIndex: number | null;
  handleDragStart: (index: number) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (index: number) => void;
  handleAddTile: () => void;
  updateBoardTile: (key: keyof BoardTile, value: string | boolean) => void;
  handleRemoveTile: (id: string) => void;
  handlePublishBoard: () => void;
  handleResetBoardDraft: () => void;
  handleClearBoard: () => void;
  handleLoadVersion: (id: number) => void;
  handleImportBoard: (board: BoardTile[]) => void;
  renderLoading: () => React.ReactNode;
  boardNotFound?: boolean;
  handleInitializeBoard?: () => void;
};

export const BoardView: React.FC<Props> = ({
  boardData,
  boardVersions,
  boardSkins,
  boardVersionName,
  setBoardVersionName,
  boardSkinId,
  setBoardSkinId,
  selectedBoardTileId,
  setSelectedBoardTileId,
  selectedBoardTile,
  canManageBalances,
  draggedTileIndex,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleAddTile,
  updateBoardTile,
  handleRemoveTile,
  handlePublishBoard,
  handleResetBoardDraft,
  handleClearBoard,
  handleLoadVersion,
  handleImportBoard,
  renderLoading,
  boardNotFound,
  handleInitializeBoard,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (boardNotFound) {
    return (
      <div className="rounded-[30px] border border-cyan-500/20 bg-slate-950/40 p-8 backdrop-blur-md text-center max-w-xl mx-auto my-12 space-y-6 shadow-2xl">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/30">
          <svg className="w-8 h-8 text-cyan-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A2 2 0 013 15.382V6.618a2 2 0 011.106-1.789L9 2m0 18v-8m0 8l5.447-2.724A2 2 0 0021 15.382V6.618a2 2 0 00-1.106-1.789L15 2m-6 0l6 3m-6 3h.01M9 12h.01M9 16h.01" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight text-white">Initialize Board Editor</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            No published board configuration found in the database. Deploy the classic Monopoly map loaded with standard pricing structure, color groupings, and utilities to enable live room creation.
          </p>
        </div>
        {canManageBalances ? (
          <button
            onClick={handleInitializeBoard}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all duration-200 uppercase tracking-wider text-xs"
          >
            Create Initial Board Template
          </button>
        ) : (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-200 leading-normal">
            You do not have administrative privileges to initialize the global board layout. Please contact a Super Admin.
          </div>
        )}
      </div>
    );
  }

  if (!boardData) return <>{renderLoading()}</>;

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(boardData.board, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `monopoly-board-${boardData.versionName}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleDownloadTemplate = () => {
    const template: Partial<BoardTile>[] = [
      { id: 't0', index: 0, name: 'START', type: 'go' },
      { id: 't1', index: 1, name: 'Property Example', type: 'property', price: 100, rent: 10, colorGroup: 'brown', houseCost: 50, hotelCost: 50, rent1House: 50, rent2Houses: 150, rent3Houses: 450, rent4Houses: 800, rentHotel: 1250 },
      { id: 't2', index: 2, name: 'Community Chest', type: 'chest' },
      { id: 't3', index: 3, name: 'Income Tax', type: 'tax', taxAmount: 200 },
      { id: 't4', index: 4, name: 'Railroad Example', type: 'railroad', price: 200, rent: 25 },
      { id: 't5', index: 5, name: 'Chance', type: 'chance' },
      { id: 't6', index: 6, name: 'Jail', type: 'jail' },
      { id: 't7', index: 7, name: 'Utility Example', type: 'utility', price: 150, rent: 10 },
      { id: 't8', index: 8, name: 'Free Parking', type: 'parking' },
      { id: 't9', index: 9, name: 'Go To Jail', type: 'gotojail' }
    ];
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(template, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `monopoly-import-template.json`);
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
          handleImportBoard(json);
        } else {
          alert('Invalid board format. Expected an array of tiles.');
        }
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getTileGridStyle = (index: number, total: number) => {
    const side = Math.ceil(total / 4);
    if (index < side) {
      return { gridRow: side + 1, gridColumn: side + 1 - index };
    } else if (index < side * 2) {
      return { gridRow: side + 1 - (index - side), gridColumn: 1 };
    } else if (index < side * 3) {
      return { gridRow: 1, gridColumn: index - side * 2 + 1 };
    } else {
      return { gridRow: index - side * 3 + 1, gridColumn: side + 1 };
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-slate-800 bg-slate-950/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Published Board</h2>
            <p className="mt-1 text-sm text-slate-400">Published board versions are stored in MySQL. New rooms will use the latest published template.</p>
          </div>
          <div className="text-sm text-slate-400">
            Active version <span className="font-semibold text-white">{boardData.versionName}</span> by {boardData.createdBy}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 overflow-hidden">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-white">Interactive Board (Drag to reorder)</div>
              <div className="text-xs text-slate-500">{boardData.board.length} Tiles</div>
            </div>
            <div className="flex justify-center p-4 bg-slate-950/50 rounded-2xl w-full">
              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: `1.5fr repeat(${Math.ceil(boardData.board.length / 4) - 1}, 1fr) 1.5fr`,
                  gridTemplateRows: `1.5fr repeat(${Math.ceil(boardData.board.length / 4) - 1}, 1fr) 1.5fr`,
                  gap: '4px',
                }}
                className="w-full max-w-[800px] aspect-square"
              >
                {boardData.board.map((tile, idx) => {
                  const colorStyle = tile.colorGroup 
                    ? { backgroundColor: tile.colorGroup === 'brown' ? '#8B4513' : tile.colorGroup === 'lightBlue' ? '#87CEEB' : tile.colorGroup === 'pink' ? '#FFC0CB' : tile.colorGroup === 'orange' ? '#FFA500' : tile.colorGroup === 'red' ? '#FF0000' : tile.colorGroup === 'yellow' ? '#FFFF00' : tile.colorGroup === 'green' ? '#008000' : tile.colorGroup === 'darkBlue' ? '#00008B' : tile.colorGroup } 
                    : {};
                  return (
                    <div
                      key={tile.id}
                      draggable={canManageBalances}
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(idx)}
                      onClick={() => setSelectedBoardTileId(tile.id)}
                      style={getTileGridStyle(idx, boardData.board.length)}
                      className={`relative flex flex-col items-center justify-center rounded-xl border p-1 sm:p-2 text-center cursor-pointer transition-all select-none ${
                        selectedBoardTileId === tile.id 
                          ? 'border-cyan-500 bg-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.3)] z-10' 
                          : 'border-slate-700 bg-slate-800 hover:border-slate-500'
                      } ${draggedTileIndex === idx ? 'opacity-50 scale-95' : ''}`}
                    >
                      <div className="absolute top-1 left-1 text-[9px] text-slate-500 font-mono z-10 bg-slate-900/80 px-1 rounded">{idx}</div>
                      {tile.colorGroup && (
                        <div 
                          className="absolute top-0 inset-x-0 h-2 rounded-t-xl opacity-80" 
                          style={colorStyle}
                        />
                      )}
                      <div className="text-xs font-bold text-white leading-tight mt-2 z-10">{tile.name}</div>
                      <div className="text-[9px] text-slate-400 mt-1 uppercase z-10">{tile.type}</div>
                      {tile.price ? <div className="text-[10px] font-mono text-emerald-400 mt-1 z-10">${tile.price}</div> : null}
                    </div>
                  );
                })}
              </div>
            </div>
            {canManageBalances && (
              <button
                onClick={handleAddTile}
                className="mt-4 w-full rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-900 hover:text-white"
              >
                + Add Tile
              </button>
            )}
          </div>

          <div className="space-y-4">
            {selectedBoardTile ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold text-white">{selectedBoardTile.name}</div>
                    <div className="text-sm text-slate-500">Tile ID {selectedBoardTile.id} • type {selectedBoardTile.type}</div>
                  </div>
                  <span className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                    Index {selectedBoardTile.index}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-slate-300">
                    Name
                    <input
                      type="text"
                      value={selectedBoardTile.name}
                      disabled={!canManageBalances}
                      onChange={(event) => updateBoardTile('name', event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    Type
                    <select
                      value={selectedBoardTile.type}
                      disabled={!canManageBalances}
                      onChange={(event) => updateBoardTile('type', event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {['go', 'property', 'railroad', 'utility', 'tax', 'chance', 'chest', 'jail', 'gotojail', 'parking'].map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-slate-300">
                    Price
                    <input
                      type="number"
                      value={selectedBoardTile.price ?? ''}
                      disabled={!canManageBalances}
                      onChange={(event) => updateBoardTile('price', event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    Rent
                    <input
                      type="number"
                      value={selectedBoardTile.rent ?? ''}
                      disabled={!canManageBalances}
                      onChange={(event) => updateBoardTile('rent', event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    Tax Amount
                    <input
                      type="number"
                      value={selectedBoardTile.taxAmount ?? ''}
                      disabled={!canManageBalances}
                      onChange={(event) => updateBoardTile('taxAmount', event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    House Cost
                    <input
                      type="number"
                      value={selectedBoardTile.houseCost ?? ''}
                      disabled={!canManageBalances}
                      onChange={(event) => updateBoardTile('houseCost', event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    Color Group
                    <input
                      type="text"
                      value={selectedBoardTile.colorGroup ?? ''}
                      disabled={!canManageBalances}
                      onChange={(event) => updateBoardTile('colorGroup', event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                </div>

                {selectedBoardTile.type === 'property' && (
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <label className="text-sm text-slate-300">
                      Rent 1 House
                      <input
                        type="number"
                        value={selectedBoardTile.rent1House ?? ''}
                        disabled={!canManageBalances}
                        onChange={(event) => updateBoardTile('rent1House', event.target.value)}
                        className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </label>
                    <label className="text-sm text-slate-300">
                      Rent 2 Houses
                      <input
                        type="number"
                        value={selectedBoardTile.rent2Houses ?? ''}
                        disabled={!canManageBalances}
                        onChange={(event) => updateBoardTile('rent2Houses', event.target.value)}
                        className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </label>
                    <label className="text-sm text-slate-300">
                      Rent 3 Houses
                      <input
                        type="number"
                        value={selectedBoardTile.rent3Houses ?? ''}
                        disabled={!canManageBalances}
                        onChange={(event) => updateBoardTile('rent3Houses', event.target.value)}
                        className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </label>
                    <label className="text-sm text-slate-300">
                      Rent 4 Houses
                      <input
                        type="number"
                        value={selectedBoardTile.rent4Houses ?? ''}
                        disabled={!canManageBalances}
                        onChange={(event) => updateBoardTile('rent4Houses', event.target.value)}
                        className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </label>
                    <label className="text-sm text-slate-300">
                      Rent Hotel
                      <input
                        type="number"
                        value={selectedBoardTile.rentHotel ?? ''}
                        disabled={!canManageBalances}
                        onChange={(event) => updateBoardTile('rentHotel', event.target.value)}
                        className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </label>
                    <label className="text-sm text-slate-300">
                      Hotel Cost
                      <input
                        type="number"
                        value={selectedBoardTile.hotelCost ?? ''}
                        disabled={!canManageBalances}
                        onChange={(event) => updateBoardTile('hotelCost', event.target.value)}
                        className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </label>
                  </div>
                )}
                {canManageBalances && (
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => handleRemoveTile(selectedBoardTile.id)}
                      className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                    >
                      Remove Tile
                    </button>
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                  Published board templates must start clean:
                  no `ownerPlayerId`, no mortgage state, and no prebuilt houses/hotels.
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 text-sm text-slate-400">
                Select a tile to inspect and edit the board draft.
              </div>
            )}

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="text-lg font-bold text-white">Publish Version</div>
              <div className="mt-1 text-sm text-slate-500">Publishing writes a new board snapshot to MySQL and updates the template used for future rooms.</div>
              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <input
                  type="text"
                  value={boardVersionName}
                  disabled={!canManageBalances}
                  onChange={(event) => setBoardVersionName(event.target.value)}
                  placeholder="version-name"
                  className="flex-1 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
                <select
                  value={boardSkinId}
                  disabled={!canManageBalances}
                  onChange={(event) => setBoardSkinId(event.target.value)}
                  className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Default Skin</option>
                  {boardSkins.map((skin) => (
                    <option key={skin.id} value={skin.id}>
                      {skin.name}
                    </option>
                  ))}
                </select>
                {canManageBalances && (
                  <button onClick={handlePublishBoard} className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20">
                    Publish Board
                  </button>
                )}
                <button onClick={handleResetBoardDraft} className="rounded-2xl border border-slate-700 bg-slate-950/80 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800">
                  Reload Active
                </button>
                {canManageBalances && (
                  <button onClick={handleClearBoard} className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-5 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20">
                    Clear Board
                  </button>
                )}
                <button onClick={handleExportJSON} className="rounded-2xl border border-indigo-500/40 bg-indigo-500/10 px-5 py-3 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/20">
                  Export JSON
                </button>
                {canManageBalances && (
                  <>
                    <input
                      type="file"
                      accept=".json"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <div className="flex flex-col gap-2">
                      <button onClick={() => fileInputRef.current?.click()} className="rounded-2xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-5 py-3 text-sm font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/20">
                        Import JSON
                      </button>
                      <button onClick={handleDownloadTemplate} className="text-xs text-slate-400 hover:text-slate-300 underline text-center">
                        Download Template
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[30px] border border-slate-800 bg-slate-950/70 p-6">
        <h2 className="text-xl font-bold text-white">Version History</h2>
        <div className="mt-4 overflow-hidden rounded-3xl border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800 text-left">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-5 py-4">Version</th>
                <th className="px-5 py-4">Created By</th>
                <th className="px-5 py-4">Created At</th>
                <th className="px-5 py-4">Published At</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {boardVersions.map((version) => (
                <tr key={version.id}>
                  <td className="px-5 py-4 font-semibold text-white">{version.versionName}</td>
                  <td className="px-5 py-4 text-slate-300">{version.createdBy}</td>
                  <td className="px-5 py-4 text-slate-300">{formatDateTime(version.createdAt)}</td>
                  <td className="px-5 py-4 text-cyan-200">{formatDateTime(version.publishedAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => handleLoadVersion(version.id)}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                    >
                      Load Draft
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
