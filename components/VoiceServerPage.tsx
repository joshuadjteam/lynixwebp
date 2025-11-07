
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, VoiceServerRoom, VoiceServerParticipant, VoiceServerMessage } from '../types';
import { UnmuteIcon } from './icons';

const blobToBase64 = (blob: Blob): Promise<string> => new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(blob);
});
const base64ToUint8Array = (base64: string) => Uint8Array.from(atob(base64), c => c.charCodeAt(0));

const VoiceServerPage: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [rooms, setRooms] = useState<VoiceServerRoom[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<VoiceServerRoom | null>(null);
    const [participants, setParticipants] = useState<VoiceServerParticipant[]>([]);
    const [messages, setMessages] = useState<VoiceServerMessage[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement>(null);
    const pollIntervals = useRef<number[]>([]);
    const lastMsgTs = useRef(new Date(0).toISOString());

    const fetchRooms = useCallback(async () => {
        const res = await fetch(`/api/apps?app=voiceserver&type=rooms`, { headers: { 'x-user-id': currentUser.id } });
        if (res.ok) setRooms(await res.json());
    }, [currentUser.id]);

    useEffect(() => { fetchRooms(); }, [fetchRooms]);

    const pollData = useCallback(async (roomId: string) => {
        const [pRes, mRes] = await Promise.all([
            fetch(`/api/apps?app=voiceserver&type=participants&roomId=${roomId}`, { headers: { 'x-user-id': currentUser.id } }),
            fetch(`/api/apps?app=voiceserver&type=messages&roomId=${roomId}&since=${lastMsgTs.current}`, { headers: { 'x-user-id': currentUser.id } })
        ]);
        if (pRes.ok) setParticipants(await pRes.json());
        if (mRes.ok) {
            const newMsgs: VoiceServerMessage[] = await mRes.json();
            if (newMsgs.length > 0) {
                setMessages(prev => [...prev, ...newMsgs]);
                lastMsgTs.current = newMsgs[newMsgs.length - 1].created_at;
                // Simple auto-play implementation
                if (audioPlayerRef.current) {
                    const audioBlob = new Blob([base64ToUint8Array(newMsgs[0].audio_data)], { type: 'audio/webm' });
                    audioPlayerRef.current.src = URL.createObjectURL(audioBlob);
                    audioPlayerRef.current.play();
                }
            }
        }
    }, [currentUser.id]);

    const joinRoom = useCallback(async (room: VoiceServerRoom) => {
        pollIntervals.current.forEach(clearInterval);
        setSelectedRoom(room);
        setParticipants([]);
        setMessages([]);
        lastMsgTs.current = new Date(0).toISOString();

        await fetch('/api/apps?app=voiceserver', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
            body: JSON.stringify({ roomId: room.id, action: 'join' }),
        });
        
        pollData(room.id);
        pollIntervals.current = [window.setInterval(() => pollData(room.id), 5000)];
    }, [currentUser.id, pollData]);
    
    const leaveRoom = useCallback(async () => {
        if (!selectedRoom) return;
        pollIntervals.current.forEach(clearInterval);
        await fetch('/api/apps?app=voiceserver', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
            body: JSON.stringify({ roomId: selectedRoom.id, action: 'leave' }),
        });
        setSelectedRoom(null);
    }, [currentUser.id, selectedRoom]);

    const startRecording = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current.start();
        setIsRecording(true);
        mediaRecorderRef.current.ondataavailable = async (e) => {
            const audioBase64 = await blobToBase64(e.data);
            if (selectedRoom) {
                await fetch('/api/apps?app=voiceserver&type=message', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
                    body: JSON.stringify({ roomId: selectedRoom.id, audioData: audioBase64 }),
                });
            }
             stream.getTracks().forEach(track => track.stop());
        };
    };
    
    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };

    return (
        <div className="w-full h-[calc(100vh-150px)] max-w-7xl mx-auto bg-white/70 dark:bg-black/30 rounded-xl shadow-2xl border-2 border-purple-500/50 flex">
            <aside className="w-1/4 border-r dark:border-gray-700 flex flex-col">
                <header className="p-4 border-b dark:border-gray-700"><h2 className="text-xl font-bold">Servers</h2></header>
                <div className="flex-grow overflow-y-auto">
                    {rooms.map(room => <button key={room.id} onClick={() => joinRoom(room)} className={`w-full text-left p-4 ${selectedRoom?.id === room.id ? 'bg-purple-600/20' : 'hover:bg-gray-200/50'}`}>{room.name}</button>)}
                </div>
            </aside>
            
            <main className="w-3/4 flex flex-col">
                {!selectedRoom ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400"><UnmuteIcon /><p>Select a server</p></div>
                ) : (
                    <div className="flex flex-col h-full">
                        <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold">{selectedRoom.name} ({participants.length})</h2>
                            <button onClick={leaveRoom} className="px-3 py-1 bg-red-600/80 hover:bg-red-600 rounded text-sm text-white">Leave</button>
                        </header>
                        <div className="flex-grow p-4 overflow-y-auto space-y-3">
                            {messages.map((msg, i) => <div key={i} className="p-2 rounded-lg flex items-center gap-2 bg-gray-200/50 dark:bg-gray-700/50">{msg.sender_username} sent a voice message.</div>)}
                        </div>
                        <footer className="p-4 border-t dark:border-gray-700 flex flex-col items-center justify-center">
                            <p className="text-sm text-gray-500 mb-2">{isRecording ? "Recording..." : "Hold to Talk"}</p>
                            <button onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} className={`w-24 h-24 rounded-full flex items-center justify-center transition ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-blue-600'}`}>
                                <UnmuteIcon />
                            </button>
                        </footer>
                    </div>
                )}
            </main>
            <audio ref={audioPlayerRef} />
        </div>
    );
};

export default VoiceServerPage;
