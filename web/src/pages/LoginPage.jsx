import React, { useState } from 'react';
import { login } from '../services/api';
import { useNavigate, Link } from 'react-router-dom';

export default function LoginPage(){
  const [playerid,setPlayerid]=useState('');
  const [password,setPassword]=useState('');
  const [loading,setLoading]=useState(false);
  const navigate=useNavigate();
  const handleSubmit=async(e)=>{
    e.preventDefault();
    setLoading(true);
    try{
      const r=await login(playerid,password);
      localStorage.setItem('token',r.data.token);
      localStorage.setItem('playerid',r.data.playerid);
      // 使用 navigate 而不是 window.location.href，確保 React Router 正確處理
      navigate('/');
    }catch(e){
      console.error('Login error:', e);
      alert('登入失敗');
      setLoading(false);
    }
  }
  return (
    <section className="section">
      <div className="container-narrow" style={{maxWidth:450}}>
        <div style={{textAlign:'center',marginBottom:48}}>
          <h1>登入</h1>
          <p className="headline" style={{marginTop:12}}>歡迎回來</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-row" style={{marginBottom:20}}>
            <label style={{display:'block',marginBottom:8,fontWeight:500,fontSize:14}}>Minecraft 玩家 ID</label>
            <input 
              className="input" 
              placeholder="輸入你的玩家 ID" 
              value={playerid} 
              onChange={e=>setPlayerid(e.target.value)} 
              required 
            />
          </div>
          <div className="form-row" style={{marginBottom:32}}>
            <label style={{display:'block',marginBottom:8,fontWeight:500,fontSize:14}}>密碼</label>
            <input 
              className="input" 
              type="password" 
              placeholder="輸入密碼"
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
              required 
            />
          </div>
          <button 
            className="btn large" 
            type="submit" 
            style={{width:'100%'}} 
            disabled={loading}
          >
            {loading ? '登入中...' : '登入'}
          </button>
        </form>
        
        <div style={{marginTop:24,textAlign:'center'}}>
          <span style={{color:'var(--text-secondary)'}}>還沒有帳號？</span>
          {' '}
          <Link to="/register" style={{color:'var(--accent)',textDecoration:'none'}}>
            立即註冊
          </Link>
        </div>
      </div>
    </section>
  )
}
