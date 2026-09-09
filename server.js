import express from 'express';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import fs from 'fs/promises';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const AUTH_FILE = path.join(__dirname, 'data', 'auth.json');
const TARGET_ADMIN_ID = 'wodudd102';

async function runAdminMigration() {
  const data = await loadAuthData();
  let changed = false;

  const target = data.users.find((u) => u.id === TARGET_ADMIN_ID);
  const defaultAdmin = data.users.find((u) => u.id === 'admin');

  if (target) {
    if (target.role !== 'admin' || !target.active) {
      target.role = 'admin';
      target.active = true;
      changed = true;
    }
  }

  if (defaultAdmin && data.users.some((u) => u.id !== 'admin' && u.role === 'admin')) {
    data.users = data.users.filter((u) => u.id !== 'admin');
    changed = true;
  }

  if (changed) await saveAuthData(data);
}

async function ensureDataDir() {
  await fs.mkdir(path.dirname(AUTH_FILE), { recursive: true });
}

async function loadAuthData() {
  try {
    const raw = await fs.readFile(AUTH_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    // 구버전 단일 계정 형식 마이그레이션
    if (Array.isArray(parsed.users)) return parsed;
    if (parsed.id) {
      return {
        users: [
          {
            id: parsed.id,
            email: parsed.email || '',
            salt: parsed.salt,
            hash: parsed.hash,
            role: parsed.role || 'admin',
            active: true,
            createdAt: new Date().toISOString(),
          },
        ],
      };
    }
    return { users: [] };
  } catch {
    return { users: [] };
  }
}

async function saveAuthData(data) {
  await ensureDataDir();
  await fs.writeFile(AUTH_FILE, JSON.stringify(data, null, 2));
}

async function findUserById(id) {
  const data = await loadAuthData();
  return data.users.find((u) => u.id === id) || null;
}

async function findUsersByEmail(email) {
  const data = await loadAuthData();
  return data.users.filter((u) => u.email === email);
}

function hashPassword(password) {
  const salt = crypto.randomUUID();
  const hash = crypto.createHmac('sha256', salt).update(password).digest('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const computed = crypto.createHmac('sha256', salt).update(password).digest('hex');
  return computed === hash;
}

function getEmailTransporter() {
  const service = process.env.EMAIL_SERVICE || 'gmail';
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({ service, auth: { user, pass } });
}

function generateCode(email) {
  const secret = process.env.EMAIL_CODE_SECRET || 'jeolim-cabbage-secret';
  const slot = Math.floor(Date.now() / (1000 * 60 * 30));
  return crypto
    .createHmac('sha256', secret)
    .update(`${email}:${slot}`)
    .digest('hex')
    .slice(0, 6)
    .toUpperCase();
}

function verifyCode(email, code) {
  const current = generateCode(email);
  if (code.toUpperCase() === current) return true;
  const secret = process.env.EMAIL_CODE_SECRET || 'jeolim-cabbage-secret';
  const prevSlot = Math.floor(Date.now() / (1000 * 60 * 30)) - 1;
  const prev = crypto
    .createHmac('sha256', secret)
    .update(`${email}:${prevSlot}`)
    .digest('hex')
    .slice(0, 6)
    .toUpperCase();
  return code.toUpperCase() === prev;
}

async function sendEmail(to, subject, text) {
  const transporter = getEmailTransporter();
  if (!transporter) throw new Error('이메일 발송 설정이 되어있지 않습니다.');
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  await transporter.sendMail({ from, to, subject, text });
}

app.post('/api/login', async (req, res) => {
  const { id, password } = req.body;
  if (!id || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
  }

  // 기본 관리자 계정은 항상 로그인 가능
  if (id === 'admin' && password === '0000') {
    return res.json({ id: 'admin', role: 'admin', active: true, email: '' });
  }

  const user = await findUserById(id);
  if (!user) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 틀렸습니다.' });
  }
  if (!verifyPassword(password, user.salt, user.hash)) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 틀렸습니다.' });
  }
  if (!user.active) {
    return res.status(403).json({ error: '계정이 비활성화되었습니다. 관리자에게 문의하세요.' });
  }
  res.json({ id: user.id, role: user.role, active: user.active, email: user.email });
});

app.post('/api/register', async (req, res) => {
  const { id, password, email } = req.body;
  if (!id || !password || !email) {
    return res.status(400).json({ error: '아이디, 비밀번호, 이메일을 모두 입력해주세요.' });
  }

  const data = await loadAuthData();
  if (data.users.some((u) => u.id === id)) {
    return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
  }
  if (data.users.some((u) => u.email === email)) {
    return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
  }

  const { salt, hash } = hashPassword(password);
  const newUser = {
    id,
    email,
    salt,
    hash,
    role: 'user',
    active: false,
    createdAt: new Date().toISOString(),
  };
  data.users.push(newUser);
  await saveAuthData(data);
  res.json({ success: true, role: newUser.role, active: newUser.active });
});

app.get('/api/users', async (_req, res) => {
  const data = await loadAuthData();
  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt,
  }));
  res.json(users);
});

app.post('/api/users/:id/activate', async (req, res) => {
  const data = await loadAuthData();
  const user = data.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  user.active = true;
  await saveAuthData(data);
  res.json({ success: true });
});

app.post('/api/users/:id/deactivate', async (req, res) => {
  const data = await loadAuthData();
  const user = data.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  if (user.role === 'admin') {
    return res.status(403).json({ error: '관리자 계정은 비활성화할 수 없습니다.' });
  }
  user.active = false;
  await saveAuthData(data);
  res.json({ success: true });
});

app.post('/api/users/:id/promote', async (req, res) => {
  const data = await loadAuthData();
  const user = data.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  user.role = 'admin';
  user.active = true;
  await saveAuthData(data);
  res.json({ success: true });
});

app.post('/api/users/:id/demote', async (req, res) => {
  const data = await loadAuthData();
  const user = data.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  if (user.id === 'admin') {
    return res.status(403).json({ error: '기본 관리자 계정은 일반 사용자로 변경할 수 없습니다.' });
  }
  user.role = 'user';
  await saveAuthData(data);
  res.json({ success: true });
});

app.delete('/api/users/:id', async (req, res) => {
  const data = await loadAuthData();
  const idx = data.users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  // 자기 자신은 삭제 불가
  // (요청자 정보를 알 수 없으므로 클라이언트에서 제어)
  // 기본 admin 계정은 다른 관리자가 존재할 때만 삭제 가능
  if (data.users[idx].id === 'admin') {
    const otherAdmins = data.users.filter((u) => u.role === 'admin' && u.id !== 'admin');
    if (otherAdmins.length === 0) {
      return res.status(403).json({ error: '다른 관리자가 없어 기본 관리자를 삭제할 수 없습니다.' });
    }
  }
  data.users.splice(idx, 1);
  await saveAuthData(data);
  res.json({ success: true });
});

app.post('/api/find-id', async (req, res) => {
  const { email } = req.body;
  const users = await findUsersByEmail(email);
  if (users.length === 0) {
    return res.status(404).json({ error: '등록된 이메일이 없습니다.' });
  }
  try {
    const ids = users.map((u) => u.id).join(', ');
    await sendEmail(
      email,
      '[절임배추 관리] 아이디 안내',
      `안녕하세요.\n\n요청하신 아이디는 "${ids}" 입니다.\n\n감사합니다.`
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || '이메일 발송 실패' });
  }
});

app.post('/api/send-reset-code', async (req, res) => {
  const { email } = req.body;
  const users = await findUsersByEmail(email);
  if (users.length === 0) {
    return res.status(404).json({ error: '등록된 이메일이 없습니다.' });
  }
  const code = generateCode(email);
  try {
    await sendEmail(
      email,
      '[절임배추 관리] 비밀번호 재설정 인증번호',
      `안녕하세요.\n\n비밀번호 재설정 인증번호는 "${code}" 입니다.\n\n30분 이내에 입력해주세요.`
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || '이메일 발송 실패' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  const users = await findUsersByEmail(email);
  if (users.length === 0) {
    return res.status(404).json({ error: '등록된 이메일이 없습니다.' });
  }
  if (!verifyCode(email, code)) {
    return res.status(400).json({ error: '인증번호가 올바르지 않거나 만료되었습니다.' });
  }
  const data = await loadAuthData();
  const { salt, hash } = hashPassword(newPassword);
  data.users = data.users.map((u) => {
    if (u.email !== email) return u;
    return { ...u, salt, hash };
  });
  await saveAuthData(data);
  res.json({ success: true });
});

app.post('/api/update-auth', async (req, res) => {
  const { currentId, currentPassword, newId, newPassword, email } = req.body;
  const data = await loadAuthData();
  const user = data.users.find((u) => u.id === currentId);
  if (!user) {
    return res.status(400).json({ error: '서버에 등록된 계정이 없습니다.' });
  }
  if (!verifyPassword(currentPassword, user.salt, user.hash)) {
    return res.status(403).json({ error: '현재 아이디 또는 비밀번호가 틀렸습니다.' });
  }
  if (newId && newId !== currentId && data.users.some((u) => u.id === newId)) {
    return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
  }
  if (email && email !== user.email && data.users.some((u) => u.email === email)) {
    return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
  }

  const idx = data.users.findIndex((u) => u.id === currentId);
  if (newId) data.users[idx].id = newId;
  if (email) data.users[idx].email = email;
  if (newPassword) {
    const { salt, hash } = hashPassword(newPassword);
    data.users[idx].salt = salt;
    data.users[idx].hash = hash;
  }
  await saveAuthData(data);
  res.json({ success: true, id: data.users[idx].id });
});

function getAuthHeader(apiKey, apiSecret) {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID();
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex');
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

app.post('/api/send-sms', async (req, res) => {
  const { recipients, message } = req.body;
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const senderKey = process.env.SOLAPI_SENDER_KEY;

  if (!apiKey || !apiSecret || !senderKey) {
    return res.status(500).json({ error: '서버 환경변수가 설정되지 않았습니다.' });
  }

  const validRecipients = recipients
    .map((p) => String(p).replace(/\D/g, ''))
    .filter(Boolean);

  if (validRecipients.length === 0) {
    return res.status(400).json({ error: '유효한 전화번호가 없습니다.' });
  }

  try {
    const response = await fetch('https://api.solapi.com/messages/v4/send-many/detail', {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(apiKey, apiSecret),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: validRecipients.map((phone) => ({
          to: phone,
          text: message,
          type: 'CTA',
          kakaoOptions: {
            pfId: senderKey,
          },
        })),
      }),
    });

    const result = await response.json();
    return res.json({ success: true, sent: validRecipients.length, result });
  } catch (err) {
    return res.status(500).json({ error: err.message || '알 수 없는 오류' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;

runAdminMigration().then(() => {
  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
});
