import React, { useState } from 'react';
import { load, save } from '../lib/storage';

const AUTH_KEY = 'jeolim-cabbage-auth-v1';
const ORDERS_KEY = 'jeolim-cabbage-orders-v3';
const CUSTOMERS_KEY = 'jeolim-cabbage-customers-v1';
const PRODUCTS_KEY = 'jeolim-cabbage-products-v1';

export function getStoredPassword(): string {
  const auth = load(AUTH_KEY, { password: '0000' });
  return auth.password;
}

export function setStoredPassword(password: string) {
  save(AUTH_KEY, { password });
}

export default function Admin() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    if (current !== getStoredPassword()) {
      setMessage('현재 비밀번호가 틀렸습니다.');
      return;
    }
    if (!next.trim()) {
      setMessage('새 비밀번호를 입력해주세요.');
      return;
    }
    if (next !== confirmPassword) {
      setMessage('새 비밀번호와 확인이 일치하지 않습니다.');
      return;
    }
    setStoredPassword(next);
    setCurrent('');
    setNext('');
    setConfirmPassword('');
    setMessage('비밀번호가 변경되었습니다.');
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
        <h2>비밀번호 변경</h2>
        <form onSubmit={handlePasswordChange} className='admin-form'>
          <label>
            현재 비밀번호
            <input
              type='password'
              className='input'
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder='현재 비밀번호'
            />
          </label>
          <label>
            새 비밀번호
            <input
              type='password'
              className='input'
              value={next}
              onChange={(e) => setNext(e.target.value)}
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
          {message && <p className='admin-message'>{message}</p>}
          <button type='submit' className='btn btn-primary'>
            비밀번호 변경
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
