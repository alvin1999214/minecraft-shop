import React from 'react'
import { Link } from 'react-router-dom'
import { useCurrency } from '../contexts/CurrencyContext'

export default function NavBar({cartCount = 0}){
  const isAdmin = typeof window !== 'undefined' && localStorage.getItem('admin_token');
  const playerid = typeof window !== 'undefined' ? localStorage.getItem('playerid') : null;
  const { currency, supportedCurrencies, switchCurrency } = useCurrency();
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('playerid');
    window.location.href = '/';
  };
  
  const handleAdminLogout = () => {
    localStorage.removeItem('admin_token');
    window.location.href = '/';
  };
  
  const handleCurrencyChange = (e) => {
    switchCurrency(e.target.value);
    // Force page reload to update all prices and reset payment intents
    window.location.reload();
  };
  
  return (
    <nav className="nav">
      <div className="brand">
        <span className="brand-icon">⛏</span>
        <span>MC Shop</span>
      </div>

      <div className="links">
        <Link to="/" className="nav-link">商店</Link>
        <Link to="/orders" className="nav-link">訂單</Link>
        <Link to="/cart" className="nav-link">
          購物車{cartCount > 0 && ` (${cartCount})`}
        </Link>
        
        {/* Currency Selector */}
        <select 
          value={currency}
          onChange={handleCurrencyChange}
          className="nav-link"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            padding: '6px 10px',
            outline: 'none',
            transition: 'all 0.2s',
          }}
          title="選擇貨幣"
        >
          {supportedCurrencies.map(curr => (
            <option key={curr} value={curr}>
              💱 {curr}
            </option>
          ))}
        </select>
        
        {isAdmin ? (
          <>
            <Link to="/admin" className="nav-link">管理</Link>
            <span className="nav-link" style={{opacity:0.6}}>👤 管理員</span>
            <button 
              className="btn ghost" 
              style={{padding:'6px 14px',fontSize:12}} 
              onClick={handleAdminLogout}
            >
              登出
            </button>
          </>
        ) : playerid ? (
          <>
            <span className="nav-link" style={{opacity:0.6}}>{playerid}</span>
            <Link to="/change-password" className="nav-link" style={{fontSize:12}}>
              🔒 修改密碼
            </Link>
            <button 
              className="btn ghost" 
              style={{padding:'6px 14px',fontSize:12}} 
              onClick={handleLogout}
            >
              登出
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link">登入</Link>
            <Link to="/register" className="btn" style={{padding:'6px 14px',fontSize:12}}>註冊</Link>
          </>
        )}
      </div>
    </nav>
  )
}
