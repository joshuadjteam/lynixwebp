import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Call, CallStatus } from '../types';

// --- Inlined IncomingCallModal.tsx ---
interface IncomingCallModalProps {
    call: Call;
    onAnswer: () => void;
    onDecline: () => void;
}
const IncomingCallModal: React.FC<IncomingCallModalProps> = ({ call, onAnswer, onDecline }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] animate-modal-open">
            <div className="bg-gray-800 text-white rounded-lg shadow-lg p-6 w-full max-w-sm text-center">
                <h2 className="text-2xl font-bold">Incoming Call</h2>
                <p className="text-lg mt-2">{call.caller_username}</p>
                <div className="mt-6 flex justify-around">
                    <button
                        onClick={onDecline}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-full transition transform hover:scale-105"
                    >
                        Decline
                    </button>
                    <button
                        onClick={onAnswer}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-full transition transform hover:scale-105"
                    >
                        Answer
                    </button>
                </div>
            </div>
        </div>
    );
};


interface CallContextType {
    activeCall: Call | null;
    initiateCall: (calleeId: string, userId: string) => Promise<void>;
    answerCall: (userId: string) => Promise<void>;
    endCall: (userId: string) => Promise<void>;
    declineCall: (userId: string) => Promise<void>;
    pollCallStatus: (userId: string) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);
export const useCall = () => useContext(CallContext)!;

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [activeCall, setActiveCall] = useState<Call | null>(null);
    const [incomingCall, setIncomingCall] = useState<Call | null>(null);

    const pollCallStatus = useCallback(async (userId: string) => {
        if (!userId) return;
        try {
            const res = await fetch('/api?_ep=apps&app=phone&type=status', { headers: { 'x-user-id': userId } });
            if (res.ok) {
                const callData: Call | null = await res.json();
                setActiveCall(callData);
                if (callData?.status === CallStatus.Ringing) setIncomingCall(callData);
                else setIncomingCall(null);
            }
        } catch (e) { console.error("Poll failed:", e); }
    }, []);

    const updateCallStatus = async (callId: number, status: CallStatus, userId: string) => {
         await fetch(`/api?_ep=apps&app=phone&id=${callId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
            body: JSON.stringify({ status }),
         });
         pollCallStatus(userId);
    }
    
    const initiateCall = async (calleeId: string, userId: string) => {
        const res = await fetch('/api?_ep=apps&app=phone&type=call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
            body: JSON.stringify({ calleeId }),
        });
        if(res.ok) setActiveCall(await res.json());
    };

    const answerCall = async (userId: string) => {
        if (!incomingCall) return;
        await updateCallStatus(incomingCall.id, CallStatus.Active, userId);
        setIncomingCall(null);
    };

    const endCall = async (userId: string) => {
        if (!activeCall) return;
        await updateCallStatus(activeCall.id, CallStatus.Ended, userId);
    };

    const declineCall = async (userId: string) => {
        if (!incomingCall) return;
        await updateCallStatus(incomingCall.id, CallStatus.Declined, userId);
        setIncomingCall(null);
    };

    return (
        <CallContext.Provider value={{ activeCall, initiateCall, answerCall, endCall, declineCall, pollCallStatus }}>
            {children}
            {incomingCall && (
                <IncomingCallModal
                    call={incomingCall}
                    onAnswer={() => answerCall(incomingCall.callee_id)} // callee is answering
                    onDecline={() => declineCall(incomingCall.callee_id)}
                />
            )}
        </CallContext.Provider>
    );
};