import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import {
  Sparkles,
  Save,
  Send,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Tag,
  Smile,
  AlertCircle,
  FileText,
  HelpCircle,
  Lightbulb,
  Compass,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { JournalEntry, ReflectionMode, ChatMessage, EntryLocation } from '../types';
import { requestGeminiReflection } from '../services/geminiService';
import { LocationPicker } from './LocationPicker';

interface ActiveSessionProps {
  userId: string;
  activeEntry: JournalEntry | null;
  onSaveEntry: (entry: Partial<JournalEntry>) => Promise<string>;
  onNewEntry: () => void;
  onDeleteEntry?: (id: string) => Promise<void>;
  addToast: (type: 'success' | 'error' | 'info', message: string, actionLabel?: string, onAction?: () => void) => void;
}

const MOOD_OPTIONS = [
  { label: 'Grateful', emoji: '🌱' },
  { label: 'Calm', emoji: '🌊' },
  { label: 'Focused', emoji: '🎯' },
  { label: 'Reflective', emoji: '🪞' },
  { label: 'Overwhelmed', emoji: '⛈️' },
  { label: 'Creative', emoji: '✨' },
];

const REFLECTION_MODES: { mode: ReflectionMode; label: string; icon: any; desc: string }[] = [
  {
    mode: 'reflection',
    label: 'Deep Reflection',
    icon: Compass,
    desc: 'Empathetic inquiry, deep emotional validation, and introspective questions.',
  },
  {
    mode: 'summary',
    label: 'Executive Summary',
    icon: Layers,
    desc: 'Distill core themes, emotional currents, and key takeaways.',
  },
  {
    mode: 'brainstorm',
    label: 'Creative Brainstorm',
    icon: Lightbulb,
    desc: 'Actionable micro-habits, creative paths forward, and next-day prompt.',
  },
  {
    mode: 'perspective',
    label: 'Cognitive Reframe',
    icon: HelpCircle,
    desc: 'Constructive alternative lenses, resilience anchors, and growth mindset.',
  },
];

export const ActiveSession: React.FC<ActiveSessionProps> = ({
  userId,
  activeEntry,
  onSaveEntry,
  onNewEntry,
  onDeleteEntry,
  addToast,
}) => {
  const [title, setTitle] = useState(activeEntry?.title || '');
  const [content, setContent] = useState(activeEntry?.content || '');
  const [mode, setMode] = useState<ReflectionMode>(activeEntry?.mode || 'reflection');
  const [mood, setMood] = useState<string>(activeEntry?.mood || 'Reflective');
  const [tags, setTags] = useState<string[]>(activeEntry?.tags || ['reflection']);
  const [tagInput, setTagInput] = useState('');
  const [location, setLocation] = useState<EntryLocation | undefined>(activeEntry?.location);
  const [aiResponse, setAiResponse] = useState<string>(activeEntry?.aiResponse || '');
  const [modelUsed, setModelUsed] = useState<string>(activeEntry?.modelUsed || '');
  const [conversation, setConversation] = useState<ChatMessage[]>(activeEntry?.conversation || []);
  const [chatInput, setChatInput] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [copiedResponse, setCopiedResponse] = useState(false);

  // Sync state when activeEntry changes (e.g. user selected from history)
  useEffect(() => {
    if (activeEntry) {
      setTitle(activeEntry.title || '');
      setContent(activeEntry.content || '');
      setMode(activeEntry.mode || 'reflection');
      setMood(activeEntry.mood || 'Reflective');
      setTags(activeEntry.tags || []);
      setLocation(activeEntry.location || undefined);
      setAiResponse(activeEntry.aiResponse || '');
      setModelUsed(activeEntry.modelUsed || '');
      setConversation(activeEntry.conversation || []);
      setSaveStatus('saved');
    } else {
      setTitle('');
      setContent('');
      setMode('reflection');
      setMood('Reflective');
      setTags(['reflection']);
      setLocation(undefined);
      setAiResponse('');
      setModelUsed('');
      setConversation([]);
      setSaveStatus('idle');
    }
  }, [activeEntry?.id]);

  // Handle Save
  const handleSave = async (showToast = true): Promise<string | null> => {
    if (!content.trim() && !title.trim()) {
      if (showToast) addToast('info', 'Please write a journal title or entry before saving.');
      return null;
    }

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      const entryData: Partial<JournalEntry> = {
        id: activeEntry?.id,
        title: title.trim() || 'Untitled Reflection',
        content,
        mode,
        mood,
        tags,
        location,
        aiResponse,
        modelUsed,
        conversation,
      };

      const savedId = await onSaveEntry(entryData);
      setSaveStatus('saved');
      if (showToast) {
        addToast('success', 'Reflection saved to isolated Cloud Firestore.');
      }
      return savedId;
    } catch (err: any) {
      console.error('Failed to save entry:', err);
      setSaveStatus('error');
      addToast('error', `Failed to save: ${err.message || 'Database error'}.`, 'Retry Save', () => {
        handleSave(true);
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger Gemini Reflection
  const handleGenerateReflection = async () => {
    if (!content.trim()) {
      addToast('info', 'Please write some thoughts in your journal before asking Gemini to reflect.');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await requestGeminiReflection({
        title: title.trim() || 'Untitled Reflection',
        entryContent: content,
        mode,
        location,
      });

      setAiResponse(result.reflection);
      setModelUsed(result.modelUsed);

      // Auto-save with updated response
      const updatedEntry: Partial<JournalEntry> = {
        id: activeEntry?.id,
        title: title.trim() || 'Untitled Reflection',
        content,
        mode,
        mood,
        tags,
        location,
        aiResponse: result.reflection,
        modelUsed: result.modelUsed,
        conversation,
      };

      await onSaveEntry(updatedEntry);
      setSaveStatus('saved');
      addToast('success', `Gemini generated reflection using ${result.modelUsed}. Saved to Firestore.`);
    } catch (err: any) {
      console.error('Gemini generation error:', err);
      addToast('error', `Gemini reflection failed: ${err.message || 'Server error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Conversational Follow-up
  const handleSendFollowUp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatting) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedConversation = [...conversation, userMessage];
    setConversation(updatedConversation);
    setChatInput('');
    setIsChatting(true);

    try {
      const result = await requestGeminiReflection({
        title: title.trim() || 'Untitled Reflection',
        entryContent: content,
        mode: 'chat',
        conversation: updatedConversation.map((m) => ({ role: m.role, content: m.content })),
        customPrompt: userMessage.content,
        location,
      });

      const modelMessage: ChatMessage = {
        id: `model_${Date.now()}`,
        role: 'model',
        content: result.reflection,
        createdAt: new Date().toISOString(),
      };

      const finalConversation = [...updatedConversation, modelMessage];
      setConversation(finalConversation);

      // Persist conversation to Firestore
      await onSaveEntry({
        id: activeEntry?.id,
        title: title.trim() || 'Untitled Reflection',
        content,
        mode,
        mood,
        tags,
        location,
        aiResponse,
        modelUsed: result.modelUsed,
        conversation: finalConversation,
      });

      setSaveStatus('saved');
    } catch (err: any) {
      console.error('Chat error:', err);
      addToast('error', `Follow-up failed: ${err.message || 'Server error'}`);
    } finally {
      setIsChatting(false);
    }
  };

  // Add tag
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const cleaned = tagInput.trim().toLowerCase().replace(/^#/, '');
      if (cleaned && !tags.includes(cleaned)) {
        setTags([...tags, cleaned]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
    addToast('info', 'Copied reflection to clipboard.');
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-6">
      {/* Editor Controls Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewEntry}
            className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 px-3 py-2 rounded-xl border border-stone-200 transition"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>New Reflection</span>
          </button>

          {activeEntry?.id && onDeleteEntry && (
            <button
              type="button"
              onClick={() => onDeleteEntry(activeEntry.id)}
              className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-xl border border-rose-200 transition"
              title="Delete this entry from Firestore"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}
        </div>

        {/* Save state badge and Save Button */}
        <div className="flex items-center gap-3">
          <div className="text-xs font-medium flex items-center gap-1.5 text-stone-500">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-amber-600">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving to Firestore...</span>
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-emerald-600">
                <Check className="w-3.5 h-3.5" />
                <span>Saved to Firestore</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-rose-600">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Save error</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className="flex items-center gap-1.5 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 rounded-xl shadow transition disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5 text-stone-300" />
            <span>{isSaving ? 'Saving...' : 'Save Entry'}</span>
          </button>
        </div>
      </div>

      {/* Main Journal Writing Canvas */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-sm space-y-6">
        {/* Title Input */}
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSaveStatus('idle');
            }}
            placeholder="Reflection Title or Today's Theme..."
            className="w-full text-xl sm:text-2xl font-bold text-stone-900 placeholder:text-stone-300 border-b border-stone-200 pb-3 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        {/* Mood & Tag Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-1 text-xs">
          {/* Mood Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-stone-400 font-medium flex items-center gap-1">
              <Smile className="w-3.5 h-3.5" /> Mood:
            </span>
            <div className="flex flex-wrap gap-1">
              {MOOD_OPTIONS.map((m) => (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => {
                    setMood(m.label);
                    setSaveStatus('idle');
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-xs transition ${
                    mood === m.label
                      ? 'bg-amber-100 border-amber-300 text-amber-900 font-semibold'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <span className="mr-1">{m.emoji}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-stone-400" />
            <div className="flex flex-wrap items-center gap-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md border border-stone-200 flex items-center gap-1"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="text-stone-400 hover:text-stone-700"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="+ Add tag (Enter)"
                className="bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-md text-stone-700 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 w-28"
              />
            </div>
          </div>
        </div>

        {/* Google Maps Location Context */}
        <LocationPicker
          location={location}
          onChange={(newLoc) => {
            setLocation(newLoc);
            setSaveStatus('idle');
          }}
          addToast={addToast}
        />

        {/* Journal Textarea */}
        <div className="relative">
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setSaveStatus('idle');
            }}
            placeholder="What is on your mind today? Write freely about challenges, moments of gratitude, decisions, or raw emotions..."
            rows={10}
            className="w-full p-4 rounded-xl bg-stone-50/50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition leading-relaxed text-base font-normal resize-y"
          />
          <div className="flex items-center justify-between text-[11px] text-stone-400 px-1 mt-1">
            <span>{wordCount} words | {content.length} characters</span>
            <span>Tip: Select a mode below and let Gemini reflect on your entry</span>
          </div>
        </div>

        {/* AI Reflection Modes & Trigger */}
        <div className="pt-2 border-t border-stone-100">
          <div className="mb-3">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 block mb-2">
              Select Gemini Reflection Lense
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {REFLECTION_MODES.map((rm) => {
                const Icon = rm.icon;
                const isSelected = mode === rm.mode;
                return (
                  <button
                    key={rm.mode}
                    type="button"
                    onClick={() => {
                      setMode(rm.mode);
                      setSaveStatus('idle');
                    }}
                    className={`p-3 rounded-xl border text-left transition ${
                      isSelected
                        ? 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-400 shadow-xs'
                        : 'bg-stone-50/80 border-stone-200/80 hover:bg-stone-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-amber-700' : 'text-stone-500'}`} />
                      <span className={`text-xs font-bold ${isSelected ? 'text-amber-900' : 'text-stone-800'}`}>
                        {rm.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 leading-tight">
                      {rm.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={handleGenerateReflection}
              disabled={isGenerating || !content.trim()}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold text-xs px-6 py-3 rounded-xl shadow-md hover:shadow-lg transition transform active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-200" />
                  <span>Consulting Gemini 3.6 Flash...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>Generate Gemini Reflection</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Gemini AI Response Card */}
      {aiResponse && (
        <div className="bg-stone-900 text-stone-100 p-6 sm:p-8 rounded-2xl border border-stone-800 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-stone-100 flex items-center gap-2">
                  <span>Gemini Reflection</span>
                  {modelUsed && (
                    <span className="text-[10px] bg-stone-800 text-amber-300 font-mono px-2 py-0.5 rounded border border-stone-700">
                      {modelUsed}
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2 flex-wrap text-[11px] text-stone-400">
                  <span>Mode: {REFLECTION_MODES.find((m) => m.mode === mode)?.label || mode}</span>
                  {location && (
                    <span className="text-amber-300 flex items-center gap-1 bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-800/60">
                      📍 {location.name || 'Location-Aware'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => copyToClipboard(aiResponse)}
                className="flex items-center gap-1 text-xs text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 px-3 py-1.5 rounded-lg border border-stone-700 transition"
              >
                {copiedResponse ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedResponse ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Rendered Markdown Body */}
          <div className="text-stone-200 text-sm leading-relaxed space-y-3 prose prose-invert prose-stone max-w-none">
            <Markdown>{aiResponse}</Markdown>
          </div>
        </div>
      )}

      {/* Multi-Turn Conversation Thread */}
      {(aiResponse || conversation.length > 0) && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                <span>Multi-Turn Dialogue with Gemini</span>
                <span className="bg-stone-100 text-stone-600 text-[10px] font-mono px-2 py-0.5 rounded-full">
                  {conversation.length} messages
                </span>
              </h4>
              <p className="text-xs text-stone-500 mt-0.5">
                Continue exploring this reflection thread, question underlying assumptions, or ask for guidance.
              </p>
            </div>
          </div>

          {/* Conversation History */}
          {conversation.length > 0 ? (
            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {conversation.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className="text-[10px] text-stone-400 mb-1 px-1 font-medium">
                      {isUser ? 'You' : 'Gemini'} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div
                      className={`p-4 rounded-2xl max-w-2xl text-sm leading-relaxed ${
                        isUser
                          ? 'bg-amber-600 text-white rounded-br-xs'
                          : 'bg-stone-100 text-stone-800 rounded-bl-xs border border-stone-200'
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="prose prose-stone prose-sm max-w-none">
                          <Markdown>{msg.content}</Markdown>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 bg-stone-50 rounded-xl border border-stone-100 text-xs text-stone-500">
              No follow-up messages yet. Ask Gemini a question below to continue the dialogue.
            </div>
          )}

          {/* Follow-up input form */}
          <form onSubmit={handleSendFollowUp} className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask a follow-up, request a breakdown, or explore a thought..."
              disabled={isChatting}
              className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
            />
            <button
              type="submit"
              disabled={isChatting || !chatInput.trim()}
              className="bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs px-5 py-3 rounded-xl flex items-center gap-1.5 transition disabled:opacity-50 shrink-0"
            >
              {isChatting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-stone-300" />
              ) : (
                <Send className="w-3.5 h-3.5 text-stone-300" />
              )}
              <span>Send</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
