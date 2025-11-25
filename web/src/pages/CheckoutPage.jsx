import React, { useState, useEffect } from 'react';
import { getCart, checkout, uploadPaymentProof, getPayPalConfig, createPayPalOrder, capturePayPalOrder } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function CheckoutPage(){
  const [cart,setCart]=useState([]);
  const [loading,setLoading]=useState(true);
  const [isSubmitting,setIsSubmitting]=useState(false);
  const [form,setForm]=useState({playerId:'',discordId:''});
  const [proof, setProof] = useState(null);
  const [preview, setPreview] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('manual'); // 'manual' or 'paypal'
  const [paypalClientId, setPaypalClientId] = useState(null);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const navigate=useNavigate();
  
  useEffect(()=>{(async()=>{
    const token = localStorage.getItem('token');
    const playerid = localStorage.getItem('playerid');
    if(!token || !playerid){ navigate('/login'); return }
    try{
      const r=await getCart();
      if(r.data.length===0){alert('購物車為空');navigate('/cart')}
      setCart(r.data);
      
      // Load PayPal config
      try {
        const config = await getPayPalConfig();
        if (config.data && config.data.client_id) {
          setPaypalClientId(config.data.client_id);
          loadPayPalScript(config.data.client_id);
        }
      } catch (e) {
        console.log('PayPal not configured');
      }
    }catch(e){
      console.error(e);
      if(e.response && (e.response.status===401||e.response.status===403))navigate('/login')
    }finally{setLoading(false)}
  })()},[])
  
  const loadPayPalScript = (clientId) => {
    if (window.paypal) {
      setPaypalLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.async = true;
    script.onload = () => setPaypalLoaded(true);
    document.body.appendChild(script);
  };
  
  const total=()=>cart.reduce((s,i)=>s+(i.product.price*i.quantity),0).toFixed(2)
  const handleSubmit=async(e)=>{
    e.preventDefault();
    if (paymentMethod === 'manual' && !proof) {
      alert('請上傳付款證明');
      return;
    }
    setIsSubmitting(true);
    try{
      const playerid = localStorage.getItem('playerid');
      if(!playerid){alert('請先登入');navigate('/login');return}
      let proofUrl = null
      if(proof){
        const up = await uploadPaymentProof(proof)
        proofUrl = up.data.url || null
      }
      const resp=await checkout({playerId: playerid, discordId: form.discordId, proof: proofUrl, paymentMethod: 'manual'});
      const orderId=resp.data.orders?.[0]?.id||resp.data.id||resp.data.orders?.[0];
      alert('訂單建立，等待管理員審核');
      navigate(`/orders/${orderId}`)
    }catch(e){console.error(e);alert('結帳失敗')}
    finally{setIsSubmitting(false)}
  }

  const handleFile = (file)=>{
    setProof(file)
    const reader = new FileReader()
    reader.onload = ()=> setPreview(reader.result)
    reader.readAsDataURL(file)
  }
  
  // PayPal button rendering
  useEffect(() => {
    if (paymentMethod === 'paypal' && paypalLoaded && window.paypal) {
      const container = document.getElementById('paypal-button-container');
      if (container && container.childNodes.length === 0) {
        window.paypal.Buttons({
          createOrder: async () => {
            try {
              const response = await createPayPalOrder();
              return response.data.id;
            } catch (error) {
              console.error('Error creating PayPal order:', error);
              alert('創建PayPal訂單失敗');
            }
          },
          onApprove: async (data) => {
            try {
              setIsSubmitting(true);
              const response = await capturePayPalOrder(data.orderID, form.discordId);
              const orderId = response.data.orders?.[0]?.id || response.data.id;
              alert('PayPal付款成功！訂單已自動批准');
              navigate(`/orders/${orderId}`);
            } catch (error) {
              console.error('Error capturing PayPal payment:', error);
              alert('PayPal付款處理失敗');
              setIsSubmitting(false);
            }
          },
          onError: (err) => {
            console.error('PayPal error:', err);
            alert('PayPal付款出現錯誤');
          }
        }).render('#paypal-button-container');
      }
    }
  }, [paymentMethod, paypalLoaded, form.discordId]);
  if(loading) return <div style={{textAlign:'center',padding:120}}><div className="loading-spinner"></div></div>
  return (
    <section className="section">
      <div className="container-narrow">
        <h1 style={{textAlign:'center',marginBottom:48}}>結帳</h1>
        
        <div style={{marginBottom:40}}>
          <h3 style={{marginBottom:24}}>訂單摘要</h3>
          <div style={{
            padding:24,
            background:'var(--card)',
            borderRadius:'var(--radius-lg)',
            boxShadow:'var(--shadow-sm)'
          }}>
            {cart.map(it=>(
              <div key={it.id} style={{
                display:'flex',
                justifyContent:'space-between',
                padding:'12px 0',
                borderBottom:'1px solid rgba(0,0,0,0.06)'
              }}>
                <div>
                  <div style={{fontWeight:500}}>{it.product.name}</div>
                  <div style={{fontSize:14,color:'var(--text-secondary)'}}>數量: {it.quantity}</div>
                </div>
                <div style={{fontWeight:600}}>${(it.product.price*it.quantity).toFixed(2)}</div>
              </div>
            ))}
            <div style={{
              display:'flex',
              justifyContent:'space-between',
              padding:'20px 0 0',
              fontSize:24,
              fontWeight:700
            }}>
              <div>總計</div>
              <div>${total()}</div>
            </div>
          </div>
        </div>

        <h3 style={{marginBottom:24}}>選擇付款方式</h3>
        
        <div style={{marginBottom:32}}>
          <div style={{display:'flex',gap:16,marginBottom:24}}>
            <button 
              className={`btn ${paymentMethod === 'manual' ? '' : 'outlined'}`}
              onClick={()=>setPaymentMethod('manual')}
              type="button"
              style={{flex:1}}
            >
              上傳付款證明
            </button>
            {paypalClientId && (
              <button 
                className={`btn ${paymentMethod === 'paypal' ? '' : 'outlined'}`}
                onClick={()=>setPaymentMethod('paypal')}
                type="button"
                style={{flex:1}}
              >
                PayPal付款
              </button>
            )}
          </div>
        </div>

        <div className="form-row" style={{marginBottom:24}}>
          <label style={{display:'block',marginBottom:8,fontWeight:500,fontSize:14}}>
            Discord ID <span style={{color:'var(--text-secondary)',fontWeight:400}}>(選填)</span>
          </label>
          <input 
            className="input" 
            placeholder="例如：username#1234" 
            value={form.discordId} 
            onChange={e=>setForm({...form,discordId:e.target.value})} 
          />
        </div>

        {paymentMethod === 'manual' ? (
          <form onSubmit={handleSubmit}>
            <h3 style={{marginBottom:24}}>付款資訊</h3>

            <div className="form-row" style={{marginBottom:32}}>
              <label style={{display:'block',marginBottom:12,fontWeight:500,fontSize:14}}>
                上傳付款證明 <span style={{color:'var(--danger)'}}>*</span>
              </label>
              <div 
                style={{
                  border:'2px dashed rgba(0,0,0,0.15)',
                  borderRadius:'var(--radius-lg)',
                  padding:48,
                  textAlign:'center',
                  background:'var(--bg-secondary)',
                  cursor:'pointer',
                  transition:'var(--transition)'
                }}
                onClick={()=>document.getElementById('file-input').click()}
              >
                <div style={{fontSize:56,marginBottom:12,opacity:0.5}}>📸</div>
                <p style={{marginBottom:8,fontWeight:500}}>點擊上傳付款截圖</p>
                <p style={{fontSize:14,color:'var(--text-secondary)'}}>支援 JPG, PNG, GIF 格式</p>
              </div>
              <input 
                id="file-input"
                type="file" 
                accept="image/*" 
                onChange={e=>handleFile(e.target.files[0])} 
                required 
                style={{display:'none'}}
              />
              {preview && (
                <div style={{marginTop:24,textAlign:'center'}}>
                  <img 
                    src={preview} 
                    alt="preview" 
                    style={{
                      maxWidth:'100%',
                      maxHeight:400,
                      borderRadius:'var(--radius-lg)',
                      boxShadow:'var(--shadow-md)'
                    }}
                  />
                </div>
              )}
            </div>

            <button 
              className="btn large" 
              type="submit" 
              style={{width:'100%'}} 
              disabled={isSubmitting}
            >
              {isSubmitting ? '處理中...' : '確認下單'}
            </button>
          </form>
        ) : (
          <div>
            <h3 style={{marginBottom:24}}>PayPal付款</h3>
            <p style={{marginBottom:24,color:'var(--text-secondary)'}}>
              使用PayPal付款後，訂單將自動批准並發放商品
            </p>
            {paypalLoaded ? (
              <div id="paypal-button-container" style={{marginBottom:24}}></div>
            ) : (
              <div style={{textAlign:'center',padding:48}}>
                <div className="loading-spinner"></div>
                <p style={{marginTop:16,color:'var(--text-secondary)'}}>載入PayPal...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
