import React, { useState, useEffect, useRef } from 'react';
import { getCart, checkout, uploadPaymentProof, getPayPalConfig, createPayPalOrder, capturePayPalOrder, getStripeConfig, createStripePaymentIntent, confirmStripePayment } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useCurrency } from '../contexts/CurrencyContext';

// Stripe payment form component
function StripePaymentForm({ discordId, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    try {
      // Save discordId for redirect callback
      localStorage.setItem('temp_discord_id', discordId);
      
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/orders`,
        },
        redirect: 'if_required',
      });

      if (error) {
        onError(error.message);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Confirm payment with backend
        const response = await confirmStripePayment(paymentIntent.id, discordId);
        onSuccess(response.data);
        // Clear temp discord id
        localStorage.removeItem('temp_discord_id');
      }
    } catch (err) {
      onError(err.message || 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement 
        options={{
          layout: {
            type: 'tabs',
            defaultCollapsed: false,
          },
          wallets: {
            applePay: 'auto',
            googlePay: 'auto',
          },
        }}
      />
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="btn large"
        style={{width: '100%', marginTop: 24}}
      >
        {isProcessing ? '處理中...' : '確認付款'}
      </button>
    </form>
  );
}

export default function CheckoutPage(){
  const [cart,setCart]=useState([]);
  const [loading,setLoading]=useState(true);
  const [isSubmitting,setIsSubmitting]=useState(false);
  const [form,setForm]=useState({playerId:'',discordId:''});
  const [proof, setProof] = useState(null);
  const [preview, setPreview] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('manual'); // 'manual', 'paypal', or 'stripe'
  const [paypalClientId, setPaypalClientId] = useState(null);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [stripePromise, setStripePromise] = useState(null);
  const [stripeClientSecret, setStripeClientSecret] = useState(null);
  const discordIdRef = useRef('');
  const navigate=useNavigate();
  const { currency, formatPrice } = useCurrency();
  
  // Reset Stripe client secret when currency changes
  useEffect(() => {
    if (stripeClientSecret) {
      setStripeClientSecret(null);
    }
  }, [currency]);
  
  const total = () => cart.reduce((s,i) => s + (i.product.price * i.quantity), 0);
  
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
      
      // Load Stripe config
      try {
        const config = await getStripeConfig();
        if (config.data && config.data.publishableKey) {
          const stripe = await loadStripe(config.data.publishableKey);
          setStripePromise(stripe);
        }
      } catch (e) {
        console.log('Stripe not configured');
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
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=TWD`;
    script.async = true;
    script.onload = () => setPaypalLoaded(true);
    document.body.appendChild(script);
  };
  
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
    // Update ref when form changes
    discordIdRef.current = form.discordId;
  }, [form.discordId]);

  // Create Stripe payment intent when stripe method is selected
  useEffect(() => {
    if (paymentMethod === 'stripe' && stripePromise && !stripeClientSecret) {
      createStripePaymentIntent(currency)
        .then(response => {
          setStripeClientSecret(response.data.clientSecret);
        })
        .catch(error => {
          console.error('Error creating Stripe payment intent:', error);
          const errorMsg = error.response?.data?.error || '創建Stripe付款失敗';
          alert(errorMsg);
          // Switch back to manual payment if Stripe fails
          setPaymentMethod('manual');
        });
    }
  }, [paymentMethod, stripePromise, stripeClientSecret]);

  const handleStripeSuccess = (data) => {
    alert('Stripe付款成功！訂單已自動批准');
    navigate('/orders');
  };

  const handleStripeError = (errorMessage) => {
    alert('Stripe付款失敗: ' + errorMessage);
  };

  useEffect(() => {
    if (paymentMethod === 'paypal' && paypalLoaded && window.paypal) {
      const container = document.getElementById('paypal-button-container');
      if (container) {
        // Clear existing buttons
        container.innerHTML = '';
        
        window.paypal.Buttons({
          createOrder: async () => {
            try {
              const response = await createPayPalOrder(currency);
              return response.data.id;
            } catch (error) {
              console.error('Error creating PayPal order:', error);
              alert('創建PayPal訂單失敗');
              throw error;
            }
          },
          onApprove: async (data) => {
            try {
              setIsSubmitting(true);
              const response = await capturePayPalOrder(data.orderID, discordIdRef.current);
              const orderId = response.data.orderGroupId || response.data.orders?.[0]?.id || response.data.id;
              alert('PayPal付款成功！訂單已自動批准');
              navigate(`/orders`);
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
  }, [paymentMethod, paypalLoaded, navigate, currency]);
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
                <div>
                  <div style={{fontWeight:600}}>{formatPrice(it.product.price * it.quantity)}</div>
                </div>
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
              <div>{formatPrice(total())}</div>
            </div>
          </div>
        </div>

        <h3 style={{marginBottom:24}}>選擇付款方式</h3>
        
        <div style={{marginBottom:32}}>
          <div style={{display:'grid',gap:16,marginBottom:24}}>
            {/* PayPal Payment */}
            {paypalClientId && (
              <div 
                onClick={()=>setPaymentMethod('paypal')}
                style={{
                  padding:20,
                  border: paymentMethod === 'paypal' ? '2px solid #667eea' : '2px solid #e5e7eb',
                  borderRadius:12,
                  cursor:'pointer',
                  transition:'all 0.2s',
                  background: paymentMethod === 'paypal' ? '#f0f4ff' : 'white'
                }}
              >
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
                  <input 
                    type="radio" 
                    checked={paymentMethod === 'paypal'} 
                    onChange={()=>setPaymentMethod('paypal')}
                    style={{width:20,height:20}}
                  />
                  <h4 style={{margin:0,fontSize:18,fontWeight:700}}>PayPal付款（24小時）</h4>
                </div>
                <p style={{margin:'0 0 0 32px',fontSize:14,color:'#6b7280',lineHeight:1.6}}>
                  使用PayPal付款，24小時自動發貨
                </p>
              </div>
            )}
            
            {/* Stripe Payment */}
            {stripePromise && (
              <div 
                onClick={()=>{
                  setPaymentMethod('stripe');
                  setStripeClientSecret(null); // Reset to trigger new payment intent
                }}
                style={{
                  padding:20,
                  border: paymentMethod === 'stripe' ? '2px solid #667eea' : '2px solid #e5e7eb',
                  borderRadius:12,
                  cursor:'pointer',
                  transition:'all 0.2s',
                  background: paymentMethod === 'stripe' ? '#f0f4ff' : 'white'
                }}
              >
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
                  <input 
                    type="radio" 
                    checked={paymentMethod === 'stripe'} 
                    onChange={()=>{
                      setPaymentMethod('stripe');
                      setStripeClientSecret(null);
                    }}
                    style={{width:20,height:20}}
                  />
                  <h4 style={{margin:0,fontSize:18,fontWeight:700}}>Stripe付款（24小時）</h4>
                </div>
                <p style={{margin:'0 0 0 32px',fontSize:14,color:'#6b7280',lineHeight:1.6}}>
                  使用Stripe付款，24小時自動發貨，支援信用卡、Apple Pay、Google Pay付款；香港地區支援微信支付、支付寶
                </p>
              </div>
            )}
            
            {/* Manual Payment */}
            <div 
              onClick={()=>setPaymentMethod('manual')}
              style={{
                padding:20,
                border: paymentMethod === 'manual' ? '2px solid #667eea' : '2px solid #e5e7eb',
                borderRadius:12,
                cursor:'pointer',
                transition:'all 0.2s',
                background: paymentMethod === 'manual' ? '#f0f4ff' : 'white'
              }}
            >
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
                <input 
                  type="radio" 
                  checked={paymentMethod === 'manual'} 
                  onChange={()=>setPaymentMethod('manual')}
                  style={{width:20,height:20}}
                />
                <h4 style={{margin:0,fontSize:18,fontWeight:700}}>其他支付方式</h4>
              </div>
              <p style={{margin:'0 0 0 32px',fontSize:14,color:'#6b7280',lineHeight:1.6}}>
                請聯絡管理員使用其他付款方式，付款後提供付款證明，等待管理員核實
              </p>
            </div>
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
        ) : paymentMethod === 'paypal' ? (
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
        ) : paymentMethod === 'stripe' ? (
          <div>
            <h3 style={{marginBottom:24}}>Stripe付款</h3>
            <p style={{marginBottom:24,color:'var(--text-secondary)'}}>
              支援信用卡、Apple Pay、Google Pay、微信支付、支付寶等多種付款方式
            </p>
            {stripeClientSecret && stripePromise ? (
              <Elements 
                stripe={stripePromise} 
                options={{
                  clientSecret: stripeClientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      colorPrimary: '#0066cc',
                    },
                  },
                  locale: 'zh-TW',
                }}
              >
                <StripePaymentForm 
                  discordId={form.discordId}
                  onSuccess={handleStripeSuccess}
                  onError={handleStripeError}
                />
              </Elements>
            ) : (
              <div style={{textAlign:'center',padding:48}}>
                <div className="loading-spinner"></div>
                <p style={{marginTop:16,color:'var(--text-secondary)'}}>載入Stripe...</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}
