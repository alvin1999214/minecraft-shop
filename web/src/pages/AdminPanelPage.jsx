import React, { useState, useEffect } from 'react';
import apiClient, { updateProduct, toggleProductStatus } from '../services/api';
import { useNavigate } from 'react-router-dom';
import ProductEditModal from '../components/ProductEditModal';

export default function AdminPanelPage() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ name: '', price: '', command: '', stock: '', description: '', image: null });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadError, setLoadError] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewingProof, setViewingProof] = useState(null);
  const [activeTab, setActiveTab] = useState('products');
  const [orderPage, setOrderPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const ordersPerPage = 5;

  const token = localStorage.getItem('admin_token');
  const navigate = useNavigate();

  useEffect(() => {
    if(!token) { navigate('/admin/login'); return; }
    setAuthorized(true);
    fetchProducts();
    fetchOrders();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await apiClient.get('/admin/products', { headers: { Authorization: `Bearer ${token}` } });
      setProducts(res.data);
    } catch (e) {
      try {
        const res = await apiClient.get('/products');
        setProducts(res.data);
      } catch (e2) {}
    }
  };

  const fetchOrders = async () => {
    if(!token) return;
    try{
      const res = await apiClient.get('/admin/orders', { headers: { Authorization: `Bearer ${token}` } });
      setOrders(Array.isArray(res.data) ? res.data : []);
      setLoadError('');
    }catch(e){
      setOrders([]);
      setLoadError('訂單載入失敗，請檢查權限或後端API');
      console.error(e);
    }
  }

  const handleChange = e => {
    const { name, value, files } = e.target;
    setForm(f => ({ ...f, [name]: files ? files[0] : value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setSuccess('');
    const fd = new FormData();
    fd.append('name', form.name);
    fd.append('price', form.price);
    fd.append('command', form.command);
    fd.append('stock', form.stock || '0');
    fd.append('description', form.description || '');
    if (form.image) fd.append('image', form.image);
    try {
      await apiClient.post('/products', fd, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setSuccess('商品已上架');
      setForm({ name: '', price: '', command: '', stock: '', description: '', image: null });
      fetchProducts();
    } catch (e) {
      setError('上架失敗，請檢查欄位或權限');
    }
  };

  const handleViewOrderDetails = async (orderGroupId) => {
    if(!token) return;
    try{
      const res = await apiClient.get(`/admin/orders/${orderGroupId}`, { headers: { Authorization: `Bearer ${token}` } });
      setSelectedOrder(res.data);
    }catch(e){
      console.error(e);
    }
  }

  const handleApproveItem = async (itemId) => {
    if(!token || !selectedOrder) return;
    try{
      await apiClient.post(`/admin/orders/items/${itemId}/approve`,{}, { headers: { Authorization: `Bearer ${token}` } });
      await handleViewOrderDetails(selectedOrder.orderGroupId);
    }catch(e){console.error(e)}
  }

  const handleRejectItem = async (itemId) => {
    if(!token || !selectedOrder) return;
    try{
      await apiClient.post(`/admin/orders/items/${itemId}/reject`,{}, { headers: { Authorization: `Bearer ${token}` } });
      await handleViewOrderDetails(selectedOrder.orderGroupId);
    }catch(e){console.error(e)}
  }

  const handleToggleActive = async (productId, currentActive) => {
    if (!token) return;
    try {
      await apiClient.put(`/products/${productId}`, { active: !currentActive }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchProducts();
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
  };

  const handleSaveProduct = async (formData) => {
    if (!token || !editingProduct) return;
    try {
      const response = await apiClient.put(`/products/${editingProduct.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEditingProduct(null);
      await fetchProducts();
      setSuccess('商品更新成功');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(`商品更新失敗: ${e.response?.data?.error || e.message}`);
      setTimeout(() => setError(''), 5000);
      throw e;
    }
  };

  if(!authorized) return null;

  const totalOrderPages = Math.ceil(orders.length / ordersPerPage);
  const paginatedOrders = orders.slice(
    (orderPage - 1) * ordersPerPage,
    orderPage * ordersPerPage
  );

  return (
    <div className="container" style={{ marginTop: 40 }}>
      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 24,
        borderBottom: '2px solid var(--muted)',
        justifyContent: 'center'
      }}>
        <button
          onClick={() => setActiveTab('products')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 24px',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            color: activeTab === 'products' ? 'var(--accent)' : 'var(--text)',
            borderBottom: activeTab === 'products' ? '3px solid var(--accent)' : '3px solid transparent',
            marginBottom: -2,
            transition: 'all 0.2s'
          }}
        >
          商品管理
        </button>
        <button
          onClick={() => { setActiveTab('orders'); setSelectedOrder(null); }}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 24px',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            color: activeTab === 'orders' ? 'var(--accent)' : 'var(--text)',
            borderBottom: activeTab === 'orders' ? '3px solid var(--accent)' : '3px solid transparent',
            marginBottom: -2,
            transition: 'all 0.2s'
          }}
        >
          訂單管理
        </button>
      </div>

      {/* Products Tab */}
      {activeTab === 'products' && (
        <>
          <div className="card" style={{ maxWidth: 500, margin: '0 auto' }}>
            <h2>上架新商品</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <label>商品名稱</label>
                <input className="input" name="name" value={form.name} onChange={handleChange} required />
              </div>
              <div className="form-row">
                <label>價格</label>
                <input className="input" name="price" type="number" value={form.price} onChange={handleChange} required />
              </div>
              <div className="form-row">
                <label>庫存數量</label>
                <input className="input" name="stock" type="number" value={form.stock} onChange={handleChange} min="0" />
              </div>
              <div className="form-row">
                <label>商品描述</label>
                <textarea className="input" name="description" value={form.description} onChange={handleChange} rows="3" style={{ resize: 'vertical' }} />
              </div>
              <div className="form-row">
                <label>指令</label>
                <input className="input" name="command" value={form.command} onChange={handleChange} />
              </div>
              <div className="form-row">
                <label>商品圖片</label>
                <input className="input" name="image" type="file" accept="image/*" onChange={handleChange} />
              </div>
              {error && <div className="danger" style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div>}
              {success && <div className="success" style={{ color: 'var(--success)', marginBottom: 8 }}>{success}</div>}
              <button className="btn" type="submit">上架</button>
            </form>
          </div>
          <div style={{ marginTop: 40 }}>
            <h3>現有商品</h3>
            <div className="grid">
              {products.map(p => (
                <div 
                  className="card product" 
                  key={p.id}
                  style={{ 
                    cursor: 'pointer',
                    opacity: p.active ? 1 : 0.6,
                    border: p.active ? '2px solid var(--accent)' : '2px solid var(--muted)',
                  }}
                >
                  <img 
                    src={p.image ? `/api${p.image}?t=${Date.now()}` : 'https://via.placeholder.com/400'} 
                    alt={p.name}
                    onClick={() => handleEditProduct(p)}
                  />
                  <div onClick={() => handleEditProduct(p)}>
                    <b>{p.name}</b>
                    <div className="muted">${p.price}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      庫存: {p.stock || 0}
                    </div>
                    {p.description && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                        {p.description.length > 50 ? p.description.substring(0, 50) + '...' : p.description}
                      </div>
                    )}
                    <div style={{ fontSize: 12, marginTop: 4 }}>{p.command}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button 
                      className="btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditProduct(p);
                      }}
                      style={{ flex: 1, fontSize: 12, padding: '6px 12px' }}
                    >
                      編輯
                    </button>
                    <button 
                      className={p.active ? "btn ghost" : "btn"}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleActive(p.id, p.active);
                      }}
                      style={{ flex: 1, fontSize: 12, padding: '6px 12px' }}
                    >
                      {p.active ? '下架' : '上架'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Orders Tab - List View */}
      {activeTab === 'orders' && !selectedOrder && (
        <div>
          <h3>訂單管理</h3>
          {loadError && <div className="card" style={{color:'var(--danger)'}}>{loadError}</div>}
          {(!loadError && orders.length===0) ? <div className="card">尚無訂單</div> : null}
          {(!loadError && orders.length>0) && (
            <>
              <div style={{display:'grid',gap:12}}>
                {paginatedOrders.map(o => (
                  <div key={o.orderGroupId} className="card" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:16}}>訂單 #{o.orderGroupId ? o.orderGroupId.substring(0,8) : 'N/A'}</div>
                      <div style={{marginTop:4,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,fontSize:14}}>
                        <div>
                          <span className="muted">買家：</span>
                          <span style={{fontWeight:500}}>{o.playerid}</span>
                        </div>
                        <div>
                          <span className="muted">總金額：</span>
                          <span style={{fontWeight:700,color:'var(--accent)'}}>${o.totalAmount}</span>
                        </div>
                        <div>
                          <span className="muted">商品數：</span>
                          <span style={{fontWeight:500}}>{o.itemCount}</span>
                        </div>
                      </div>
                      <div className="muted" style={{fontSize:13,marginTop:4}}>
                        {o.createdAt ? new Date(o.createdAt).toLocaleString() : ''}
                      </div>
                    </div>
                    
                    <button 
                      className="btn" 
                      onClick={() => handleViewOrderDetails(o.orderGroupId)}
                      style={{fontSize:13,padding:'8px 16px',whiteSpace:'nowrap'}}
                    >
                      訂單詳情
                    </button>
                  </div>
                ))}
              </div>
              
              {totalOrderPages > 1 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 24
                }}>
                  <button
                    className="btn ghost"
                    onClick={() => setOrderPage(p => Math.max(1, p - 1))}
                    disabled={orderPage === 1}
                    style={{
                      opacity: orderPage === 1 ? 0.5 : 1,
                      cursor: orderPage === 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    上一頁
                  </button>
                  <span style={{ fontWeight: 600 }}>
                    第 {orderPage} / {totalOrderPages} 頁
                  </span>
                  <button
                    className="btn ghost"
                    onClick={() => setOrderPage(p => Math.min(totalOrderPages, p + 1))}
                    disabled={orderPage === totalOrderPages}
                    style={{
                      opacity: orderPage === totalOrderPages ? 0.5 : 1,
                      cursor: orderPage === totalOrderPages ? 'not-allowed' : 'pointer'
                    }}
                  >
                    下一頁
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Order Detail View */}
      {activeTab === 'orders' && selectedOrder && (
        <div>
          <button 
            className="btn ghost" 
            onClick={() => setSelectedOrder(null)}
            style={{marginBottom:16}}
          >
            ← 返回訂單列表
          </button>
          
          <div className="card" style={{marginBottom:16}}>
            <h3>訂單 #{selectedOrder.orderGroupId ? selectedOrder.orderGroupId.substring(0,8).toUpperCase() : 'N/A'}</h3>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',gap:16,marginTop:16}}>
              <div>
                <div className="muted" style={{fontSize:12}}>買家（遊戲 ID）</div>
                <div style={{fontWeight:600,marginTop:2}}>{selectedOrder.playerid}</div>
              </div>
              {selectedOrder.discordId && (
                <div>
                  <div className="muted" style={{fontSize:12}}>Discord ID</div>
                  <div style={{fontWeight:600,marginTop:2}}>{selectedOrder.discordId}</div>
                </div>
              )}
              <div>
                <div className="muted" style={{fontSize:12}}>總金額</div>
                <div style={{fontWeight:700,fontSize:18,color:'var(--accent)',marginTop:2}}>${selectedOrder.totalAmount}</div>
              </div>
              <div>
                <div className="muted" style={{fontSize:12}}>購買時間</div>
                <div style={{fontWeight:500,marginTop:2}}>
                  {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString() : ''}
                </div>
              </div>
            </div>
            
            {selectedOrder.proofUrl && (
              <div style={{marginTop:16}}>
                <div className="muted" style={{fontSize:12,marginBottom:8}}>付款證明</div>
                <img 
                  src={`/api${selectedOrder.proofUrl}`} 
                  alt="proof" 
                  style={{width:200,borderRadius:8,cursor:'pointer',border:'2px solid var(--muted)'}}
                  onClick={() => setViewingProof(`/api${selectedOrder.proofUrl}`)}
                  title="點擊放大檢視"
                />
              </div>
            )}
          </div>
          
          <h4 style={{marginBottom:12}}>購買商品</h4>
          <div style={{display:'grid',gap:12}}>
            {selectedOrder.items && selectedOrder.items.map(item => (
              <div key={item.id} className="card" style={{display:'flex',gap:16,alignItems:'center'}}>
                {item.productImage && (
                  <img 
                    src={`/api${item.productImage}`} 
                    alt={item.productName}
                    style={{width:80,height:80,objectFit:'cover',borderRadius:8}}
                  />
                )}
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:16}}>{item.productName}</div>
                  <div style={{color:'var(--accent)',fontWeight:600,marginTop:4}}>${item.productPrice}</div>
                  {item.rconResult && (
                    <div style={{fontSize:12,marginTop:4,color:'var(--muted)'}}>
                      執行結果: {item.rconResult}
                    </div>
                  )}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6,alignItems:'flex-end',minWidth:120}}>
                  <div style={{
                    fontWeight:700,
                    fontSize:13,
                    padding:'4px 12px',
                    borderRadius:4,
                    background: item.status==='approved' ? 'var(--success)' : item.status==='rejected' ? 'var(--danger)' : 'var(--accent)',
                    color:'white'
                  }}>
                    {item.status}
                  </div>
                  {item.status === 'pending' && (
                    <div style={{display:'flex',flexDirection:'column',gap:4,width:'100%'}}>
                      <button 
                        className="btn" 
                        onClick={() => handleApproveItem(item.id)}
                        style={{fontSize:12,padding:'6px 12px'}}
                      >
                        Approve
                      </button>
                      <button 
                        className="btn ghost" 
                        onClick={() => handleRejectItem(item.id)}
                        style={{fontSize:12,padding:'6px 12px'}}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ProductEditModal
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onSave={handleSaveProduct}
      />

      {viewingProof && (
        <div 
          style={{
            position:'fixed',
            top:0,
            left:0,
            width:'100vw',
            height:'100vh',
            background:'rgba(0,0,0,0.8)',
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            zIndex:1000,
            cursor:'pointer'
          }}
          onClick={() => setViewingProof(null)}
        >
          <div style={{position:'relative',maxWidth:'90%',maxHeight:'90%'}}>
            <img 
              src={viewingProof} 
              alt="付款證明" 
              style={{
                maxWidth:'100%',
                maxHeight:'90vh',
                borderRadius:8,
                boxShadow:'0 8px 32px rgba(0,0,0,0.5)'
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              style={{
                position:'absolute',
                top:10,
                right:10,
                background:'rgba(255,255,255,0.9)',
                border:'none',
                borderRadius:'50%',
                width:36,
                height:36,
                fontSize:20,
                cursor:'pointer',
                fontWeight:'bold',
                display:'flex',
                alignItems:'center',
                justifyContent:'center'
              }}
              onClick={() => setViewingProof(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
