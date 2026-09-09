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

async function ensureDataDir() {
  await fs.mkdir(path.dirname(AUTH_FILE), { recursive: true });
}

async function loadServerAuth() {
  try {
    const raw = await fs.readFile(AUTH_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveServerAuth(auth) {
  await ensureDataDir();
  await fs.writeFile(AUTH_FILE, JSON.stringify(auth, null, 2));
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
  // 이전 30분 슬롯도 허용
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

app.post('/api/register', async (req, res) => {
  const { id, password, email } = req.body;
  if (!id || !password || !email) {
    return res.status(400).json({ error: '아이디, 비밀번호, 이메일을 모두 입력해주세요.' });
  }
  const existing = await loadServerAuth();
  const role = existing ? 'user' : 'admin';
  const { salt, hash } = hashPassword(password);
  await saveServerAuth({ id, salt, hash, email, role });
  res.json({ success: true, role });
});

app.post('/api/find-id', async (req, res) => {
  const { email } = req.body;
  const auth = await loadServerAuth();
  if (!auth || auth.email !== email) {
    return res.status(404).json({ error: '등록된 이메일이 없습니다.' });
  }
  try {
    await sendEmail(
      auth.email,
      '[절임배추 관리] 아이디 안내',
      `안녕하세요.\n\n요청하신 아이디는 "${auth.id}" 입니다.\n\n감사합니다.`
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || '이메일 발송 실패' });
  }
});

app.post('/api/send-reset-code', async (req, res) => {
  const { email } = req.body;
  const auth = await loadServerAuth();
  if (!auth || auth.email !== email) {
    return res.status(404).json({ error: '등록된 이메일이 없습니다.' });
  }
  const code = generateCode(email);
  try {
    await sendEmail(
      auth.email,
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
  const auth = await loadServerAuth();
  if (!auth || auth.email !== email) {
    return res.status(404).json({ error: '등록된 이메일이 없습니다.' });
  }
  if (!verifyCode(email, code)) {
    return res.status(400).json({ error: '인증번호가 올바르지 않거나 만료되었습니다.' });
  }
  const { salt, hash } = hashPassword(newPassword);
  await saveServerAuth({ ...auth, salt, hash });
  res.json({ success: true });
});

app.post('/api/update-auth', async (req, res) => {
  const { currentId, currentPassword, newId, newPassword, email } = req.body;
  const auth = await loadServerAuth();
  if (!auth) {
    return res.status(400).json({ error: '서버에 등록된 계정이 없습니다.' });
  }
  if (currentId !== auth.id || !verifyPassword(currentPassword, auth.salt, auth.hash)) {
    return res.status(403).json({ error: '현재 아이디 또는 비밀번호가 틀렸습니다.' });
  }
  const next = { ...auth, id: newId || auth.id, email: email || auth.email };
  if (newPassword) {
    const { salt, hash } = hashPassword(newPassword);
    next.salt = salt;
    next.hash = hash;
  }
  await saveServerAuth(next);
  res.json({ success: true, id: next.id });
});

app.get('/api/auth-info', async (_req, res) => {
  const auth = await loadServerAuth();
  if (!auth) return res.json(null);
  res.json({ id: auth.id, email: auth.email, role: auth.role || 'admin' });
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
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
