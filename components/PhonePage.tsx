
import React, { useState, useEffect } from 'react';
import { User, CallStatus } from '../types';
import { useCall } from './CallProvider';
import { LargeUserIcon, MuteIcon, UnmuteIcon } from './icons';

const formatDuration = (seconds: number) => new Date(seconds * 1000).toISOString().substr(11, 8);

const PhonePage: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { activeCall, initiateCall, endCall, pollCallStatus } = useCall();
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [callDuration, setCallDuration] = useState(0);

    useEffect(() => {
        const fetchUsers = async () => {
            const res = await fetch('/api/apps?app=phone&type=users', { headers: { 'x-user-id': currentUser.id } });
            if (res.ok) setUsers(await res.json());
        };
        fetchUsers();
        
        const pollId = setInterval(() => pollCallStatus(currentUser.id), 3000);
        return () => clearInterval(pollId);
    }, [currentUser.id, pollCallStatus]);

    useEffect(() => {
        let timer: number | undefined;
        if (activeCall?.status === CallStatus.Active && activeCall.answered_at) {
            const answeredTime = new Date(activeCall.answered_at).getTime();
            timer = window.setInterval(() => setCallDuration(Math.floor((Date.now() - answeredTime) / 1000)), 1000);
        } else {
            setCallDuration(0);
        }
        return () => clearInterval(timer);
    }, [activeCall]);
    
    const otherUser = activeCall ? (activeCall.caller_username === currentUser.username ? activeCall.callee_username : activeCall.caller_username) : '';

    if (activeCall) {
        return (
            <div className="w-full h-[80vh] bg-blue-500 text-white flex flex-col items-center justify-between p-8 rounded-lg">
                <div className="w-full flex justify-between items-start">
                    <LargeUserIcon />
                    <div className="text-right">
                        <h2 className="text-5xl font-bold">{otherUser}</h2>
                        <p className="text-xl mt-2">{activeCall.status === CallStatus.Active ? formatDuration(callDuration) : 'ringing...'}</p>
                    </div>
                </div>
                <div className="w-full flex justify-center">
                    <button onClick={() => endCall(currentUser.id)} className="bg-red-600 hover:bg-red-700 text-white text-4xl font-bold py-8 px-24 rounded-2xl transition transform hover:scale-105">End</button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md mx-auto bg-white/70 dark:bg-black/30 p-8 rounded-xl shadow-2xl border-2 border-purple-500/50">
            <h2 className="text-3xl font-bold text-center mb-6">LynixTalk Dialer</h2>
            <div className="flex flex-col gap-4">
                <select onChange={(e) => setSelectedUserId(e.target.value)} className="w-full bg-gray-200 dark:bg-gray-700 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500">
                    <option value="" disabled selected>Select user to call</option>
                    {users.map(user => <option key={user.id} value={user.id}>{user.username}</option>)}
                </select>
                <button onClick={() => selectedUserId && initiateCall(selectedUserId, currentUser.id)} disabled={!selectedUserId} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition disabled:bg-gray-500">Call</button>
            </div>
        </div>
    );
};

export default PhonePage;
