
import React, { useState, useEffect, useCallback } from 'react';
import { User, Contact } from '../types';
import { CloseIcon } from './icons';

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ children, title, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4 animate-modal-open" onClick={onClose}>
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><CloseIcon /></button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

const ContactsListPage: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentContact, setCurrentContact] = useState<Partial<Contact> | null>(null);

    const fetchContacts = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/apps?app=contacts', { headers: { 'x-user-id': currentUser.id } });
            setContacts(res.ok ? await res.json() : []);
        } catch (error) { console.error("Failed to fetch contacts:", error); } 
        finally { setIsLoading(false); }
    }, [currentUser.id]);

    useEffect(() => { fetchContacts(); }, [fetchContacts]);

    const openModal = (contact: Partial<Contact> | null = null) => {
        setCurrentContact(contact || { name: '', email: '', phone: '', notes: '' });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!currentContact?.name) return;
        const method = currentContact.id ? 'PUT' : 'POST';
        const url = `/api/apps?app=contacts` + (currentContact.id ? `&id=${currentContact.id}` : '');
        await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
            body: JSON.stringify(currentContact)
        });
        setIsModalOpen(false);
        fetchContacts();
    };
    
    const handleDelete = async (contact: Contact) => {
        if (!window.confirm(`Delete ${contact.name}?`)) return;
        await fetch(`/api/apps?app=contacts&id=${contact.id}`, { 
            method: 'DELETE', headers: { 'x-user-id': currentUser.id }
        });
        fetchContacts();
    };

    return (
        <div className="w-full max-w-7xl mx-auto bg-white/70 dark:bg-black/30 p-8 rounded-xl shadow-2xl border-2 border-purple-500/50">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-4xl font-bold">Contacts</h2>
                <button onClick={() => openModal()} className="px-4 py-2 rounded-lg text-white font-semibold bg-blue-600 hover:bg-blue-700 hover:scale-105">
                    Add Contact
                </button>
            </div>
            {isLoading ? <p className="text-center">Loading...</p> : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {contacts.length === 0 && <p className="col-span-full text-center text-gray-500">No contacts yet.</p>}
                    {contacts.map(contact => (
                        <div key={contact.id} className="bg-gray-100/50 dark:bg-gray-800/50 p-4 rounded-lg shadow-md flex flex-col justify-between">
                            <div>
                                <h3 className="text-xl font-bold">{contact.name}</h3>
                                {contact.email && <p className="text-sm text-gray-600 dark:text-gray-300">{contact.email}</p>}
                                {contact.phone && <p className="text-sm text-gray-600 dark:text-gray-300">{contact.phone}</p>}
                                {contact.notes && <p className="text-xs mt-2 italic whitespace-pre-wrap">{contact.notes}</p>}
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button onClick={() => openModal(contact)} className="px-3 py-1 bg-blue-600/80 hover:bg-blue-600 rounded text-sm text-white">Edit</button>
                                <button onClick={() => handleDelete(contact)} className="px-3 py-1 bg-red-600/80 hover:bg-red-600 rounded text-sm text-white">Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {isModalOpen && currentContact && (
                <Modal title={currentContact.id ? 'Edit Contact' : 'Add Contact'} onClose={() => setIsModalOpen(false)}>
                    <div className="space-y-4">
                        <input type="text" placeholder="Name (Required)" value={currentContact.name || ''} onChange={e => setCurrentContact({...currentContact, name: e.target.value})} className="w-full bg-gray-200 dark:bg-gray-700 rounded-md p-2" />
                        <input type="email" placeholder="Email" value={currentContact.email || ''} onChange={e => setCurrentContact({...currentContact, email: e.target.value})} className="w-full bg-gray-200 dark:bg-gray-700 rounded-md p-2" />
                        <input type="tel" placeholder="Phone" value={currentContact.phone || ''} onChange={e => setCurrentContact({...currentContact, phone: e.target.value})} className="w-full bg-gray-200 dark:bg-gray-700 rounded-md p-2" />
                        <textarea placeholder="Notes" value={currentContact.notes || ''} onChange={e => setCurrentContact({...currentContact, notes: e.target.value})} className="w-full bg-gray-200 dark:bg-gray-700 rounded-md p-2 resize-none" rows={3}></textarea>
                    </div>
                     <div className="pt-6 flex justify-end gap-3">
                        <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ContactsListPage;
