import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiClient.post('/admin/login', { password });
      localStorage.setItem('admin_token', res.data.token);
      navigate('/admin');
    } catch (err) {
      setError('密碼錯誤');
    }
  };

  return (
    <div className="container card" style={{ maxWidth: 400, marginTop: 40 }}>
      <h2>管理員登入</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label>管理密碼</label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="danger" style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div>}
        <button className="btn" type="submit">登入</button>
      </form>
    </div>
  );
}
