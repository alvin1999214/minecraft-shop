import React, { useState } from 'react';
import apiClient from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function ChangePasswordPage() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError('請填寫所有欄位');
      return;
    }

    if (form.newPassword.length < 6) {
      setError('新密碼至少需要6個字符');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('兩次輸入的新密碼不一致');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await apiClient.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess('密碼修改成功！3秒後返回商店');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        navigate('/products');
      }, 3000);
    } catch (e) {
      setError(e.response?.data?.error || '密碼修改失敗');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: 40,
        maxWidth: 480,
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <h2 style={{
          margin: '0 0 8px',
          fontSize: 28,
          fontWeight: 700,
          color: '#1e293b',
          textAlign: 'center',
        }}>
          🔒 修改密碼
        </h2>
        <p style={{
          margin: '0 0 32px',
          fontSize: 14,
          color: '#64748b',
          textAlign: 'center',
        }}>
          請輸入當前密碼和新密碼
        </p>

        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#dc2626',
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: '#d1fae5',
            color: '#059669',
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 14,
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              marginBottom: 8,
              fontSize: 14,
              fontWeight: 600,
              color: '#334155',
            }}>
              當前密碼
            </label>
            <input
              type="password"
              name="currentPassword"
              value={form.currentPassword}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: 12,
                border: '2px solid #e2e8f0',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                transition: 'border 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              marginBottom: 8,
              fontSize: 14,
              fontWeight: 600,
              color: '#334155',
            }}>
              新密碼
            </label>
            <input
              type="password"
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: 12,
                border: '2px solid #e2e8f0',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                transition: 'border 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
            <p style={{
              margin: '4px 0 0',
              fontSize: 12,
              color: '#64748b',
            }}>
              至少6個字符
            </p>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block',
              marginBottom: 8,
              fontSize: 14,
              fontWeight: 600,
              color: '#334155',
            }}>
              確認新密碼
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: 12,
                border: '2px solid #e2e8f0',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                transition: 'border 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              padding: 14,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: 12,
            }}
          >
            確認修改
          </button>

          <button
            type="button"
            onClick={() => navigate('/products')}
            style={{
              width: '100%',
              padding: 14,
              background: '#f1f5f9',
              color: '#64748b',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            返回商店
          </button>
        </form>
      </div>
    </div>
  );
}
