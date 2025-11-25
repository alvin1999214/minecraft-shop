import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProducts } from '../services/api';

const ProductCard = ({ product }) => (
  <Link to={`/product/${product.id}`} style={{textDecoration:'none',color:'inherit'}}>
    <div className="product">
      <img 
        src={product.image ? `/api${product.image}?t=${Date.now()}` : 'https://via.placeholder.com/600'} 
        alt={product.name} 
      />
      <div style={{padding:'0 8px'}}>
        <div style={{color:product.stock>0?'var(--success)':'var(--danger)',fontSize:12,fontWeight:500,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>
          {product.stock>0?'有貨':'缺貨'}
        </div>
        <h3 style={{margin:'0 0 4px 0',fontSize:21,fontWeight:600}}>{product.name}</h3>
        <div style={{fontSize:14,color:'var(--text-secondary)',marginBottom:8}}>
          {product.description?.substring(0, 60) || '精選商品'}
        </div>
        <div style={{fontSize:17,fontWeight:400,color:'var(--text-primary)'}}>
          NT${Math.round(product.price)}
        </div>
      </div>
    </div>
  </Link>
)

export default function HomePage(){
  const [products,setProducts]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    (async()=>{
      try{const r=await getProducts();setProducts(r.data||[])}catch(e){console.error(e)}finally{setLoading(false)}
    })()
  },[])

  return (
    <>
      {/* Hero Section - 蘋果風格 */}
      <section className="hero-section">
        <div className="container-narrow">
          <h1>Minecraft 伺服器商店</h1>
          <p className="headline">
            探索精選虛擬商品與服務，提升你的遊戲體驗
          </p>
          <div className="hero-cta">
            <a href="#products" className="btn large">開始購物</a>
            <Link to="/orders" className="btn ghost large">查看訂單</Link>
          </div>
        </div>
        <div className="hero-image">
          <img 
            src="https://xboxwire.thesourcemediaassets.com/sites/2/2024/05/Hero-8c18da7c19a1a8811ddb.jpg?w=1200&h=600&fit=crop" 
            alt="Minecraft"
          />
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="section">
        <div className="container">
          <div className="section-header">
            <h2>精選商品</h2>
            <p className="headline">為你挑選最受歡迎的遊戲道具</p>
          </div>
          
          {loading ? (
            <div style={{textAlign:'center',padding:80}}>
              <div className="loading-spinner"></div>
            </div>
          ) : products.length === 0 ? (
            <div style={{textAlign:'center',padding:80}}>
              <div style={{fontSize:56,marginBottom:16,opacity:0.3}}>📦</div>
              <h3>暫無商品</h3>
              <p className="muted" style={{marginTop:8}}>商品即將上架，敬請期待</p>
            </div>
          ) : (
            <div className="grid">
              {products.map((p) => (<ProductCard key={p.id} product={p} />))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
