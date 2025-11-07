import React, { useState, useEffect, useRef } from 'react';
import { Page, User, Alert } from '../types';
import { useTheme } from '../App';
import { LynixLogo, BellIcon, WebIcon, AppsIcon, SoftphoneIcon, ChatIcon, MailIcon, NotepadIcon, CalculatorIcon, ContactsIcon, PhoneIcon, VoiceServerIcon, SunIcon, MoonIcon } from './icons';

// Inlined ThemeToggle component
const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme} className="p-2 rounded-full text-gray-500 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">
      {theme === 'light' ? <MoonIcon /> : <SunIcon />}
    </button>
  );
};

// Inlined AlertsDropdown component
const AlertsDropdown: React.FC<{ alerts: Alert[]; onAlertClick: (alert: Alert) => void; onClose: () => void; }> = ({ alerts, onAlertClick, onClose }) => (
    <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg z-50 animate-content-fade">
        <div className="p-3 border-b dark:border-gray-700"><h4 className="font-bold">Notifications</h4></div>
        <div className="max-h-96 overflow-y-auto">
            {alerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400"><p>No new messages.</p></div>
            ) : (
                alerts.map((alert, index) => (
                    <button key={index} onClick={() => { onAlertClick(alert); onClose(); }} className="w-full text-left p-3 flex items-start gap-3 hover:bg-gray-100 dark:hover:bg-gray-700">
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex-shrink-0 flex items-center justify-center text-white"><ChatIcon /></div>
                        <div>
                            <p className="font-semibold">New message from {alert.sender_username}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">"{alert.message_snippet}"</p>
                        </div>
                    </button>
                ))
            )}
        </div>
    </div>
);


const Header: React.FC<{
    currentPage: Page;
    setCurrentPage: (page: Page) => void;
    loggedInUser: User | null;
    onSignOut: () => void;
    alerts: Alert[];
    onAlertClick: (alert: Alert) => void;
}> = ({ currentPage, setCurrentPage, loggedInUser, onSignOut, alerts, onAlertClick }) => {
    const [isAlertsOpen, setIsAlertsOpen] = useState(false);
    const [isWebOpen, setIsWebOpen] = useState(false);
    const [isAppsOpen, setIsAppsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

     useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsAlertsOpen(false);
                setIsWebOpen(false);
                setIsAppsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleAppClick = (page: Page) => {
        setCurrentPage(page);
        setIsAppsOpen(false);
    };
    
    const NavButton: React.FC<{ page: Page, children: React.ReactNode }> = ({ page, children }) => (
        <button onClick={() => setCurrentPage(page)} className={`px-4 py-2 rounded-lg font-semibold transition hover:scale-105 ${currentPage === page ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 dark:bg-gray-700'}`}>
            {children}
        </button>
    );

    return (
        <header className="bg-white/80 dark:bg-gray-800/70 backdrop-blur-sm p-4 shadow-lg sticky top-0 z-50">
            <div className="container mx-auto flex justify-between items-center" ref={dropdownRef}>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentPage(Page.Home)}>
                        <LynixLogo />
                        <span className="text-xl font-bold">Lynix</span>
                    </div>
                </div>
                
                <nav className="flex items-center gap-2 md:gap-4">
                     <div className="relative">
                        <button onClick={() => setIsWebOpen(p => !p)} className="px-4 py-2 rounded-lg font-semibold transition hover:scale-105 bg-gray-200 dark:bg-gray-700 flex items-center gap-2"><WebIcon /><span>Web</span></button>
                        {isWebOpen && (
                            <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg z-50 animate-content-fade">
                                <a href="https://darshanjoshuakesavaruban.fwscheckout.com/" target="_blank" rel="noopener noreferrer" className="block w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600">Buy a product</a>
                                <a href="https://sites.google.com/gcp.lynixity.x10.bz/myportal/home" target="_blank" rel="noopener noreferrer" className="block w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600">MyPortal</a>
                            </div>
                        )}
                    </div>

                    {loggedInUser && (
                        <div className="relative">
                            <button onClick={() => setIsAppsOpen(p => !p)} className="px-4 py-2 rounded-lg font-semibold transition hover:scale-105 bg-gray-200 dark:bg-gray-700 flex items-center gap-2"><AppsIcon /><span>Apps</span></button>
                            {isAppsOpen && (
                                <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-gray-700 rounded-lg shadow-lg z-50 animate-content-fade">
                                    {/* Communications */}
                                    <button onClick={() => handleAppClick(Page.Phone)} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600"><PhoneIcon /><span>Phone</span></button>
                                    <button onClick={() => handleAppClick(Page.VoiceServer)} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600"><VoiceServerIcon /><span>Voice Server</span></button>
                                    {loggedInUser.chat_enabled && <button onClick={() => handleAppClick(Page.Chat)} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600"><ChatIcon /><span>Chat</span></button>}
                                    {loggedInUser.localmail_enabled && <button onClick={() => handleAppClick(Page.LocalMail)} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600"><MailIcon /><span>LocalMail</span></button>}
                                    
                                    <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                                    
                                    {/* Productivity */}
                                    <button onClick={() => handleAppClick(Page.Contacts)} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600"><ContactsIcon /><span>Contacts</span></button>
                                    <button onClick={() => handleAppClick(Page.Notepad)} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600"><NotepadIcon /><span>Notepad</span></button>
                                    <button onClick={() => handleAppClick(Page.Calculator)} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600"><CalculatorIcon /><span>Calculator</span></button>
                                </div>
                            )}
                        </div>
                    )}

                    <NavButton page={Page.Contact}>Contact</NavButton>
                    <NavButton page={Page.Home}>Home</NavButton>
                    <ThemeToggle />
                    {loggedInUser ? (
                        <>
                            {loggedInUser.role === 'admin' && <NavButton page={Page.Admin}>Admin</NavButton>}
                            <NavButton page={Page.Profile}>Profile</NavButton>
                             <div className="relative">
                                <button onClick={() => setIsAlertsOpen(p => !p)} className="relative p-2 text-gray-500 dark:text-gray-300">
                                    <BellIcon />
                                    {alerts.length > 0 && <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-xs rounded-full">{alerts.length}</span>}
                                </button>
                                {isAlertsOpen && <AlertsDropdown alerts={alerts} onAlertClick={onAlertClick} onClose={() => setIsAlertsOpen(false)} />}
                            </div>
                            <button onClick={onSignOut} className="px-4 py-2 rounded-lg text-white font-semibold transition bg-purple-600 hover:bg-purple-700 hover:scale-105">Sign Out</button>
                        </>
                    ) : (
                        <NavButton page={Page.SignOn}>Sign On</NavButton>
                    )}
                </nav>
            </div>
        </header>
    );
};

export default Header;