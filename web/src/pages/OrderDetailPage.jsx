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
      <Link to="/orders">← 返回訂單列表</Link>
      <h1 style={{margin:'8px 0 12px 0'}}>訂單 #{String(id).substring(0,8)}</h1>
      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between'}}>
          <div>
            <div className="muted">狀態</div>
            <div style={{fontWeight:700,color:order.status==='approved'?'var(--success)':order.status==='rejected'?'var(--danger)':'var(--accent)'}}>{order.status}</div>
          </div>
          <div>
            <div className="muted">總額</div>
            <div style={{fontWeight:700}}>${order.totalAmount || 0}</div>
          </div>
        </div>

        {order.productName && (
          <div style={{marginTop:12}}>
            <div className="muted">商品</div>
            <div style={{fontWeight:700}}>{order.productName}</div>
          </div>
        )}

        <div style={{marginTop:12}}>
          <div className="muted">建立時間</div>
          <div>{new Date(order.createdAt || Date.now()).toLocaleString()}</div>
        </div>

        <div style={{marginTop:12}}>
          <div className="muted">付款證明</div>
          {preview ? (
            <div className="file-preview" style={{marginTop:8}}><img src={`/api${preview}`} alt="proof" style={{maxWidth:'100%',borderRadius:8}}/></div>
          ) : (
            <div className="muted" style={{marginTop:8}}>尚未上傳付款證明</div>
          )}
          {order.status === 'pending' && (
            <div style={{marginTop:12}}>
              <input type="file" accept="image/*" onChange={e=>e.target.files[0] && handleUpload(e.target.files[0])} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
