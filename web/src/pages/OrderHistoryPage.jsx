import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getOrders, confirmStripePayment } from '../services/api';

export default function OrderHistoryPage(){
  const [orders,setOrders]=useState([]);
  const [loading,setLoading]=useState(true);
  const [authorized,setAuthorized]=useState(false);
  const [error,setError]=useState('');
  const navigate=useNavigate();
  const [searchParams] = useSearchParams();
  
  // Handle Stripe redirect
  useEffect(() => {
    const paymentIntent = searchParams.get('payment_intent');
    const paymentIntentClientSecret = searchParams.get('payment_intent_client_secret');
    const redirectStatus = searchParams.get('redirect_status');
    
    if (paymentIntent && redirectStatus === 'succeeded') {
      // Get discordId from localStorage or prompt user
      const discordId = localStorage.getItem('temp_discord_id') || '';
      
      confirmStripePayment(paymentIntent, discordId)
        .then(() => {
          alert('支付寶/微信支付成功！訂單已自動批准');
          // Clear temp discord id
          localStorage.removeItem('temp_discord_id');
          // Remove query params from URL
          window.history.replaceState({}, '', '/orders');
        })
        .catch(err => {
          console.error('Error confirming payment:', err);
          alert('付款確認失敗，請聯繫客服');
        });
    } else if (paymentIntent && redirectStatus === 'failed') {
      alert('付款失敗，請重試');
      window.history.replaceState({}, '', '/orders');
    }
  }, [searchParams]);
  
  useEffect(()=>{(async()=>{
    const isAdmin = localStorage.getItem('admin_token');
    if(isAdmin) {
      alert('管理員模式下無法查看玩家訂單，請先登出管理員');
      navigate('/admin');
      return;
    }
    const token = localStorage.getItem('token');
    const playerid = localStorage.getItem('playerid');
    console.log('OrderHistoryPage - checking auth:', { hasToken: !!token, hasPlayerid: !!playerid });
    if(!token || !playerid){ 
      console.log('OrderHistoryPage - no auth, redirecting to login');
      navigate('/login'); 
      return 
    }
    setAuthorized(true);
    try{
      console.log('OrderHistoryPage - fetching orders...');
      const r=await getOrders();
      console.log('OrderHistoryPage - orders response:', r);
      const ordersData = Array.isArray(r.data) ? r.data : (Array.isArray(r) ? r : []);
      console.log('OrderHistoryPage - orders data:', ordersData);
      setOrders(ordersData);
    }catch(e){
      console.error('Error fetching orders:', e);
      setError(e.response?.data?.error || '載入訂單失敗');
      if(e.response && (e.response.status===401||e.response.status===403)){
        console.log('OrderHistoryPage - auth error, redirecting to login');
        setTimeout(()=>navigate('/login'),2000)
      }
    }finally{
      setLoading(false)
    }
  })()},[])
  if(!authorized) return null;
  if(loading) return <div style={{textAlign:'center',padding:40}}><div className="loading-spinner"></div></div>
  return (
    <div className="container">
      <h1 style={{marginBottom:12}}>我的訂單</h1>
      {error && <div className="card" style={{color:'var(--danger)',marginBottom:12}}>{error}</div>}
      {orders.length===0 ? <div className="card">尚無訂單</div> : (
        <div style={{display:'grid',gap:12}}>
          {orders.map(o=> (
            <div key={o.id} className="card" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:700}}>#{String(o.id).substring(0,8)}</div>
                <div className="muted">{new Date(o.createdAt||o.updatedAt||Date.now()).toLocaleString()}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{color:'var(--accent)',fontWeight:700}}>NT${Math.round(o.totalAmount || 0)}</div>
                <div style={{marginTop:8}}><Link to={`/orders/${o.id}`}>查看詳情</Link></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
