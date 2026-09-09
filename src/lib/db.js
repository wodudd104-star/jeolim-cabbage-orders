import pg from 'pg';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = process.cwd();
const AUTH_FILE = path.join(__dirname, 'data', 'auth.json');
const AUTH_BACKUP_FILE = path.join(__dirname, 'data', 'members-backup.json');
const DATABASE_URL = process.env.DATABASE_URL;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

let pool = null;

export function initDb() {
  if (!DATABASE_URL) return null;
  if (pool) return pool;
  pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });
  return pool;
}

export async function ensureUsersTable() {
  const db = initDb();
  if (!db) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      salt VARCHAR(255) NOT NULL,
      hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'user',
      active BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export function hashPassword(password) {
  const salt = crypto.randomUUID();
  const hash = crypto.createHmac('sha256', salt).update(password).digest('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
  const computed = crypto.createHmac('sha256', salt).update(password).digest('hex');
  return computed === hash;
}

async function loadJsonUsers() {
  let parsed = null;
  try {
    const raw = await fs.readFile(AUTH_FILE, 'utf-8');
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  if (!parsed) {
    try {
      const raw = await fs.readFile(AUTH_BACKUP_FILE, 'utf-8');
      parsed = JSON.parse(raw);
      console.log('Restored users from members-backup.json');
    } catch {
      parsed = null;
    }
  }

  if (parsed) {
    if (Array.isArray(parsed.users)) return parsed.users;
    if (parsed.id) {
      return [
        {
          id: parsed.id,
          email: parsed.email || '',
          salt: parsed.salt,
          hash: parsed.hash,
          role: parsed.role || 'admin',
          active: parsed.active !== false,
          created_at: parsed.createdAt || new Date().toISOString(),
        },
      ];
    }
  }
  return [];
}

async function saveJsonUsers(users) {
  await fs.mkdir(path.dirname(AUTH_FILE), { recursive: true });
  const payload = JSON.stringify({ users }, null, 2);
  await fs.writeFile(AUTH_FILE, payload);
  await fs.writeFile(AUTH_BACKUP_FILE, payload);
  await commitToGit([AUTH_FILE, AUTH_BACKUP_FILE]);
}

async function commitToGit(files) {
  if (!GITHUB_TOKEN) return;
  try {
    await execAsync('git', ['config', 'user.email', 'render@jeolim.local'], { cwd: PROJECT_ROOT });
    await execAsync('git', ['config', 'user.name', 'Render Auto Commit'], { cwd: PROJECT_ROOT });
    await execAsync('git', ['add', ...files], { cwd: PROJECT_ROOT });
    try {
      await execAsync('git', ['commit', '-m', 'auto: update member data'], { cwd: PROJECT_ROOT });
    } catch {
      // 변경사항 없음
    }
    const remoteResult = await execAsync('git', ['remote', 'get-url', 'origin'], { cwd: PROJECT_ROOT });
    const remoteUrl = remoteResult.stdout.trim();
    if (!remoteUrl) return;
    const authRemote = remoteUrl.replace(/^https:\/\//, `https://${GITHUB_TOKEN}@`);
    await execAsync('git', ['push', authRemote, 'HEAD:main'], { cwd: PROJECT_ROOT });
    console.log('[AUTO-COMMIT] Member data pushed to GitHub.');
  } catch (err) {
    console.error('[AUTO-COMMIT] Failed:', err.message);
  }
}

export async function commitDataFiles(files) {
  await commitToGit(files);
}

function rowToUser(row) {
  return {
    id: row.id,
    email: row.email,
    salt: row.salt,
    hash: row.hash,
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
  };
}

export async function listUsers() {
  const db = initDb();
  if (db) {
    const result = await db.query('SELECT * FROM users ORDER BY created_at DESC');
    return result.rows.map(rowToUser);
  }
  return loadJsonUsers();
}

export async function findUserById(id) {
  const db = initDb();
  if (db) {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? rowToUser(result.rows[0]) : null;
  }
  const users = await loadJsonUsers();
  return users.find((u) => u.id === id) || null;
}

export async function findUsersByEmail(email) {
  const db = initDb();
  if (db) {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows.map(rowToUser);
  }
  const users = await loadJsonUsers();
  return users.filter((u) => u.email === email);
}

export async function createUser({ id, email, salt, hash, role, active }) {
  const db = initDb();
  if (db) {
    await db.query(
      'INSERT INTO users (id, email, salt, hash, role, active) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, email, salt, hash, role, active]
    );
    return;
  }
  const users = await loadJsonUsers();
  users.push({
    id,
    email,
    salt,
    hash,
    role,
    active,
    createdAt: new Date().toISOString(),
  });
  await saveJsonUsers(users);
}

export async function updateUser(id, patch) {
  const db = initDb();
  if (db) {
    const fields = [];
    const values = [];
    let idx = 1;
    for (const [key, value] of Object.entries(patch)) {
      const col = key === 'createdAt' ? 'created_at' : key;
      fields.push(`${col} = $${idx++}`);
      values.push(value);
    }
    values.push(id);
    await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    return;
  }
  const users = await loadJsonUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...patch };
    await saveJsonUsers(users);
  }
}

export async function deleteUserById(id) {
  const db = initDb();
  if (db) {
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    return;
  }
  const users = await loadJsonUsers();
  const filtered = users.filter((u) => u.id !== id);
  await saveJsonUsers(filtered);
}

export async function countAdmins(excludeId) {
  const users = await listUsers();
  return users.filter((u) => u.role === 'admin' && u.id !== excludeId).length;
}
