import React, { useEffect, useState } from 'react';
import { load, save } from '../lib/storage';
import {
  activateUser,
  deactivateUser,
  deleteUser,
  demoteUser,
  fetchUsers,
  promoteUser,
  updateServerAuth,
} from '../lib/api';

const AUTH_USER_KEY = 'jeolim-auth-user-v1';
const ORDERS_KEY = 'jeolim-cabbage-orders-v3';
const CUSTOMERS_KEY = 'jeolim-cabbage-customers-v1';
const PRODUCTS_KEY = 'jeolim-cabbage-products-v1';

export type AdminAuth = {
  id: string;
  password: string;
  email: string;
};

export function getStoredUser() {
  return load(AUTH_USER_KEY, null);
}

export function setStoredUser(user: { id: string; role: string; email: string }) {
  save(AUTH_USER_KEY, user);
}

export default function Admin() {
  const [currentUser] = useState(() => getStoredUser() || { id: '', role: 'admin', email: '' });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newId, setNewId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const [users, setUsers] = useState<
    { id: string; email: string; role: string; active: boolean; createdAt: string }[]
  >([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    loadUserList();
  }, []);

  async function loadUserList() {
    setLoadingUsers(true);
    try {
      const list = await fetchUsers();
      setUsers(list);
    } catch (err: any) {
      setMessage(err.message || '사용자 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleCredentialsChange(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    if (!currentUser) {
      setMessage('로그인 정보가 없습니다.');
      return;
    }
    if (!currentPassword.trim()) {
      setMessage('현재 비밀번호를 입력해주세요.');
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
      await updateServerAuth(currentUser.id, currentPassword, newId, newPassword, email);
      setStoredUser({ id: newId, role: currentUser.role, email });
      setCurrentPassword('');
      setNewId('');
      setNewPassword('');
      setConfirmPassword('');
      setEmail('');
      setMessage('아이디, 비밀번호, 이메일이 변경되었습니다.');
      loadUserList();
    } catch (err: any) {
      setMessage(err.message || '서버 연동 중 오류가 발생했습니다.');
    }
  }

  async function toggleActive(user: typeof users[number]) {
    try {
      if (user.active) {
        await deactivateUser(user.id);
      } else {
        await activateUser(user.id);
      }
      loadUserList();
    } catch (err: any) {
      setMessage(err.message || '상태 변경 실패');
    }
  }

  async function promote(user: typeof users[number]) {
    try {
      await promoteUser(user.id);
      loadUserList();
    } catch (err: any) {
      setMessage(err.message || '관리자 임명 실패');
    }
  }

  async function demote(user: typeof users[number]) {
    try {
      await demoteUser(user.id);
      loadUserList();
    } catch (err: any) {
      setMessage(err.message || '일반 사용자로 변경 실패');
    }
  }

  async function removeUser(user: typeof users[number]) {
    if (!confirm(`'${user.id}' 계정을 삭제할까요?`)) return;
    try {
      await deleteUser(user.id);
      loadUserList();
    } catch (err: any) {
      setMessage(err.message || '삭제 실패');
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

      <section className='panel'>
        <div className='admin-section-header'>
          <h2>회원 관리</h2>
          <button className='btn' onClick={loadUserList} disabled={loadingUsers}>
            {loadingUsers ? '불러오는 중...' : '새로고침'}
          </button>
        </div>
        <p className='panel-hint'>
          회원가입한 사용자는 기본적으로 비활성화 상태입니다. 관리자가 승인(활성화)해야
          로그인할 수 있습니다.
        </p>

        {users.length === 0 ? (
          <div className='empty'>등록된 회원이 없습니다.</div>
        ) : (
          <div className='user-list'>
            {users.map((user) => (
              <div key={user.id} className={`user-row ${user.active ? 'active' : 'inactive'}`}>
                <div className='user-info'>
                  <span className='user-id'>{user.id}</span>
                  <span className='user-email'>{user.email}</span>
                  <span className={`tag ${user.role === 'admin' ? 'highlight' : ''}`}>
                    {user.role === 'admin' ? '관리자' : '사용자'}
                  </span>
                  <span className={`tag ${user.active ? 'payment-완납' : 'payment-미납'}`}>
                    {user.active ? '활성' : '비활성'}
                  </span>
                </div>
                <div className='user-actions'>
                  {user.role !== 'admin' && (
                    <button
                      className={`btn ${user.active ? '' : 'btn-primary'}`}
                      onClick={() => toggleActive(user)}
                    >
                      {user.active ? '비활성화' : '활성화'}
                    </button>
                  )}
                  {user.role !== 'admin' && (
                    <button className='btn btn-primary' onClick={() => promote(user)}>
                      관리자 임명
                    </button>
                  )}
                  {user.role === 'admin' && user.id !== 'admin' && (
                    <button className='btn' onClick={() => demote(user)}>
                      사용자로 변경
                    </button>
                  )}
                  {user.id !== currentUser.id && (
                    <button
                      className='btn icon danger'
                      onClick={() => removeUser(user)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
