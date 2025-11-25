import React from 'react'
import { Link } from 'react-router-dom'

export default function NavBar({cartCount = 0}){
  const isAdmin = typeof window !== 'undefined' && localStorage.getItem('admin_token');
  const playerid = typeof window !== 'undefined' ? localStorage.getItem('playerid') : null;
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('playerid');
    window.location.href = '/';
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
        {playerid ? (
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
        {isAdmin && <Link to="/admin" className="nav-link">管理</Link>}
      </div>
    </nav>
  )
}
