
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Call, CallStatus } from '../types';
import IncomingCallModal from './IncomingCallModal';

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
            const res = await fetch('/api/apps?app=phone&type=status', { headers: { 'x-user-id': userId } });
            if (res.ok) {
                const callData: Call | null = await res.json();
                setActiveCall(callData);
                if (callData?.status === CallStatus.Ringing) setIncomingCall(callData);
                else setIncomingCall(null);
            }
        } catch (e) { console.error("Poll failed:", e); }
    }, []);

    const updateCallStatus = async (callId: number, status: CallStatus, userId: string) => {
         await fetch(`/api/apps?app=phone&id=${callId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
            body: JSON.stringify({ status }),
         });
         pollCallStatus(userId);
    }
    
    const initiateCall = async (calleeId: string, userId: string) => {
        const res = await fetch('/api/apps?app=phone&type=call', {
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
