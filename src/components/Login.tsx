import React, { useState } from 'react';
import { load, save } from '../lib/storage';

const AUTH_SESSION_KEY = 'jeolim-auth-session';
const AUTH_KEY = 'jeolim-cabbage-auth-v1';

export type AuthCredentials = {
  id: string;
  password: string;
  question: string;
  answer: string;
};

export function isLoggedIn() {
  return sessionStorage.getItem(AUTH_SESSION_KEY) === '1';
}

export function logout() {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
}

export function getStoredCredentials(): AuthCredentials {
  return load(AUTH_KEY, { id: 'admin', password: '0000', question: '', answer: '' });
}

export function setStoredCredentials(auth: AuthCredentials) {
  save(AUTH_KEY, auth);
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
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  // 찾기
  const [findType, setFindType] = useState<'id' | 'password'>('id');
  const [findId, setFindId] = useState('');
  const [findAnswer, setFindAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function resetMessages() {
    setError('');
    setSuccess('');
  }

  function switchMode(next: LoginMode) {
    setMode(next);
    resetMessages();
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    const auth = getStoredCredentials();
    if (id === auth.id && password === auth.password) {
      sessionStorage.setItem(AUTH_SESSION_KEY, '1');
      onLogin();
    } else {
      setError('아이디 또는 비밀번호가 틀렸습니다.');
    }
  }

  function handleSignup(e: React.FormEvent) {
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
    if (!question.trim() || !answer.trim()) {
      setError('아이디/비밀번호 찾기용 질문과 답변을 입력해주세요.');
      return;
    }
    setStoredCredentials({
      id: signupId,
      password: signupPassword,
      question,
      answer,
    });
    setSuccess('회원가입이 완료되었습니다. 로그인해주세요.');
    setMode('login');
    setId(signupId);
    setSignupId('');
    setSignupPassword('');
    setSignupConfirm('');
    setQuestion('');
    setAnswer('');
  }

  function handleFind(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    const auth = getStoredCredentials();
    if (!auth.question || !auth.answer) {
      setError('등록된 본인확인 질문이 없습니다. 관리자에게 문의하세요.');
      return;
    }
    if (findAnswer.trim().toLowerCase() !== auth.answer.trim().toLowerCase()) {
      setError('질문의 답변이 일치하지 않습니다.');
      return;
    }
    if (findType === 'id') {
      setSuccess(`아이디는 "${auth.id}" 입니다.`);
      return;
    }
    // 비밀번호 재설정
    if (findId.trim() !== auth.id) {
      setError('아이디가 일치하지 않습니다.');
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
    setStoredCredentials({ ...auth, password: newPassword });
    setSuccess('비밀번호가 재설정되었습니다. 로그인해주세요.');
    setMode('login');
    setFindId('');
    setFindAnswer('');
    setNewPassword('');
    setNewPasswordConfirm('');
  }

  const auth = getStoredCredentials();
  const hasAccount = auth.id !== 'admin' || auth.password !== '0000' || auth.question;

  return (
    <div className='login-overlay'>
      <div className='login-box panel'>
        <h1>절임배추 관리</h1>
        <p>관리자 {mode === 'login' ? '로그인' : mode === 'signup' ? '회원가입' : '아이디·비밀번호 찾기'}</p>

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
                ⚠ 이미 등록된 계정이 있습니다. 새로 가입하면 기존 계정이 교체됩니다.
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
              type='text'
              className='input'
              placeholder='본인확인 질문 (예: 출생지는?)'
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <input
              type='text'
              className='input'
              placeholder='본인확인 답변'
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            {error && <p className='login-error'>{error}</p>}
            <button type='submit' className='btn btn-primary full'>
              회원가입
            </button>
          </form>
        )}

        {mode === 'find' && (
          <form onSubmit={handleFind}>
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

            {findType === 'password' && (
              <input
                type='text'
                className='input'
                placeholder='아이디'
                value={findId}
                onChange={(e) => setFindId(e.target.value)}
              />
            )}

            <div className='find-question'>
              <strong>본인확인 질문</strong>
              <p>{auth.question || '등록된 질문이 없습니다.'}</p>
            </div>

            <input
              type='text'
              className='input'
              placeholder='본인확인 답변'
              value={findAnswer}
              onChange={(e) => setFindAnswer(e.target.value)}
              autoFocus
            />

            {findType === 'password' && (
              <>
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
              </>
            )}

            {error && <p className='login-error'>{error}</p>}
            {success && <p className='login-success'>{success}</p>}
            <button type='submit' className='btn btn-primary full'>
              {findType === 'id' ? '아이디 찾기' : '비밀번호 재설정'}
            </button>
          </form>
        )}

        <p className='login-hint'>
          {mode === 'login'
            ? '초기 아이디: admin / 비밀번호: 0000'
            : '모든 정보는 이 브라우저에만 저장됩니다.'}
        </p>
      </div>
    </div>
  );
}
