
import React, { useState, useEffect } from 'react';

const Clock: React.FC = () => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const timerId = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);
    return (
        <div className="text-center text-lg font-mono mt-8">
            <p>{time.toLocaleTimeString()} / {time.toLocaleDateString()}</p>
        </div>
    );
};

const ContactPage: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-4xl bg-white/70 dark:bg-black/30 p-8 rounded-xl shadow-2xl border-2 border-purple-500/50 backdrop-blur-sm">
                <h2 className="text-4xl font-bold text-center mb-6">Get in Touch</h2>
                <p className="text-lg text-center mb-8">
                    We're here to help and answer any question you might have.
                </p>
                <div className="space-y-4 text-left text-xl font-light">
                    <p><span className="font-semibold">Email:</span> admin@lynixity.x10.bz</p>
                    <p><span className="font-semibold">Phone:</span> +1 (647) 247 - 4844</p>
                    <p><span className="font-semibold">TalkID:</span> 0470055990</p>
                </div>
                <Clock />
            </div>
        </div>
    );
};

export default ContactPage;
