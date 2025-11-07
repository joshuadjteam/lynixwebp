

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const NotepadPage: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [content, setContent] = useState<string | null>(null);
    const [status, setStatus] = useState<SaveStatus>('idle');
    const saveTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const fetchNotes = async () => {
            try {
                const res = await fetch('/api?_ep=apps&app=notepad', { headers: { 'x-user-id': currentUser.id } });
                setContent(res.ok ? (await res.json()).content : '');
            } catch (e) { setContent(''); setStatus('error'); }
        };
        fetchNotes();
    }, [currentUser.id]);

    const saveNote = useCallback(async (noteContent: string) => {
        setStatus('saving');
        try {
            const res = await fetch('/api?_ep=apps&app=notepad', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
                body: JSON.stringify({ content: noteContent }),
            });
            setStatus(res.ok ? 'saved' : 'error');
        } catch (e) { setStatus('error'); }
    }, [currentUser.id]);

    useEffect(() => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        if (content !== null) {
            setStatus('idle');
            saveTimeoutRef.current = window.setTimeout(() => saveNote(content), 1500);
        }
        return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); }
    }, [content, saveNote]);

    return (
        <div className="w-full h-[calc(100vh-150px)] max-w-7xl mx-auto bg-white/70 dark:bg-black/30 p-6 rounded-xl shadow-2xl border-2 border-purple-500/50 flex flex-col">
            <div className="mb-4 text-center">
                <h2 className="text-4xl font-bold">Notepad</h2>
                <p className="text-gray-600 dark:text-gray-300 mt-2">Your private space for quick notes.</p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">Edit your note within 72 hours or it will be deleted</p>
            </div>
            <div className="flex-grow w-full h-full flex flex-col">
                <textarea
                    value={content ?? ''}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Start typing..."
                    className="w-full h-full bg-gray-100 dark:bg-gray-900/50 p-4 rounded-lg border-2 dark:border-gray-700 focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none text-lg"
                    disabled={content === null}
                />
                 <div className="text-right text-sm text-gray-500 dark:text-gray-400 mt-2">
                    {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved' : 'Auto-saves changes.'}
                </div>
            </div>
        </div>
    );
};

export default NotepadPage;