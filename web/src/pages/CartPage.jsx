import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCart, removeFromCart, updateCartItem } from '../services/api';

export default function CartPage(){
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const navigate=useNavigate();
  useEffect(()=>{(async()=>{
    const isAdmin = localStorage.getItem('admin_token');
    if(isAdmin) {
      alert('管理員模式下無法使用購物車，請先登出管理員');
      navigate('/admin');
      return;
    }
    const token = localStorage.getItem('token');
    const playerid = localStorage.getItem('playerid');
    if(!token || !playerid){
      navigate('/login');
      return;
    }
    try{
      const r=await getCart();setItems(r.data);
    }catch(e){
      console.error(e);
      if(e.response && (e.response.status===401||e.response.status===403)){
        setItems([]);
        setTimeout(()=>navigate('/login'),2000)
      }
    }finally{setLoading(false)}
  })()},[])
  const total=()=>items.reduce((s,i)=>s+(i.product.price*i.quantity),0).toFixed(2)
  const handleRemove=async(id)=>{
    if(!confirm('確定要移除嗎？'))return;
    try{
      await removeFromCart(id);
      setItems(items.filter(it=>it.productId!==id))
    }catch(e){
      console.error(e);
      if(e.response && (e.response.status===401||e.response.status===403)){
        navigate('/login')
      }
    }
  }
  const handleQty=async(it,qty)=>{
    const q = Number(qty)||1
    try{await updateCartItem(it.id,q); setItems(items.map(x=> x.id===it.id ? {...x,quantity:q} : x))}catch(e){console.error(e)}
  }
  if(loading) return <div style={{textAlign:'center',padding:120}}><div className="loading-spinner"></div></div>
  return (
    <section className="section">
      <div className="container-narrow">
        <h1 style={{textAlign:'center',marginBottom:48}}>購物車</h1>
        {items.length===0 ? (
          <div style={{textAlign:'center',padding:80}}>
            <div style={{fontSize:80,marginBottom:24,opacity:0.3}}>🛍️</div>
            <h3>購物車是空的</h3>
            <p className="headline" style={{marginTop:16,marginBottom:32}}>快去挑選喜歡的商品吧！</p>
            <Link to="/" className="btn large">開始購物</Link>
          </div>
        ) : (
          <>
            <div style={{display:'flex',flexDirection:'column',gap:24,marginBottom:40}}>
              {items.map(it=> (
                <div key={it.id} style={{
                  display:'flex',
                  gap:24,
                  padding:24,
                  background:'var(--card)',
                  borderRadius:'var(--radius-lg)',
                  boxShadow:'var(--shadow-sm)',
                  alignItems:'center',
                  flexWrap:'wrap'
                }}>
                  <img 
                    src={it.product.image ? `/api${it.product.image}?t=${Date.now()}` : 'https://via.placeholder.com/120'} 
                    alt={it.product.name} 
                    style={{
                      width:120,
                      height:120,
                      objectFit:'cover',
                      borderRadius:'var(--radius-sm)'
                    }}
                  />
                  <div style={{flex:1,minWidth:200}}>
                    <h3 style={{margin:'0 0 8px 0',fontSize:21}}>{it.product.name}</h3>
                    <div style={{fontSize:17,color:'var(--text-secondary)',marginBottom:12}}>
                      ${it.product.price}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <input 
                        className="input" 
                        type="number" 
                        min={1} 
                        value={it.quantity} 
                        onChange={e=>handleQty(it,e.target.value)}
                        style={{width:70,textAlign:'center',padding:'8px'}}
                      />
                      <button 
                        className="btn ghost" 
                        onClick={()=>handleRemove(it.productId)}
                        style={{fontSize:14}}
                      >
                        移除
                      </button>
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:12,color:'var(--text-secondary)',marginBottom:4}}>小計</div>
                    <div style={{fontSize:24,fontWeight:600}}>
                      ${(it.product.price*it.quantity).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{
              padding:32,
              background:'var(--bg-secondary)',
              borderRadius:'var(--radius-lg)',
              display:'flex',
              justifyContent:'space-between',
              alignItems:'center',
              flexWrap:'wrap',
              gap:24
            }}>
              <div>
                <div style={{fontSize:14,color:'var(--text-secondary)',marginBottom:4}}>總金額</div>
                <div style={{fontSize:40,fontWeight:700}}>${total()}</div>
              </div>
              <Link to="/checkout" className="btn large">
                前往結帳
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
