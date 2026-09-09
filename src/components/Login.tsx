import React, { useState } from 'react';
import { load, save } from '../lib/storage';
import {
  fetchAuthInfo,
  findIdByEmail,
  registerAccount,
  resetPassword,
  sendResetCode,
} from '../lib/api';

const AUTH_SESSION_KEY = 'jeolim-auth-session';
const AUTH_ROLE_KEY = 'jeolim-auth-role';
const AUTH_KEY = 'jeolim-cabbage-auth-v1';

export type AuthCredentials = {
  id: string;
  password: string;
  email: string;
};

export function isLoggedIn() {
  return sessionStorage.getItem(AUTH_SESSION_KEY) === '1';
}

export function logout() {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  sessionStorage.removeItem(AUTH_ROLE_KEY);
}

export function getStoredCredentials(): AuthCredentials {
  return load(AUTH_KEY, { id: 'admin', password: '0000', email: '' });
}

export function setStoredCredentials(auth: AuthCredentials) {
  save(AUTH_KEY, auth);
}

export function isAdmin(): boolean {
  return sessionStorage.getItem(AUTH_ROLE_KEY) === 'admin';
}

type LoginMode = 'login' | 'signup' | 'find';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<LoginMode>('login');

  // 로그인
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');

  // 회원가입
  const [signupId, setSignupId] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [signupEmail, setSignupEmail] = useState('');

  // 찾기
  const [findType, setFindType] = useState<'id' | 'password'>('id');
  const [findEmail, setFindEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function resetMessages() {
    setError('');
    setSuccess('');
  }

  function switchMode(next: LoginMode) {
    setMode(next);
    resetMessages();
    setCodeSent(false);
    setCode('');
    setNewPassword('');
    setNewPasswordConfirm('');
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    const auth = getStoredCredentials();
    if (id === auth.id && password === auth.password) {
      sessionStorage.setItem(AUTH_SESSION_KEY, '1');
      fetchAuthInfo().then((info) => {
        sessionStorage.setItem(AUTH_ROLE_KEY, info?.role === 'admin' ? 'admin' : 'user');
      }).catch(() => {
        sessionStorage.setItem(AUTH_ROLE_KEY, 'admin');
      }).finally(() => {
        onLogin();
      });
    } else {
      setError('아이디 또는 비밀번호가 틀렸습니다.');
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    if (!signupId.trim()) {
      setError('아이디를 입력해주세요.');
      return;
    }
    if (!signupPassword.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }
    if (signupPassword !== signupConfirm) {
      setError('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    if (!signupEmail.trim() || !signupEmail.includes('@')) {
      setError('올바른 이메일을 입력해주세요.');
      return;
    }
    try {
      await registerAccount(signupId, signupPassword, signupEmail);
      setStoredCredentials({
        id: signupId,
        password: signupPassword,
        email: signupEmail,
      });
      setSuccess('회원가입이 완료되었습니다. 로그인해주세요.');
      setMode('login');
      setId(signupId);
      setSignupId('');
      setSignupPassword('');
      setSignupConfirm('');
      setSignupEmail('');
    } catch (err: any) {
      setError(err.message || '회원가입 중 오류가 발생했습니다.');
    }
  }

  async function handleSendCode(e?: React.FormEvent) {
    e?.preventDefault();
    resetMessages();
    if (!findEmail.trim() || !findEmail.includes('@')) {
      setError('올바른 이메일을 입력해주세요.');
      return;
    }
    setSending(true);
    try {
      if (findType === 'id') {
        await findIdByEmail(findEmail);
        setSuccess('아이디를 이메일로 발송했습니다. 메일함을 확인해주세요.');
      } else {
        await sendResetCode(findEmail);
        setCodeSent(true);
        setSuccess('인증번호를 이메일로 발송했습니다. 메일함을 확인해주세요.');
      }
    } catch (err: any) {
      setError(err.message || '이메일 발송 중 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    if (!code.trim()) {
      setError('인증번호를 입력해주세요.');
      return;
    }
    if (!newPassword.trim()) {
      setError('새 비밀번호를 입력해주세요.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError('새 비밀번호와 확인이 일치하지 않습니다.');
      return;
    }
    try {
      await resetPassword(findEmail, code, newPassword);
      setStoredCredentials({
        id: getStoredCredentials().id,
        password: newPassword,
        email: findEmail,
      });
      setSuccess('비밀번호가 재설정되었습니다. 로그인해주세요.');
      setMode('login');
      setFindEmail('');
      setCode('');
      setNewPassword('');
      setNewPasswordConfirm('');
      setCodeSent(false);
    } catch (err: any) {
      setError(err.message || '비밀번호 재설정 중 오류가 발생했습니다.');
    }
  }

  const auth = getStoredCredentials();
  const hasAccount = auth.id !== 'admin' || auth.password !== '0000' || auth.email;

  return (
    <div className='login-overlay'>
      <div className='login-box panel'>
        <h1>절임배추 관리</h1>
        <p>
          관리자{' '}
          {mode === 'login'
            ? '로그인'
            : mode === 'signup'
            ? '회원가입'
            : '아이디·비밀번호 찾기'}
        </p>

        <div className='login-tabs'>
          <button
            className={`btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >
            로그인
          </button>
          <button
            className={`btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            회원가입
          </button>
          <button
            className={`btn ${mode === 'find' ? 'active' : ''}`}
            onClick={() => switchMode('find')}
          >
            ID/PW 찾기
          </button>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <input
              type='text'
              className='input'
              placeholder='아이디'
              value={id}
              onChange={(e) => setId(e.target.value)}
              autoFocus
            />
            <input
              type='password'
              className='input'
              placeholder='비밀번호'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className='login-error'>{error}</p>}
            {success && <p className='login-success'>{success}</p>}
            <button type='submit' className='btn btn-primary full'>
              로그인
            </button>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignup}>
            {hasAccount && (
              <p className='login-warning'>
                ⚠ 이미 등록된 계정이 있습니다. 새로 가입하면 기존 계정이
                교첵됩니다.
              </p>
            )}
            <input
              type='text'
              className='input'
              placeholder='아이디'
              value={signupId}
              onChange={(e) => setSignupId(e.target.value)}
              autoFocus
            />
            <input
              type='password'
              className='input'
              placeholder='비밀번호'
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
            />
            <input
              type='password'
              className='input'
              placeholder='비밀번호 확인'
              value={signupConfirm}
              onChange={(e) => setSignupConfirm(e.target.value)}
            />
            <input
              type='email'
              className='input'
              placeholder='이메일 (아이디/비밀번호 찾기용)'
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
            />
            {error && <p className='login-error'>{error}</p>}
            {success && <p className='login-success'>{success}</p>}
            <button type='submit' className='btn btn-primary full'>
              회원가입
            </button>
          </form>
        )}

        {mode === 'find' && (
          <form onSubmit={findType === 'id' ? handleSendCode : handleResetPassword}>
            <div className='find-type'>
              <label>
                <input
                  type='radio'
                  name='findType'
                  checked={findType === 'id'}
                  onChange={() => setFindType('id')}
                />
                아이디 찾기
              </label>
              <label>
                <input
                  type='radio'
                  name='findType'
                  checked={findType === 'password'}
                  onChange={() => setFindType('password')}
                />
                비밀번호 재설정
              </label>
            </div>

            <input
              type='email'
              className='input'
              placeholder='가입한 이메일'
              value={findEmail}
              onChange={(e) => setFindEmail(e.target.value)}
              autoFocus
            />

            {findType === 'id' && (
              <>
                {error && <p className='login-error'>{error}</p>}
                {success && <p className='login-success'>{success}</p>}
                <button
                  type='button'
                  className='btn btn-primary full'
                  onClick={() => handleSendCode()}
                  disabled={sending}
                >
                  {sending ? '발송 중...' : '아이디 이메일로 받기'}
                </button>
              </>
            )}

            {findType === 'password' && (
              <>
                {!codeSent ? (
                  <button
                    type='button'
                    className='btn btn-primary full'
                    onClick={() => handleSendCode()}
                    disabled={sending}
                  >
                    {sending ? '발송 중...' : '인증번호 받기'}
                  </button>
                ) : (
                  <>
                    <input
                      type='text'
                      className='input'
                      placeholder='이메일로 받은 인증번호'
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                    <input
                      type='password'
                      className='input'
                      placeholder='새 비밀번호'
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <input
                      type='password'
                      className='input'
                      placeholder='새 비밀번호 확인'
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    />
                    <button
                      type='button'
                      className='btn full'
                      onClick={() => handleSendCode()}
                      disabled={sending}
                    >
                      {sending ? '발송 중...' : '인증번호 재발송'}
                    </button>
                  </>
                )}
                {error && <p className='login-error'>{error}</p>}
                {success && <p className='login-success'>{success}</p>}
                {codeSent && (
                  <button type='submit' className='btn btn-primary full'>
                    비밀번호 재설정
                  </button>
                )}
              </>
            )}
          </form>
        )}

        <p className='login-hint'>
          {mode === 'login'
            ? '초기 아이디: admin / 비밀번호: 0000'
            : '모든 정보는 이 브라우저와 서버에 저장됩니다.'}
        </p>
      </div>
    </div>
  );
}
