import React, { useMemo, useState } from 'react';
import { Customer, Order } from '../types';
import { load, save } from '../lib/storage';

const CUSTOMERS_KEY = 'jeolim-cabbage-customers-v1';

export function loadCustomers(): Customer[] {
  return load(CUSTOMERS_KEY, []);
}

export function saveCustomers(customers: Customer[]) {
  save(CUSTOMERS_KEY, customers);
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

export default function Customers({ orders }: { orders: Order[] }) {
  const [customers, setCustomers] = useState<Customer[]>(() => loadCustomers());
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Customer, 'id' | 'createdAt'>>({
    name: '',
    phone: '',
    address: '',
    memo: '',
  });

  const filtered = useMemo(() => {
    const term = search.trim();
    return customers
      .filter((c) =>
        term
          ? c.name.includes(term) ||
            c.phone.includes(term) ||
            c.address.includes(term) ||
            c.memo.includes(term)
          : true
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [customers, search]);

  const orderCounts = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => {
      const phone = o.phone.replace(/\D/g, '');
      if (!phone) return;
      map.set(phone, (map.get(phone) || 0) + 1);
    });
    return map;
  }, [orders]);

  function resetForm() {
    setForm({ name: '', phone: '', address: '', memo: '' });
    setEditingId(null);
  }

  function openNewForm() {
    resetForm();
    setIsFormOpen(true);
  }

  function startEdit(customer: Customer) {
    setForm({
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      memo: customer.memo,
    });
    setEditingId(customer.id);
    setIsFormOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('고객명을 입력해주세요.');
      return;
    }
    if (editingId) {
      const updated = customers.map((c) =>
        c.id === editingId ? { ...c, ...form } : c
      );
      setCustomers(updated);
      saveCustomers(updated);
    } else {
      const newCustomer: Customer = {
        ...form,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      const updated = [...customers, newCustomer];
      setCustomers(updated);
      saveCustomers(updated);
    }
    resetForm();
    setIsFormOpen(false);
  }

  function removeCustomer(id: string) {
    if (confirm('이 고객을 삭제할까요?')) {
      const updated = customers.filter((c) => c.id !== id);
      setCustomers(updated);
      saveCustomers(updated);
    }
  }

  return (
    <div className='customer-shell'>
      <header className='app-header'>
        <div>
          <p className='eyebrow'>절임배추 관리</p>
          <h1>고객 관리</h1>
        </div>
        <div className='header-actions'>
          <button className='btn btn-primary' onClick={openNewForm}>
            + 새 고객
          </button>
        </div>
      </header>

      <section className='toolbar'>
        <input
          type='text'
          className='input search'
          placeholder='이름, 연락처, 주소, 메모 검색'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </section>

      {isFormOpen && (
        <section className='panel form-panel'>
          <h2>{editingId ? '고객 수정' : '새 고객 등록'}</h2>
          <form onSubmit={handleSubmit}>
            <div className='form-grid'>
              <label>
                고객명
                <input
                  className='input'
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder='홍길동'
                />
              </label>
              <label>
                연락처
                <input
                  className='input'
                  type='tel'
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: formatPhone(e.target.value) })
                  }
                  placeholder='010-0000-0000'
                  maxLength={13}
                />
              </label>
              <label className='full'>
                주소
                <input
                  className='input'
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder='배송 주소'
                />
              </label>
              <label className='full'>
                메모
                <input
                  className='input'
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  placeholder='특이사항'
                />
              </label>
            </div>
            <div className='form-actions'>
              <button
                type='button'
                className='btn'
                onClick={() => setIsFormOpen(false)}
              >
                취소
              </button>
              <button type='submit' className='btn btn-primary'>
                {editingId ? '수정 저장' : '고객 등록'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className='customer-list'>
        {filtered.length === 0 ? (
          <div className='empty'>등록된 고객이 없습니다.</div>
        ) : (
          filtered.map((customer) => {
            const phoneDigits = customer.phone.replace(/\D/g, '');
            const orderCount = orderCounts.get(phoneDigits) || 0;
            return (
              <article key={customer.id} className='customer-card'>
                <div className='customer-row head'>
                  <div className='customer-meta'>
                    <span className='customer-name'>{customer.name}</span>
                    <span className='customer-phone'>
                      {customer.phone || '연락처 없음'}
                    </span>
                    {orderCount > 0 && (
                      <span className='tag highlight'>{orderCount}건 주문</span>
                    )}
                  </div>
                  <div className='customer-actions'>
                    <button
                      className='btn icon'
                      onClick={() => startEdit(customer)}
                      title='수정'
                    >
                      ✎
                    </button>
                    <button
                      className='btn icon danger'
                      onClick={() => removeCustomer(customer.id)}
                      title='삭제'
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {customer.address && (
                  <p className='customer-address'>{customer.address}</p>
                )}
                {customer.memo && (
                  <p className='customer-memo'>{customer.memo}</p>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
