import React, { useState } from 'react';
import { register } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function RegisterPage(){
  const [playerid,setPlayerid]=useState('');
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [loading,setLoading]=useState(false);
  const navigate=useNavigate();
  const handleSubmit=async(e)=>{
    e.preventDefault();
    if(password!==confirm){
      alert('密碼不一致');
      return;
    }
    setLoading(true);
    try{
      await register(playerid,password);
      alert('註冊成功！即將跳轉到登入頁面');
      navigate('/login');
    }catch(e){
      alert('註冊失敗：' + (e.response?.data?.message || '未知錯誤'));
    }finally{
      setLoading(false);
    }
  }
  
  return (
    <section className="section">
      <div className="container-narrow" style={{maxWidth:450}}>
        <div style={{textAlign:'center',marginBottom:48}}>
          <h1>註冊</h1>
          <p className="headline" style={{marginTop:12}}>加入 Minecraft 社群</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-row" style={{marginBottom:20}}>
            <label style={{display:'block',marginBottom:8,fontWeight:500,fontSize:14}}>Minecraft 玩家 ID</label>
            <input 
              className="input" 
              placeholder="輸入你的 Minecraft 玩家 ID" 
              value={playerid} 
              onChange={e=>setPlayerid(e.target.value)} 
              required 
            />
          </div>
          <div className="form-row" style={{marginBottom:20}}>
            <label style={{display:'block',marginBottom:8,fontWeight:500,fontSize:14}}>密碼</label>
            <input 
              className="input" 
              type="password" 
              placeholder="設定密碼"
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
              required 
            />
          </div>
          <div className="form-row" style={{marginBottom:32}}>
            <label style={{display:'block',marginBottom:8,fontWeight:500,fontSize:14}}>確認密碼</label>
            <input 
              className="input" 
              type="password" 
              placeholder="再次輸入密碼"
              value={confirm} 
              onChange={e=>setConfirm(e.target.value)} 
              required 
            />
          </div>
          <button 
            className="btn large" 
            type="submit" 
            style={{width:'100%',background:'var(--success)'}} 
            disabled={loading}
          >
            {loading ? '註冊中...' : '建立帳號'}
          </button>
        </form>
        
        <div style={{marginTop:24,textAlign:'center'}}>
          <span style={{color:'var(--text-secondary)'}}>已經有帳號了？</span>
          {' '}
          <a href="/login" style={{color:'var(--accent)',textDecoration:'none'}}>
            立即登入
          </a>
        </div>
      </div>
    </section>
  )
}
