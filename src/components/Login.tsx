import React, { useState } from 'react';
import { load } from '../lib/storage';

const AUTH_SESSION_KEY = 'jeolim-auth-session';
const AUTH_KEY = 'jeolim-cabbage-auth-v1';

export type AuthCredentials = {
  id: string;
  password: string;
};

export function isLoggedIn() {
  return sessionStorage.getItem(AUTH_SESSION_KEY) === '1';
}

export function logout() {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
}

export function getStoredCredentials(): AuthCredentials {
  return load(AUTH_KEY, { id: 'admin', password: '0000' });
}

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const auth = getStoredCredentials();
    if (id === auth.id && password === auth.password) {
      sessionStorage.setItem(AUTH_SESSION_KEY, '1');
      onLogin();
    } else {
      setError('아이디 또는 비밀번호가 틀렸습니다.');
    }
  }

  return (
    <div className='login-overlay'>
      <div className='login-box panel'>
        <h1>절임배추 관리</h1>
        <p>관리자 로그인</p>
        <form onSubmit={handleSubmit}>
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
          <button type='submit' className='btn btn-primary full'>
            로그인
          </button>
        </form>
        <p className='login-hint'>초기 아이디: admin / 비밀번호: 0000</p>
      </div>
    </div>
  );
}
