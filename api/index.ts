/**
 * =====================================================================================
 * UNIFIED API ENDPOINT
 * =====================================================================================
 * This file acts as the single entry point for all backend API calls for the Lynix application.
 * It uses a query parameter `_ep` (endpoint) to route incoming requests to the
 * appropriate handler function within this file.
 *
 * This consolidated approach simplifies the Vercel deployment by packaging all
 * server-side logic into one manageable serverless function. All other files
 * in the `/api` directory are placeholders and are not used.
 *
 * --- ROUTING ---
 * The main `handler` function at the bottom of the file reads the `_ep` query param
 * and uses a switch statement to delegate the request.
 *
 * --- AVAILABLE ENDPOINTS (`_ep`) ---
 * - 'users': Handles user authentication (login) and CRUD operations for user management.
 * - 'gemini': A secure proxy for requests to the Google Gemini AI model.
 * - 'chat': Manages real-time chat functionalities, including fetching users, messages, and alerts.
 * - 'apps': A hub for various integrated applications:
 *   - 'notepad': Save and retrieve user notes.
 *   - 'contacts': CRUD operations for user contacts.
 *   - 'localmail': A simple internal mailing system.
 *   - 'phone': Handles VoIP call logic (initiate, status, etc.).
 *   - 'voiceserver': Manages voice chat rooms and messages.
 * =====================================================================================
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { GoogleGenAI } from '@google/genai';
import { Buffer } from 'buffer';
import type { User, CallStatus, ChatMessage } from '../types';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
});

const getUserIdFromRequest = (req: VercelRequest): string | null => {
    return req.headers['x-user-id'] as string || null;
}

// --- Logic from api/users.ts ---
async function handleUsers(req: VercelRequest, res: VercelResponse) {
    if (!process.env.POSTGRES_URL) {
        console.error('FATAL: POSTGRES_URL environment variable is not set.');
        return res.status(503).json({ message: 'Service Unavailable: Database connection is not configured.' });
    }

    const { action, id } = req.query;
    
    if (req.method === 'POST' && action === 'login') {
        try {
            const { username, password } = req.body;
            if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });
            const { rows } = await pool.query("SELECT id, username, password_hash, role, plan, email, sip, billing, chat_enabled, ai_enabled, localmail_enabled FROM users WHERE lower(username) = $1", [username.toLowerCase()]);
            if (rows.length === 0) return res.status(401).json({ message: 'Invalid username or password.' });
            const user = rows[0];
            const passwordMatch = await bcrypt.compare(password, user.password_hash);
            if (!passwordMatch) return res.status(401).json({ message: 'Invalid username or password.' });
            const userToReturn: User = { id: user.id, username: user.username, role: user.role, plan: user.plan, email: user.email, sip: user.sip, billing: user.billing, chat_enabled: user.chat_enabled || false, ai_enabled: user.ai_enabled || false, localmail_enabled: user.localmail_enabled || false };
            return res.status(200).json(userToReturn);
        } catch (error) {
            console.error('Authentication error:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown internal error occurred.';
            return res.status(500).json({ message: errorMessage });
        }
    }

    if (id && typeof id === 'string') {
        if (req.method === 'PUT') {
            const userData = req.body;
            const query = `UPDATE users SET username = $1, email = $2, sip = $3, plan = $4, billing = $5, role = $6, chat_enabled = $7, ai_enabled = $8, localmail_enabled = $9 WHERE id = $10 RETURNING *;`;
            const values = [userData.username, userData.email, userData.sip, JSON.stringify(userData.plan), JSON.stringify(userData.billing), userData.role, userData.chat_enabled, userData.ai_enabled, userData.localmail_enabled, id];
            const { rows } = await pool.query(query, values);
            return res.status(200).json(rows[0]);
        }
        if (req.method === 'PATCH') {
            const { password } = req.body;
            const passwordHash = await bcrypt.hash(password, 10);
            await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
            return res.status(200).json({ message: 'Password updated.' });
        }
        if (req.method === 'DELETE') {
            await pool.query('DELETE FROM users WHERE id = $1', [id]);
            return res.status(204).end();
        }
    } else {
        if (req.method === 'GET') {
            const { rows } = await pool.query("SELECT id, username, role, plan, email, sip, billing, COALESCE(chat_enabled, FALSE) as chat_enabled, COALESCE(ai_enabled, FALSE) as ai_enabled, COALESCE(localmail_enabled, FALSE) as localmail_enabled FROM users ORDER BY role, username");
            return res.status(200).json(rows);
        }
        if (req.method === 'POST') {
            const { userData, password } = req.body;
            const passwordHash = await bcrypt.hash(password, 10);
            const newId = userData.username.toLowerCase();
            const query = `INSERT INTO users (id, username, password_hash, role, plan, email, sip, billing, chat_enabled, ai_enabled, localmail_enabled) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *;`;
            const values = [newId, userData.username, passwordHash, userData.role, JSON.stringify(userData.plan), userData.email, userData.sip, JSON.stringify(userData.billing), userData.chat_enabled || false, userData.ai_enabled || false, userData.localmail_enabled || false];
            const { rows } = await pool.query(query, values);
            return res.status(201).json(rows[0]);
        }
    }
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).status(405).end();
}

// --- Logic from api/gemini.ts ---
async function handleGemini(req: VercelRequest, res: VercelResponse) {
    if (!process.env.API_KEY) {
        return res.status(503).json({ message: 'Service Unavailable: AI service is not configured.' });
    }
    if (req.method !== 'POST') {
        return res.setHeader('Allow', ['POST']).status(405).end('Method Not Allowed');
    }
    
    const { prompt, history } = req.body;
    if (!prompt) {
        return res.status(400).json({ message: 'A "prompt" is required.' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const chatHistory = (history || []).map((msg: ChatMessage) => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
        }));

        const contents = [...chatHistory, { role: 'user', parts: [{ text: prompt }] }];

        const systemInstruction = (history && history.length > 0)
            ? "You are Mason, a helpful assistant for LynxAI."
            : "You are Mason, a helpful assistant for LynxAI. Introduce yourself in this first message.";

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: { systemInstruction }
        });

        return res.status(200).json({ text: response.text });
    } catch (error) {
        console.error("Gemini API error:", error);
        return res.status(500).json({ message: "An error occurred while contacting the AI assistant." });
    }
}

// --- Logic from api/chat.ts ---
async function handleChat(req: VercelRequest, res: VercelResponse) {
    const { type } = req.query;

    if (req.method === 'GET') {
        if (type === 'users') {
            const { rows } = await pool.query("SELECT id, username FROM users WHERE chat_enabled = TRUE ORDER BY username ASC");
            return res.status(200).json(rows);
        }
        if (type === 'messages') {
            const { senderId, recipientId } = req.query;
            const { rows } = await pool.query(`SELECT * FROM messages WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1) ORDER BY timestamp ASC`, [senderId, recipientId]);
            await pool.query(`UPDATE messages SET is_read = TRUE WHERE recipient_id = $1 AND sender_id = $2 AND is_read = FALSE`, [senderId, recipientId]);
            return res.status(200).json(rows);
        }
        if (type === 'alerts') {
            const userId = getUserIdFromRequest(req);
            const { rows } = await pool.query(`SELECT m.sender_id, u.username as sender_username, LEFT(m.text, 50) as message_snippet FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.recipient_id = $1 AND m.is_read = FALSE ORDER BY m.timestamp DESC`, [userId]);
            return res.status(200).json(rows);
        }
    }
    if (req.method === 'POST' && type === 'messages') {
        const { senderId, recipientId, text } = req.body;
        const { rows } = await pool.query('INSERT INTO messages (sender_id, recipient_id, text, is_read) VALUES ($1, $2, $3, FALSE) RETURNING *', [senderId, recipientId, text]);
        return res.status(201).json(rows[0]);
    }
    res.setHeader('Allow', ['GET', 'POST']).status(405).end();
}

// --- Logic from api/apps.ts ---
async function handleApps(req: VercelRequest, res: VercelResponse) {
    const { app } = req.query;
    const userId = getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ message: 'Auth required.' });

    switch(app) {
        case 'notepad': {
            if (req.method === 'GET') {
                const { rows } = await pool.query('SELECT content FROM notes WHERE user_id = $1', [userId]);
                return res.status(200).json({ content: rows[0]?.content || '' });
            }
            if (req.method === 'PUT') {
                const { content } = req.body;
                await pool.query(`INSERT INTO notes (user_id, content, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (user_id) DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at;`, [userId, content]);
                return res.status(200).json({ message: 'Note saved.' });
            }
            break;
        }
        case 'contacts': {
            const { id } = req.query;
            const { name, email, phone, notes } = req.body;
            if (req.method === 'GET') {
                const { rows } = await pool.query('SELECT * FROM contacts WHERE user_id = $1 ORDER BY name ASC', [userId]);
                return res.status(200).json(rows);
            }
            if (req.method === 'POST') {
                const { rows } = await pool.query('INSERT INTO contacts (user_id, name, email, phone, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *', [userId, name, email, phone, notes]);
                return res.status(201).json(rows[0]);
            }
            if (id && typeof id === 'string') {
                if (req.method === 'PUT') {
                    const { rows } = await pool.query('UPDATE contacts SET name=$1, email=$2, phone=$3, notes=$4 WHERE id=$5 AND user_id=$6 RETURNING *', [name, email, phone, notes, id, userId]);
                    return res.status(200).json(rows[0]);
                }
                if (req.method === 'DELETE') {
                    await pool.query('DELETE FROM contacts WHERE id = $1 AND user_id = $2', [id, userId]);
                    return res.status(204).end();
                }
            }
            break;
        }
        case 'localmail': {
            if (req.method === 'GET') {
                const query = req.query.view === 'sent'
                    ? `SELECT m.*, u.username as sender_username FROM localmails m JOIN users u ON m.sender_id = u.id WHERE m.sender_id = $1 ORDER BY m.timestamp DESC`
                    : `SELECT m.*, u.username as sender_username FROM localmails m JOIN users u ON m.sender_id = u.id WHERE m.recipient_username = (SELECT username FROM users WHERE id = $1) ORDER BY m.timestamp DESC`;
                const { rows } = await pool.query(query, [userId]);
                return res.status(200).json(rows);
            }
            if (req.method === 'POST') {
                const { recipients, subject, body } = req.body;
                for (const r of recipients) { await pool.query('INSERT INTO localmails (sender_id, recipient_username, subject, body) VALUES ($1, $2, $3, $4)', [userId, r.split('@')[0], subject, body]); }
                return res.status(201).json({ message: 'Message sent.' });
            }
            break;
        }
        case 'phone': {
            const { type, id: callId } = req.query;
            if (req.method === 'GET' && type === 'users') {
                const { rows } = await pool.query('SELECT id, username FROM users WHERE id != $1', [userId]);
                return res.status(200).json(rows);
            }
            if (req.method === 'GET' && type === 'status') {
                const { rows } = await pool.query(`SELECT c.*, u_caller.username as caller_username, u_callee.username as callee_username FROM calls c JOIN users u_caller ON c.caller_id=u_caller.id JOIN users u_callee ON c.callee_id=u_callee.id WHERE (c.callee_id=$1 OR c.caller_id=$1) AND c.status NOT IN ('ended','declined') ORDER BY c.created_at DESC LIMIT 1`, [userId]);
                return res.status(200).json(rows[0] || null);
            }
            if (req.method === 'POST' && type === 'call') {
                const { calleeId } = req.body;
                const { rows } = await pool.query('INSERT INTO calls (caller_id, callee_id, status) VALUES ($1, $2, $3) RETURNING *', [userId, calleeId, 'ringing']);
                return res.status(201).json(rows[0]);
            }
            if (req.method === 'PUT' && callId) {
                const { status } = req.body;
                let query = 'UPDATE calls SET status = $1' + (status === 'active' ? ', answered_at = NOW()' : status === 'ended' ? ', ended_at = NOW()' : '') + ' WHERE id = $2 RETURNING *';
                const { rows } = await pool.query(query, [status, callId]);
                return res.status(200).json(rows[0]);
            }
            break;
        }
        case 'voiceserver': {
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
                const { roomId, action } = req.body;
                if (action === 'join') await pool.query('INSERT INTO voice_server_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [roomId, userId]);
                if (action === 'leave') await pool.query('DELETE FROM voice_server_participants WHERE room_id = $1 AND user_id = $2', [roomId, userId]);
                return res.status(200).json({ message: 'OK' });
            }
            break;
        }
        default: return res.status(400).json({ message: 'Invalid or missing "app" parameter.' });
    }
    res.status(405).end();
}


// --- Main Router ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { _ep } = req.query;
    try {
        switch (_ep) {
            case 'users': return await handleUsers(req, res);
            case 'gemini': return await handleGemini(req, res);
            case 'chat': return await handleChat(req, res);
            case 'apps': return await handleApps(req, res);
            default: return res.status(404).json({ message: `Endpoint not found: ${_ep}` });
        }
    } catch (error) {
        console.error(`Unhandled error in API router for endpoint "${_ep}":`, error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}