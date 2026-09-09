import React, { useState } from 'react';
import { load } from '../lib/storage';

const AUTH_SESSION_KEY = 'jeolim-auth-session';
const AUTH_KEY = 'jeolim-cabbage-auth-v1';

export function isLoggedIn() {
  return sessionStorage.getItem(AUTH_SESSION_KEY) === '1';
}

export function logout() {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
}

export function getStoredPassword(): string {
  const auth = load(AUTH_KEY, { password: '0000' });
  return auth.password;
}

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === getStoredPassword()) {
      sessionStorage.setItem(AUTH_SESSION_KEY, '1');
      onLogin();
    } else {
      setError('비밀번호가 틀렸습니다.');
    }
  }

  return (
    <div className='login-overlay'>
      <div className='login-box panel'>
        <h1>절임배추 관리</h1>
        <p>관리자 로그인</p>
        <form onSubmit={handleSubmit}>
          <input
            type='password'
            className='input'
            placeholder='비밀번호'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className='login-error'>{error}</p>}
          <button type='submit' className='btn btn-primary full'>
            로그인
          </button>
        </form>
        <p className='login-hint'>초기 비밀번호: 0000</p>
      </div>
    </div>
  );
}
