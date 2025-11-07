
import React, { useState, useEffect } from 'react';
import { GoogleIcon } from './icons';

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

const GoogleSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
            setQuery('');
        }
    };
    return (
        <div className="w-full max-w-2xl mb-8">
            <form onSubmit={handleSearch} className="relative">
                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search with Google..." className="w-full bg-white/50 dark:bg-gray-900/50 p-4 pl-12 rounded-full border-2 border-purple-500/50 focus:ring-2 focus:ring-purple-400 focus:outline-none backdrop-blur-sm" />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><GoogleIcon /></div>
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full transition hover:scale-105">Search</button>
            </form>
        </div>
    );
};

const HomePage: React.FC = () => (
    <div className="flex flex-col items-center justify-center p-6 w-full">
        <GoogleSearch />
        <div className="w-full max-w-4xl bg-white/70 dark:bg-black/30 p-8 rounded-xl shadow-2xl border-2 border-purple-500/50 backdrop-blur-sm">
            <h2 className="text-4xl font-bold text-center mb-6">Welcome to Lynix by DJTeam!</h2>
            <p className="text-lg text-left leading-relaxed">
                Welcome to Lynix, where innovation in technology and coding comes to life. Since our inception in January 2024, we've been dedicated to pushing the boundaries of web development. We launched our first suite of products in July 2024 and began sharing our journey on our YouTube channel, '@DarCodr'. Today, our primary mission remains rooted in creating powerful coding solutions, while expanding our services to include reliable email support, crystal-clear SIP Voice communication, and more. Explore what we have to offer.
            </p>
            <Clock />
        </div>
    </div>
);

export default HomePage;
