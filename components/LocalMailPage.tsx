
import React, { useState, useEffect, useCallback } from 'react';
import { User, LocalMailMessage } from '../types';
import { MailIcon, SendIcon } from './icons';

type MailboxView = 'inbox' | 'sent' | 'compose';

const ComposeView: React.FC<{ currentUser: User; onMailSent: () => void; }> = ({ currentUser, onMailSent }) => {
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [status, setStatus] = useState('');

    const handleSend = async () => {
        setStatus('Sending...');
        const res = await fetch('/api/apps?app=localmail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
            body: JSON.stringify({ recipients: to.split(','), subject, body })
        });
        setStatus(res.ok ? 'Sent!' : 'Failed.');
        if (res.ok) setTimeout(onMailSent, 1000);
    };

    return (
        <div className="p-4 flex flex-col h-full">
            <h3 className="text-xl font-bold pb-3 mb-3 border-b dark:border-gray-700">Compose</h3>
            <div className="space-y-4">
                <input value={to} onChange={e => setTo(e.target.value)} placeholder="To (comma-separated)" className="w-full bg-gray-100 dark:bg-gray-900 p-2 rounded border dark:border-gray-700" />
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className="w-full bg-gray-100 dark:bg-gray-900 p-2 rounded border dark:border-gray-700" />
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={10} className="w-full bg-gray-100 dark:bg-gray-900 p-2 rounded resize-none border dark:border-gray-700"></textarea>
            </div>
            <footer className="mt-auto pt-4 flex justify-end items-center gap-4">
                <span>{status}</span>
                <button onClick={handleSend} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"><SendIcon /> Send</button>
            </footer>
        </div>
    )
};

const LocalMailPage: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [view, setView] = useState<MailboxView>('inbox');
    const [messages, setMessages] = useState<LocalMailMessage[]>([]);
    const [selectedMsg, setSelectedMsg] = useState<LocalMailMessage | null>(null);

    const fetchMessages = useCallback(async (v: MailboxView) => {
        if (v === 'compose') return;
        const res = await fetch(`/api/apps?app=localmail&view=${v}`, { headers: { 'x-user-id': currentUser.id } });
        if (res.ok) setMessages(await res.json());
    }, [currentUser.id]);

    useEffect(() => { fetchMessages(view); }, [view, fetchMessages]);
    
    const handleViewChange = (newView: MailboxView) => {
        setView(newView);
        setSelectedMsg(null);
    }

    return (
        <div className="w-full h-[calc(100vh-150px)] max-w-7xl mx-auto bg-white/70 dark:bg-black/30 rounded-xl shadow-2xl border-2 border-purple-500/50 flex">
            <aside className="w-1/4 border-r dark:border-gray-700 flex flex-col">
                <header className="p-4 border-b dark:border-gray-700">
                    <button onClick={() => setView('compose')} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Compose</button>
                    <nav className="flex justify-around mt-4">
                        <button onClick={() => handleViewChange('inbox')} className={`font-semibold ${view === 'inbox' ? 'text-purple-500' : 'text-gray-500'}`}>Inbox</button>
                        <button onClick={() => handleViewChange('sent')} className={`font-semibold ${view === 'sent' ? 'text-purple-500' : 'text-gray-500'}`}>Sent</button>
                    </nav>
                </header>
                <div className="flex-grow overflow-y-auto">
                    {messages.map(msg => 
                        <button key={msg.id} onClick={() => setSelectedMsg(msg)} className={`w-full text-left p-3 border-b dark:border-gray-700 ${selectedMsg?.id === msg.id ? 'bg-purple-600/20' : 'hover:bg-gray-200/50'} ${!msg.is_read && view === 'inbox' ? 'font-bold' : ''}`}>
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>{view === 'sent' ? `To: ${msg.recipient_username}` : `From: ${msg.sender_username}`}</span>
                                <span>{new Date(msg.timestamp).toLocaleDateString()}</span>
                            </div>
                            <p className="truncate">{msg.subject}</p>
                        </button>
                    )}
                </div>
            </aside>
            <main className="w-3/4">
                {view === 'compose' ? <ComposeView currentUser={currentUser} onMailSent={() => handleViewChange('sent')} /> : !selectedMsg ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400"><MailIcon /><p>Select a message</p></div>
                ) : (
                    <div className="p-4 h-full flex flex-col">
                        <header className="pb-3 border-b dark:border-gray-700">
                            <h3 className="text-xl font-bold">{selectedMsg.subject}</h3>
                            <p className="text-sm text-gray-500">{view === 'sent' ? `To: ${selectedMsg.recipient_username}` : `From: ${selectedMsg.sender_username}`}</p>
                        </header>
                        <div className="flex-grow py-4 overflow-y-auto whitespace-pre-wrap">{selectedMsg.body}</div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default LocalMailPage;
