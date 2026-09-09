import React, { useState } from 'react';
import { load, save } from '../lib/storage';
import { updateServerAuth } from '../lib/api';

const AUTH_KEY = 'jeolim-cabbage-auth-v1';
const ORDERS_KEY = 'jeolim-cabbage-orders-v3';
const CUSTOMERS_KEY = 'jeolim-cabbage-customers-v1';
const PRODUCTS_KEY = 'jeolim-cabbage-products-v1';

export type AdminAuth = {
  id: string;
  password: string;
  email: string;
};

export function getStoredCredentials(): AdminAuth {
  return load(AUTH_KEY, { id: 'admin', password: '0000', email: '' });
}

export function setStoredCredentials(credentials: AdminAuth) {
  save(AUTH_KEY, credentials);
}

export default function Admin() {
  const [currentId, setCurrentId] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newId, setNewId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  async function handleCredentialsChange(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    const auth = getStoredCredentials();
    if (currentId !== auth.id || currentPassword !== auth.password) {
      setMessage('현재 아이디 또는 비밀번호가 틀렸습니다.');
      return;
    }
    if (!newId.trim()) {
      setMessage('새 아이디를 입력해주세요.');
      return;
    }
    if (!newPassword.trim()) {
      setMessage('새 비밀번호를 입력해주세요.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('새 비밀번호와 확인이 일치하지 않습니다.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setMessage('올바른 이메일을 입력해주세요.');
      return;
    }

    try {
      await updateServerAuth(currentId, currentPassword, newId, newPassword, email);
      setStoredCredentials({ id: newId, password: newPassword, email });
      setCurrentId('');
      setCurrentPassword('');
      setNewId('');
      setNewPassword('');
      setConfirmPassword('');
      setEmail('');
      setMessage('아이디, 비밀번호, 이메일이 변경되었습니다.');
    } catch (err: any) {
      setMessage(err.message || '서버 연동 중 오류가 발생했습니다.');
    }
  }

  function clearAllData() {
    if (
      confirm(
        '정말 모든 데이터를 삭제할까요?\n주문, 고객, 품목 설정이 모두 사라집니다.'
      )
    ) {
      localStorage.removeItem(ORDERS_KEY);
      localStorage.removeItem(CUSTOMERS_KEY);
      localStorage.removeItem(PRODUCTS_KEY);
      alert('모든 데이터가 삭제되었습니다. 페이지를 새로고침합니다.');
      window.location.reload();
    }
  }

  return (
    <div className='admin-shell'>
      <header className='app-header'>
        <div>
          <p className='eyebrow'>절임배추 관리</p>
          <h1>관리자 설정</h1>
        </div>
      </header>

      <section className='panel'>
        <h2>아이디 / 비밀번호 / 이메일 변경</h2>
        <form onSubmit={handleCredentialsChange} className='admin-form'>
          <label>
            현재 아이디
            <input
              type='text'
              className='input'
              value={currentId}
              onChange={(e) => setCurrentId(e.target.value)}
              placeholder='현재 아이디'
            />
          </label>
          <label>
            현재 비밀번호
            <input
              type='password'
              className='input'
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder='현재 비밀번호'
            />
          </label>
          <label>
            새 아이디
            <input
              type='text'
              className='input'
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder='새 아이디'
            />
          </label>
          <label>
            새 비밀번호
            <input
              type='password'
              className='input'
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder='새 비밀번호'
            />
          </label>
          <label>
            새 비밀번호 확인
            <input
              type='password'
              className='input'
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder='새 비밀번호 확인'
            />
          </label>
          <label>
            이메일 (ID/PW 찾기용)
            <input
              type='email'
              className='input'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='이메일'
            />
          </label>
          {message && <p className='admin-message'>{message}</p>}
          <button type='submit' className='btn btn-primary'>
            변경 저장
          </button>
        </form>
      </section>

      <section className='panel danger-panel'>
        <h2>데이터 초기화</h2>
        <p>
          모든 주문, 고객, 품목 설정 데이터를 삭제합니다. 삭제 후에는 복구할 수
          없으므로 신중하게 사용하세요.
        </p>
        <button className='btn btn-danger' onClick={clearAllData}>
          ⚠ 모든 데이터 삭제
        </button>
      </section>
    </div>
  );
}
