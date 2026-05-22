import React, { useState } from 'react';
import type { BoardSkin } from '../types';

type Props = {
  boardSkins: BoardSkin[];
  handleCreateSkin: (skin: { name: string; type: 'image' | 'color'; value: string; file?: File }) => void;
  handleDeleteSkin: (id: number) => void;
};

export const SkinsView: React.FC<Props> = ({ boardSkins, handleCreateSkin, handleDeleteSkin }) => {
  const [newSkin, setNewSkin] = useState<{ name: string; type: 'image' | 'color'; value: string; file?: File }>({
    name: '',
    type: 'image',
    value: '',
  });

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-slate-800 bg-slate-950/70 p-6">
        <h2 className="text-xl font-bold text-white">Create New Skin</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_200px_2fr_auto]">
          <input
            type="text"
            placeholder="Skin Name (e.g. Desert Theme)"
            value={newSkin.name}
            onChange={(e) => setNewSkin({ ...newSkin, name: e.target.value })}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none"
          />
          <select
            value={newSkin.type}
            onChange={(e) => setNewSkin({ ...newSkin, type: e.target.value as 'image' | 'color' })}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none"
          >
            <option value="image">Background Image</option>
            <option value="color">Solid Color</option>
          </select>
          {newSkin.type === 'color' ? (
            <input
              type="text"
              placeholder="Hex Color (e.g. #000000)"
              value={newSkin.value}
              onChange={(e) => setNewSkin({ ...newSkin, value: e.target.value })}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none"
            />
          ) : (
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setNewSkin({ ...newSkin, file, value: file.name });
                }
              }}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
            />
          )}
          <button
            onClick={() => {
              handleCreateSkin(newSkin);
              setNewSkin({ name: '', type: 'image', value: '' });
            }}
            disabled={!newSkin.name || (!newSkin.value && !newSkin.file)}
            className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-3 font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
          >
            Create Skin
          </button>
        </div>
      </div>

      <div className="rounded-[30px] border border-slate-800 bg-slate-950/70 p-6">
        <h2 className="text-xl font-bold text-white">Available Skins</h2>
        <div className="mt-4 overflow-hidden rounded-3xl border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800 text-left">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-5 py-4">Name</th>
                <th className="px-5 py-4">Type</th>
                <th className="px-5 py-4">Value / Preview</th>
                <th className="px-5 py-4">Created By</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {boardSkins.map((skin) => (
                <tr key={skin.id}>
                  <td className="px-5 py-4 font-semibold text-white">{skin.name}</td>
                  <td className="px-5 py-4 text-slate-300 capitalize">{skin.type}</td>
                  <td className="px-5 py-4 text-slate-300">
                    <div className="flex items-center gap-3">
                      {skin.type === 'image' ? (
                        <div className="h-8 w-8 rounded-lg bg-cover bg-center border border-slate-700" style={{ backgroundImage: `url(${skin.value})` }} />
                      ) : (
                        <div className="h-8 w-8 rounded-lg border border-slate-700" style={{ backgroundColor: skin.value }} />
                      )}
                      <span className="truncate max-w-[200px]" title={skin.value}>{skin.value}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-400">{skin.createdBy}</td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => handleDeleteSkin(skin.id)}
                      className="rounded-xl bg-slate-900 px-3 py-1 text-sm font-semibold text-rose-400 hover:bg-slate-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {boardSkins.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                    No skins available. Create one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
