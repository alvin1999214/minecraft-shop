import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getOrders, confirmStripePayment } from '../services/api';

export default function OrderHistoryPage(){
  const [orders,setOrders]=useState([]);
  const [loading,setLoading]=useState(true);
  const [authorized,setAuthorized]=useState(false);
  const [error,setError]=useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 5;
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
  
  // Pagination
  const totalPages = Math.ceil(orders.length / ordersPerPage);
  const startIndex = (currentPage - 1) * ordersPerPage;
  const endIndex = startIndex + ordersPerPage;
  const paginatedOrders = orders.slice(startIndex, endIndex);
  
  return (
    <div className="container">
      <h1 style={{marginBottom:24,textAlign:'center'}}>我的訂單</h1>
      {error && <div className="card" style={{color:'var(--danger)',marginBottom:12}}>{error}</div>}
      {orders.length===0 ? (
        <div style={{
          background: 'white',
          borderRadius: 16,
          padding: 40,
          textAlign: 'center',
          color: '#6b7280'
        }}>
          尚無訂單
        </div>
      ) : (
        <>
        <div style={{display:'grid',gap:16}}>
          {paginatedOrders.map(o=> (
            <div 
              key={o.orderGroupId}
              style={{
                background: 'white',
                borderRadius: 16,
                padding: 24,
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
              }}
            >
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:24}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
                    <h3 style={{
                      margin:0,
                      fontSize:20,
                      fontWeight:700,
                      color:'#1a1a2e',
                    }}>
                      #{o.orderGroupId ? o.orderGroupId.substring(0,8).toUpperCase() : 'N/A'}
                    </h3>
                    {o.statuses && o.statuses.includes('pending') && (
                      <span style={{
                        background: '#fef3c7',
                        color: '#92400e',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 12,
                      }}>
                        待處理
                      </span>
                    )}
                    {o.statuses && o.statuses === 'approved' && (
                      <span style={{
                        background: '#d1fae5',
                        color: '#065f46',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 12,
                      }}>
                        已批准
                      </span>
                    )}
                  </div>

                  <div style={{
                    display:'grid',
                    gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',
                    gap:16,
                  }}>
                    {o.discordId && (
                      <div>
                        <div style={{fontSize:12,color:'#6b7280',marginBottom:4}}>Discord ID</div>
                        <div style={{fontSize:15,fontWeight:600,color:'#1a1a2e'}}>{o.discordId}</div>
                      </div>
                    )}
                    <div>
                      <div style={{fontSize:12,color:'#6b7280',marginBottom:4}}>總金額</div>
                      <div style={{fontSize:20,fontWeight:700,color:'#667eea'}}>NT${Math.round(o.totalAmount)}</div>
                    </div>
                    <div>
                      <div style={{fontSize:12,color:'#6b7280',marginBottom:4}}>商品數量</div>
                      <div style={{fontSize:15,fontWeight:600,color:'#1a1a2e'}}>{o.itemCount} 件</div>
                    </div>
                    <div>
                      <div style={{fontSize:12,color:'#6b7280',marginBottom:4}}>下單時間</div>
                      <div style={{fontSize:13,color:'#1a1a2e'}}>
                        {o.createdAt ? new Date(o.createdAt).toLocaleString('zh-TW') : ''}
                      </div>
                    </div>
                  </div>
                </div>

                <Link 
                  to={`/orders/${o.orderGroupId}`}
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 8,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    display: 'inline-block',
                  }}
                >
                  查看詳情
                </Link>
              </div>
            </div>
          ))}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            marginTop: 24
          }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                background: currentPage === 1 ? '#f3f4f6' : 'white',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontWeight: 600
              }}
            >
              ← 上一頁
            </button>
            
            <span style={{fontSize: 14, color: '#6b7280'}}>
              第 {currentPage} / {totalPages} 頁
            </span>
            
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                background: currentPage === totalPages ? '#f3f4f6' : 'white',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontWeight: 600
              }}
            >
              下一頁 →
            </button>
          </div>
        )}
        </>
      )}
    </div>
  )
}
