

import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { CloseIcon } from './icons';

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ children, title, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4 animate-modal-open">
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><CloseIcon /></button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

const Toggle: React.FC<{ label: string; enabled: boolean; onChange: (enabled: boolean) => void; }> = ({ label, enabled, onChange }) => (
    <div className="flex items-center justify-between bg-gray-200 dark:bg-gray-700 p-3 rounded-lg">
        <span className="font-medium">{label}</span>
        <button type="button" onClick={() => onChange(!enabled)} className={`relative inline-flex items-center h-6 rounded-full w-11 ${enabled ? 'bg-blue-600' : 'bg-gray-400'}`}>
            <span className={`inline-block w-4 h-4 transform bg-white rounded-full ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </div>
);

const AdminPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [password, setPassword] = useState('');
  
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
        const res = await fetch('/api?_ep=users');
        setUsers(res.ok ? await res.json() : []);
    } catch (e) { setUsers([]); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openModal = (user: User | null) => {
    const defaultData = { username: '', email: '', sip: '', role: 'standard', plan: {}, billing: {}, chat_enabled: false, ai_enabled: false, localmail_enabled: false };
    setCurrentUser(user);
    setFormData(user ? JSON.parse(JSON.stringify(user)) : defaultData);
    setPassword('');
    setIsModalOpen(true);
  };
  
  const closeModal = () => setIsModalOpen(false);
  
  const handleFormChange = (name: string, value: any) => {
    const keys = name.split('.');
    if (keys.length > 1) {
        setFormData((prev: any) => ({ ...prev, [keys[0]]: { ...prev[keys[0]], [keys[1]]: value } }));
    } else {
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser) { // Edit user
      await fetch(`/api?_ep=users&id=${currentUser.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      if (password.trim()) {
        await fetch(`/api?_ep=users&id=${currentUser.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      }
    } else { // Add user
      await fetch('/api?_ep=users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userData: formData, password }) });
    }
    fetchUsers();
    closeModal();
  };
  
  const handleDelete = async (user: User) => {
    if (window.confirm(`Are you sure you want to delete ${user.username}?`)) {
      await fetch(`/api?_ep=users&id=${user.id}`, { method: 'DELETE' });
      fetchUsers();
    }
  };
  
  return (
    <div className="w-full max-w-7xl mx-auto bg-white/70 dark:bg-black/30 p-8 rounded-xl shadow-2xl border-2 border-purple-500/50">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-4xl font-bold">Admin Portal</h2>
        <button onClick={() => openModal(null)} className="px-4 py-2 rounded-lg text-white font-semibold bg-blue-600 hover:bg-blue-700 hover:scale-105">Add User</button>
      </div>
      
      {isLoading ? <div className="text-center py-8">Loading users...</div> : (
      <div className="overflow-x-auto bg-gray-100/50 dark:bg-gray-800/50 rounded-lg">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b dark:border-gray-600 font-medium">
            <tr>
              <th className="px-6 py-4">Username</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Chat</th>
              <th className="px-6 py-4">AI</th>
              <th className="px-6 py-4">Mail</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b dark:border-gray-700 hover:bg-gray-200/50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 font-medium">{user.username}</td>
                <td className="px-6 py-4 capitalize">{user.role}</td>
                {[user.chat_enabled, user.ai_enabled, user.localmail_enabled].map((feature, i) => (
                    <td key={i} className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${feature ? 'bg-green-500/20 text-green-700 dark:text-green-300' : 'bg-gray-500/20 text-gray-700 dark:text-gray-400'}`}>
                            {feature ? 'On' : 'Off'}
                        </span>
                    </td>
                ))}
                <td className="px-6 py-4 text-right space-x-2">
                  <button onClick={() => openModal(user)} className="px-3 py-1 bg-blue-600/80 hover:bg-blue-600 rounded text-white">Edit</button>
                  <button onClick={() => handleDelete(user)} className="px-3 py-1 bg-red-600/80 hover:bg-red-600 rounded text-white">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {isModalOpen && formData && (
        <Modal title={currentUser ? `Edit ${currentUser.username}` : 'Add User'} onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid md:grid-cols-2 gap-4">
                <input type="text" placeholder="Username" name="username" value={formData.username} onChange={(e) => handleFormChange(e.target.name, e.target.value)} required className="w-full bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md p-2" />
                <select name="role" value={formData.role} onChange={(e) => handleFormChange(e.target.name, e.target.value)} className="w-full bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md p-2">
                  <option value="standard">Standard</option> <option value="trial">Trial</option> <option value="admin">Admin</option>
                </select>
            </div>
            <input type="password" placeholder={`Password (${currentUser ? 'optional' : 'required'})`} value={password} onChange={(e) => setPassword(e.target.value)} required={!currentUser} className="w-full bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md p-2" />
            <div className="grid md:grid-cols-2 gap-4">
                <input type="email" placeholder="Email" name="email" value={formData.email} onChange={(e) => handleFormChange(e.target.name, e.target.value)} required className="w-full bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md p-2" />
                <input type="text" placeholder="SIP" name="sip" value={formData.sip} onChange={(e) => handleFormChange(e.target.name, e.target.value)} className="w-full bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md p-2" />
            </div>
            <h4 className="text-lg font-semibold pt-4 border-t dark:border-gray-600">Features</h4>
            <div className="grid md:grid-cols-3 gap-4">
                <Toggle label="Chat" enabled={formData.chat_enabled} onChange={(val) => handleFormChange('chat_enabled', val)} />
                <Toggle label="AI" enabled={formData.ai_enabled} onChange={(val) => handleFormChange('ai_enabled', val)} />
                <Toggle label="Mail" enabled={formData.localmail_enabled} onChange={(val) => handleFormChange('localmail_enabled', val)} />
            </div>
            <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AdminPage;