
import { Pool } from 'pg';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Buffer } from 'buffer';
import { CallStatus } from '../src/types';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
});

const getUserIdFromRequest = (req: VercelRequest): string | null => {
    return req.headers['x-user-id'] as string || null;
}

// --- Notepad Logic ---
const ensureNotepadTableExists = async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS notes (user_id VARCHAR(255) PRIMARY KEY, content TEXT, updated_at TIMESTAMP WITH TIME ZONE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);`);
};
async function handleNotepad(req: VercelRequest, res: VercelResponse) {
    const userId = getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ message: 'Authentication required.' });
    try { await ensureNotepadTableExists(); } catch(e) { return res.status(500).json({ message: 'DB init failed.'}); }

    if (req.method === 'GET') {
        const { rows } = await pool.query('SELECT content FROM notes WHERE user_id = $1', [userId]);
        return res.status(200).json({ content: rows[0]?.content || '' });
    }
    if (req.method === 'PUT') {
        const { content } = req.body;
        await pool.query(`INSERT INTO notes (user_id, content, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (user_id) DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at;`, [userId, content]);
        return res.status(200).json({ message: 'Note saved.' });
    }
    res.setHeader('Allow', ['GET', 'PUT']).status(405).end();
}

// --- Contacts Logic ---
const ensureContactsTableExists = async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS contacts (id SERIAL PRIMARY KEY, user_id VARCHAR(255) NOT NULL, name VARCHAR(255) NOT NULL, email VARCHAR(255), phone VARCHAR(50), notes TEXT, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);`);
};
async function handleContacts(req: VercelRequest, res: VercelResponse) {
    const userId = getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ message: 'Auth required.' });
    try { await ensureContactsTableExists(); } catch (e) { return res.status(500).json({ message: 'DB init failed.' }); }
    
    const { id } = req.query;
    const { name, email, phone, notes } = req.body;

    if (req.method === 'GET') {
        const { rows } = await pool.query('SELECT * FROM contacts WHERE user_id = $1 ORDER BY name ASC', [userId]);
        return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
        if (!name) return res.status(400).json({ message: 'Name is required.' });
        const { rows } = await pool.query('INSERT INTO contacts (user_id, name, email, phone, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *', [userId, name, email, phone, notes]);
        return res.status(201).json(rows[0]);
    }
    if (id && typeof id === 'string') {
        if (req.method === 'PUT') {
            if (!name) return res.status(400).json({ message: 'Name is required.' });
            const { rows } = await pool.query('UPDATE contacts SET name=$1, email=$2, phone=$3, notes=$4 WHERE id=$5 AND user_id=$6 RETURNING *', [name, email, phone, notes, id, userId]);
            return res.status(200).json(rows[0]);
        }
        if (req.method === 'DELETE') {
            await pool.query('DELETE FROM contacts WHERE id = $1 AND user_id = $2', [id, userId]);
            return res.status(204).end();
        }
    }
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']).status(405).end();
}

// --- LocalMail Logic ---
const ensureLocalMailTableExists = async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS localmails (id SERIAL PRIMARY KEY, sender_id VARCHAR(255) NOT NULL, recipient_username VARCHAR(255) NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, timestamp TIMESTAMPTZ DEFAULT NOW(), is_read BOOLEAN DEFAULT FALSE, FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE);`);
};
async function handleLocalMail(req: VercelRequest, res: VercelResponse) {
    const userId = getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ message: 'Auth required.' });
    try { await ensureLocalMailTableExists(); } catch(e) { return res.status(500).json({ message: 'DB init failed.'}); }

    if (req.method === 'GET') {
        const query = req.query.view === 'sent'
            ? `SELECT m.*, u.username as sender_username FROM localmails m JOIN users u ON m.sender_id = u.id WHERE m.sender_id = $1 ORDER BY m.timestamp DESC`
            : `SELECT m.*, u.username as sender_username FROM localmails m JOIN users u ON m.sender_id = u.id WHERE m.recipient_username = (SELECT username FROM users WHERE id = $1) ORDER BY m.timestamp DESC`;
        const { rows } = await pool.query(query, [userId]);
        return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
        const { recipients, subject, body } = req.body;
        if (!recipients?.length || !subject || !body) return res.status(400).json({ message: 'All fields required.' });
        for (const r of recipients) {
            await pool.query('INSERT INTO localmails (sender_id, recipient_username, subject, body) VALUES ($1, $2, $3, $4)', [userId, r.split('@')[0], subject, body]);
        }
        return res.status(201).json({ message: 'Message sent.' });
    }
    res.setHeader('Allow', ['GET', 'POST']).status(405).end();
}

// --- Phone Logic ---
const ensurePhoneTableExists = async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS calls (id SERIAL PRIMARY KEY, caller_id VARCHAR(255) NOT NULL, callee_id VARCHAR(255) NOT NULL, status VARCHAR(50) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), answered_at TIMESTAMPTZ, ended_at TIMESTAMPTZ, FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (callee_id) REFERENCES users(id) ON DELETE CASCADE);`);
};
async function handlePhone(req: VercelRequest, res: VercelResponse) {
    const userId = getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ message: 'Auth required.' });
    try { await ensurePhoneTableExists(); } catch(e) { return res.status(500).json({ message: 'DB init failed.'}); }

    const { type, id: callId } = req.query;
    if (req.method === 'GET' && type === 'users') {
        const { rows } = await pool.query('SELECT id, username FROM users WHERE id != $1', [userId]);
        return res.status(200).json(rows);
    }
    if (req.method === 'GET' && type === 'status') {
        const { rows } = await pool.query(`SELECT c.*, u_caller.username as caller_username, u_callee.username as callee_username FROM calls c JOIN users u_caller ON c.caller_id=u_caller.id JOIN users u_callee ON c.callee_id=u_callee.id WHERE (c.callee_id=$1 OR c.caller_id=$1) AND c.status NOT IN ($2,$3) ORDER BY c.created_at DESC LIMIT 1`, [userId, CallStatus.Ended, CallStatus.Declined]);
        return res.status(200).json(rows[0] || null);
    }
    if (req.method === 'POST' && type === 'call') {
        const { calleeId } = req.body;
        const { rows } = await pool.query('INSERT INTO calls (caller_id, callee_id, status) VALUES ($1, $2, $3) RETURNING *', [userId, calleeId, CallStatus.Ringing]);
        return res.status(201).json(rows[0]);
    }
    if (req.method === 'PUT' && callId) {
        const { status } = req.body;
        let query = 'UPDATE calls SET status = $1' + (status === CallStatus.Active ? ', answered_at = NOW()' : status === CallStatus.Ended ? ', ended_at = NOW()' : '') + ' WHERE id = $2 RETURNING *';
        const { rows } = await pool.query(query, [status, callId]);
        return res.status(200).json(rows[0]);
    }
    res.setHeader('Allow', ['GET', 'POST', 'PUT']).status(405).end();
}

// --- VoiceServer Logic ---
const ensureVoiceServerTablesExist = async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS voice_servers (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255) NOT NULL);`);
    await pool.query(`CREATE TABLE IF NOT EXISTS voice_server_participants (room_id VARCHAR(255) NOT NULL, user_id VARCHAR(255) NOT NULL, PRIMARY KEY (room_id, user_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (room_id) REFERENCES voice_servers(id) ON DELETE CASCADE);`);
    await pool.query(`CREATE TABLE IF NOT EXISTS voice_messages (id SERIAL PRIMARY KEY, room_id VARCHAR(255) NOT NULL, sender_id VARCHAR(255) NOT NULL, audio_data BYTEA NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (room_id) REFERENCES voice_servers(id) ON DELETE CASCADE);`);
    if ((await pool.query('SELECT 1 FROM voice_servers LIMIT 1')).rowCount === 0) {
        await pool.query(`INSERT INTO voice_servers (id, name) VALUES ('general', 'General'), ('tech', 'Tech'), ('support', 'Support');`);
    }
};
async function handleVoiceServer(req: VercelRequest, res: VercelResponse) {
    const userId = getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ message: 'Auth required.' });
    try { await ensureVoiceServerTablesExist(); } catch (e) { return res.status(500).json({ message: 'DB init failed.'}); }

    const { type, roomId, since } = req.query;
    if (req.method === 'GET' && type === 'rooms') {
        const { rows } = await pool.query('SELECT * FROM voice_servers ORDER BY name');
        return res.status(200).json(rows);
    }
    if (req.method === 'GET' && type === 'participants' && roomId) {
        const { rows } = await pool.query('SELECT p.user_id, u.username FROM voice_server_participants p JOIN users u ON p.user_id = u.id WHERE p.room_id = $1', [roomId]);
        return res.status(200).json(rows);
    }
    if (req.method === 'GET' && type === 'messages' && roomId) {
        const { rows } = await pool.query(`SELECT m.*, u.username as sender_username FROM voice_messages m JOIN users u ON m.sender_id=u.id WHERE m.room_id=$1 AND m.created_at > $2 ORDER BY m.created_at ASC`, [roomId, since || new Date(0).toISOString()]);
        return res.status(200).json(rows.map(r => ({ ...r, audio_data: r.audio_data.toString('base64') })));
    }
    if (req.method === 'POST' && type === 'message') {
        const { roomId, audioData } = req.body;
        await pool.query('INSERT INTO voice_messages (room_id, sender_id, audio_data) VALUES ($1, $2, $3)', [roomId, userId, Buffer.from(audioData, 'base64')]);
        return res.status(201).json({ message: 'Sent.' });
    }
    if (req.method === 'POST') {
        const { roomId, action } = req.body; // action: 'join' or 'leave'
        if (action === 'join') await pool.query('INSERT INTO voice_server_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [roomId, userId]);
        if (action === 'leave') await pool.query('DELETE FROM voice_server_participants WHERE room_id = $1 AND user_id = $2', [roomId, userId]);
        return res.status(200).json({ message: 'OK' });
    }
    res.setHeader('Allow', ['GET', 'POST']).status(405).end();
}

// --- Main Handler ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { app } = req.query;
    try {
        switch(app) {
            case 'notepad': return await handleNotepad(req, res);
            case 'contacts': return await handleContacts(req, res);
            case 'localmail': return await handleLocalMail(req, res);
            case 'phone': return await handlePhone(req, res);
            case 'voiceserver': return await handleVoiceServer(req, res);
            default: return res.status(400).json({ message: 'Invalid or missing "app" parameter.' });
        }
    } catch (error) {
        console.error(`Error in /api/apps handler for app "${app}":`, error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
