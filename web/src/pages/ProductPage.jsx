import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getProduct, addToCart } from '../services/api';

export default function ProductPage(){
  const {id}=useParams();
  const [product,setProduct]=useState(null);
  const [loading,setLoading]=useState(true);
  const [qty,setQty]=useState(1);
  const navigate=useNavigate();
  useEffect(()=>{(async()=>{try{const r=await getProduct(id);setProduct(r.data);}catch(e){console.error(e)}finally{setLoading(false)}})()},[id]);
  const handleAdd=async()=>{
    try{
      const token = localStorage.getItem('token');
      const playerid = localStorage.getItem('playerid');
      if(!token || !playerid){ navigate('/login'); return }
      await addToCart(product.id,qty);
      navigate('/cart')
    }catch(e){console.error(e);if(e.response && (e.response.status===401||e.response.status===403))navigate('/login')}
  }
  if(loading) return <div style={{textAlign:'center',padding:120}}><div className="loading-spinner"></div></div>
  if(!product) return (
    <section className="section">
      <div className="container-narrow" style={{textAlign:'center'}}>
        <div style={{fontSize:80,marginBottom:24,opacity:0.3}}>❌</div>
        <h2>找不到商品</h2>
        <p className="headline" style={{marginTop:16,marginBottom:32}}>該商品可能已被移除或不存在</p>
        <Link to="/" className="btn large">返回商店</Link>
      </div>
    </section>
  )
  
  return (
    <>
      {/* Breadcrumb */}
      <div className="container" style={{padding:'16px 24px'}}>
        <Link to="/" style={{color:'var(--accent)',textDecoration:'none',fontSize:14}}>← 返回</Link>
      </div>

      {/* Product Hero */}
      <section className="section" style={{paddingTop:20}}>
        <div className="container-narrow">
          <div style={{textAlign:'center',marginBottom:40}}>
            <div style={{
              display:'inline-block',
              padding:'4px 12px',
              background:product.stock>0?'var(--success-light)':'rgba(255,107,107,0.15)',
              color:product.stock>0?'var(--success)':'var(--danger)',
              borderRadius:4,
              fontSize:12,
              fontWeight:500,
              textTransform:'uppercase',
              letterSpacing:'0.5px',
              marginBottom:16
            }}>
              {product.stock>0?'有貨':'缺貨'}
            </div>
            <h1>{product.name}</h1>
            <p className="headline" style={{marginTop:16}}>{product.description || '精選商品'}</p>
            <div style={{fontSize:32,fontWeight:600,marginTop:24,color:'var(--text-primary)'}}>
              ${product.price}
            </div>
          </div>

          {/* Product Image */}
          <div style={{marginBottom:48}}>
            <img 
              src={product.image ? `/api${product.image}?t=${Date.now()}` : 'https://via.placeholder.com/1200x800'} 
              alt={product.name} 
              style={{
                width:'100%',
                borderRadius:'var(--radius-lg)',
                boxShadow:'var(--shadow-lg)'
              }}
            />
          </div>

          {/* Add to Cart */}
          <div style={{
            maxWidth:400,
            margin:'0 auto',
            padding:32,
            background:'var(--card)',
            borderRadius:'var(--radius-lg)',
            boxShadow:'var(--shadow-sm)',
            textAlign:'center'
          }}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:16,marginBottom:24}}>
              <label style={{fontSize:14,color:'var(--text-secondary)'}}>數量</label>
              <input 
                className="input" 
                type="number" 
                min={1} 
                value={qty} 
                onChange={e=>setQty(Number(e.target.value)||1)}
                style={{width:80,textAlign:'center',fontSize:16,fontWeight:600}}
              />
            </div>
            <button 
              className="btn large" 
              onClick={handleAdd} 
              style={{width:'100%',marginBottom:12}}
            >
              加入購物車
            </button>
            <Link to="/" className="btn ghost" style={{display:'block',textAlign:'center'}}>
              繼續購物
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
