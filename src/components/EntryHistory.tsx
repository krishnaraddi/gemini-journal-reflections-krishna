import React, { useState } from 'react';
import {
  Search,
  Calendar,
  Sparkles,
  MessageSquare,
  Trash2,
  Tag,
  ArrowRight,
  BookOpen,
  Filter,
} from 'lucide-react';
import { JournalEntry, ReflectionMode } from '../types';

interface EntryHistoryProps {
  entries: JournalEntry[];
  activeEntryId?: string;
  onSelectEntry: (entry: JournalEntry) => void;
  onDeleteEntry: (id: string) => Promise<void>;
  onNewEntry: () => void;
}

export const EntryHistory: React.FC<EntryHistoryProps> = ({
  entries,
  activeEntryId,
  onSelectEntry,
  onDeleteEntry,
  onNewEntry,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMode, setSelectedMode] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      (entry.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.content || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.tags || []).some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesMode = selectedMode === 'all' || entry.mode === selectedMode;

    return matchesSearch && matchesMode;
  });

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deleteConfirmId === id) {
      await onDeleteEntry(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search Filter Bar */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-600" />
              <span>Your Private Journal History</span>
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Securely stored in your isolated Firestore collection.
            </p>
          </div>

          <button
            type="button"
            onClick={onNewEntry}
            className="flex items-center justify-center gap-2 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white px-4 py-2.5 rounded-xl shadow transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Write New Reflection</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search past reflections by title, text, or tags..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-4 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
              className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-700 focus:bg-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Modes</option>
              <option value="reflection">Deep Reflection</option>
              <option value="summary">Executive Summary</option>
              <option value="brainstorm">Creative Brainstorm</option>
              <option value="perspective">Cognitive Reframe</option>
            </select>
          </div>
        </div>
      </div>

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-stone-200 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-900">
              {entries.length === 0 ? 'No reflections saved yet' : 'No matching entries found'}
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              {entries.length === 0
                ? 'Start your first journal reflection and let Gemini provide empathetic insights and summaries.'
                : 'Try adjusting your search keywords or reflection mode filter.'}
            </p>
          </div>
          {entries.length === 0 && (
            <button
              type="button"
              onClick={onNewEntry}
              className="inline-flex items-center gap-2 text-xs font-semibold bg-stone-900 text-white px-5 py-2.5 rounded-xl shadow hover:bg-stone-800 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Begin Your First Entry</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEntries.map((entry) => {
            const isSelected = entry.id === activeEntryId;
            const messageCount = entry.conversation?.length || 0;
            const formattedDate = new Date(entry.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={entry.id}
                onClick={() => onSelectEntry(entry)}
                className={`p-5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-md ${
                  isSelected
                    ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-300'
                    : 'bg-white border-stone-200 hover:border-stone-300'
                }`}
              >
                <div>
                  {/* Card Header: Mood, Mode, Date */}
                  <div className="flex items-center justify-between gap-2 mb-2 text-[11px] text-stone-500">
                    <div className="flex items-center gap-2">
                      {entry.mood && (
                        <span className="bg-stone-100 text-stone-800 px-2 py-0.5 rounded-md font-medium border border-stone-200">
                          {entry.mood}
                        </span>
                      )}
                      <span className="capitalize font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md border border-amber-200">
                        {entry.mode}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-stone-400">
                      <Calendar className="w-3 h-3" />
                      <span>{formattedDate}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-stone-900 group-hover:text-amber-900 transition leading-snug mb-2">
                    {entry.title || 'Untitled Reflection'}
                  </h3>

                  {/* Snippet of User Entry */}
                  <p className="text-stone-600 text-xs line-clamp-3 leading-relaxed mb-3">
                    {entry.content || '(Empty reflection body)'}
                  </p>

                  {/* Gemini AI Snippet Preview if present */}
                  {entry.aiResponse && (
                    <div className="bg-stone-900 text-stone-200 p-2.5 rounded-xl text-[11px] line-clamp-2 leading-relaxed border border-stone-800 mb-3">
                      <span className="text-amber-400 font-semibold mr-1">✦ Gemini:</span>
                      {entry.aiResponse.replace(/[#*`_]/g, '')}
                    </div>
                  )}

                  {/* Tags */}
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {entry.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between border-t border-stone-100 pt-3 mt-2 text-xs">
                  <div className="flex items-center gap-3 text-stone-400 text-[11px]">
                    {entry.aiResponse && (
                      <span className="flex items-center gap-1 text-amber-700">
                        <Sparkles className="w-3 h-3" />
                        <span>Reflected</span>
                      </span>
                    )}
                    {messageCount > 0 && (
                      <span className="flex items-center gap-1 text-stone-500">
                        <MessageSquare className="w-3 h-3" />
                        <span>{messageCount} msgs</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, entry.id)}
                      className={`p-1.5 rounded-lg text-xs transition ${
                        deleteConfirmId === entry.id
                          ? 'bg-rose-600 text-white font-bold px-2.5'
                          : 'text-stone-400 hover:text-rose-600 hover:bg-rose-50'
                      }`}
                      title="Delete entry"
                    >
                      {deleteConfirmId === entry.id ? 'Confirm Delete?' : <Trash2 className="w-3.5 h-3.5" />}
                    </button>

                    <div className="flex items-center gap-1 text-amber-800 font-semibold text-xs group-hover:translate-x-0.5 transition">
                      <span>Open</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
