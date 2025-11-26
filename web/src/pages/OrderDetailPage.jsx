import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getOrder, uploadProof } from '../services/api';

export default function OrderDetailPage(){
  const {id}=useParams();
  const navigate=useNavigate();
  const [order,setOrder]=useState(null);
  const [loading,setLoading]=useState(true);
  const [preview,setPreview]=useState(null);
  const [error,setError]=useState('');
  
  useEffect(()=>{(async()=>{
    try{
      const token = localStorage.getItem('token');
      const playerid = localStorage.getItem('playerid');
      if(!token || !playerid){
        navigate('/login');
        return;
      }
      console.log('OrderDetailPage - fetching order:', id);
      const r=await getOrder(id);
      console.log('OrderDetailPage - order response:', r);
      setOrder(r.data || r); 
      if((r.data?.proofUrl) || (r?.proofUrl)) setPreview(r.data?.proofUrl || r?.proofUrl);
    }catch(e){
      console.error('OrderDetailPage - error:', e);
      setError('載入訂單失敗');
      if(e.response && (e.response.status===401||e.response.status===403)){
        setTimeout(()=>navigate('/login'),2000);
      }
    }finally{
      setLoading(false);
    }
  })()},[id])
  
  const handleUpload=async(file)=>{
    if(!file) return;
    try{
      const token = localStorage.getItem('token');
      const playerid = localStorage.getItem('playerid');
      if(!token || !playerid){
        alert('請先登入');
        navigate('/login');
        return;
      }
      const fd = new FormData();
      fd.append('file', file);
      console.log('Uploading proof for order:', id);
      const up = await uploadProof(id, fd);
      console.log('Upload response:', up);
      alert('上傳成功，管理員將會審查');
      setPreview(up.data?.url || up?.url || null);
    }catch(e){
      console.error('Upload error:', e);
      alert('上傳失敗');
    }
  }
  
  if(loading) return <div style={{textAlign:'center',padding:40}}><div className="loading-spinner"></div></div>
  if(error) return <div className="container"><div className="card" style={{color:'var(--danger)'}}>{error}</div><Link to="/orders">返回訂單列表</Link></div>
  if(!order) return <div className="container"><div className="card">找不到訂單</div><Link to="/orders">返回訂單列表</Link></div>
  
  return (
    <div className="container">
      <Link to="/orders" style={{marginBottom:16,display:'inline-block'}}>← 返回訂單列表</Link>
      <h1 style={{margin:'8px 0 24px 0',textAlign:'center'}}>訂單 #{order.orderGroupId ? order.orderGroupId.substring(0,8).toUpperCase() : 'N/A'}</h1>
      
      {/* Order Summary Card */}
      <div style={{
        background:'white',
        borderRadius:16,
        padding:24,
        marginBottom:24,
        boxShadow:'0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{marginTop:0,marginBottom:16}}>訂單資訊</h3>
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',
          gap:16
        }}>
          <div>
            <div style={{fontSize:12,color:'#6b7280',marginBottom:4}}>玩家 ID</div>
            <div style={{fontWeight:600}}>{order.playerid || 'N/A'}</div>
          </div>
          {order.discordId && (
            <div>
              <div style={{fontSize:12,color:'#6b7280',marginBottom:4}}>Discord ID</div>
              <div style={{fontWeight:600}}>{order.discordId}</div>
            </div>
          )}
          <div>
            <div style={{fontSize:12,color:'#6b7280',marginBottom:4}}>總金額</div>
            <div style={{fontSize:20,fontWeight:700,color:'#667eea'}}>NT${Math.round(order.totalAmount || 0)}</div>
          </div>
          <div>
            <div style={{fontSize:12,color:'#6b7280',marginBottom:4}}>付款方式</div>
            <div style={{fontWeight:600}}>
              {order.paymentMethod === 'manual' ? '手動上傳' : 
               order.paymentMethod === 'paypal' ? 'PayPal' :
               order.paymentMethod === 'stripe' ? 'Stripe' : 'N/A'}
            </div>
          </div>
          <div>
            <div style={{fontSize:12,color:'#6b7280',marginBottom:4}}>下單時間</div>
            <div style={{fontSize:13}}>{order.createdAt ? new Date(order.createdAt).toLocaleString('zh-TW') : 'N/A'}</div>
          </div>
        </div>

        {order.proofUrl && (
          <div style={{marginTop:20}}>
            <div style={{fontSize:12,color:'#6b7280',marginBottom:8}}>付款證明</div>
            <div className="file-preview">
              <img src={`/api${order.proofUrl}`} alt="proof" style={{maxWidth:'100%',borderRadius:8,boxShadow:'0 2px 4px rgba(0,0,0,0.1)'}}/>
            </div>
          </div>
        )}
      </div>

      {/* Order Items */}
      <h3 style={{marginBottom:16}}>訂單項目</h3>
      <div style={{display:'grid',gap:12}}>
        {order.items && order.items.length > 0 ? order.items.map((item, idx) => (
          <div 
            key={item.id}
            style={{
              background:'white',
              borderRadius:12,
              padding:20,
              boxShadow:'0 2px 4px rgba(0,0,0,0.08)',
              display:'flex',
              justifyContent:'space-between',
              alignItems:'center'
            }}
          >
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>{item.productName || '未知商品'}</div>
              <div style={{display:'flex',gap:16,fontSize:14,color:'#6b7280'}}>
                <div>價格: NT${Math.round(item.price || 0)}</div>
                <div>狀態: <span style={{
                  color: item.status === 'approved' ? '#10b981' : 
                         item.status === 'rejected' ? '#ef4444' : '#f59e0b',
                  fontWeight:600
                }}>
                  {item.status === 'approved' ? '已批准' :
                   item.status === 'rejected' ? '已拒絕' : '待處理'}
                </span></div>
                {item.approvedAt && (
                  <div>批准時間: {new Date(item.approvedAt).toLocaleString('zh-TW')}</div>
                )}
              </div>
            </div>
          </div>
        )) : (
          <div style={{
            background:'white',
            borderRadius:12,
            padding:20,
            textAlign:'center',
            color:'#6b7280'
          }}>
            無訂單項目
          </div>
        )}
      </div>
    </div>
  )
}
