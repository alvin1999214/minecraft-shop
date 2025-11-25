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
      // For admin panel, we want to see all products including inactive ones
      const res = await apiClient.get('/admin/products', { headers: { Authorization: `Bearer ${token}` } });
      setProducts(res.data);
    } catch (e) {
      // Fallback to regular products endpoint if admin endpoint doesn't exist
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

  const handleApprove = async (orderId) => {
    if(!token) return;
    try{
      await apiClient.post(`/admin/orders/${orderId}/approve`,{}, { headers: { Authorization: `Bearer ${token}` } });
      fetchOrders();
    }catch(e){console.error(e)}
  }

  const handleReject = async (orderId) => {
    if(!token) return;
    try{
      await apiClient.post(`/admin/orders/${orderId}/reject`,{}, { headers: { Authorization: `Bearer ${token}` } });
      fetchOrders();
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
      console.log('Updating product:', editingProduct.id);
      // Log FormData contents
      for (let pair of formData.entries()) {
        console.log(pair[0], pair[1]);
      }
      const response = await apiClient.put(`/products/${editingProduct.id}`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`
          // Don't set Content-Type, axios will set it automatically with boundary for multipart/form-data
        },
      });
      console.log('Product updated successfully:', response.data);
      setEditingProduct(null);
      await fetchProducts();
      setSuccess('商品更新成功');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      console.error('商品更新失敗:', e);
      console.error('Error response:', e.response?.data);
      setError(`商品更新失敗: ${e.response?.data?.error || e.message}`);
      setTimeout(() => setError(''), 5000);
      throw e;
    }
  };

  if(!authorized) return null;

  return (
    <div className="container" style={{ marginTop: 40 }}>
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
      <div style={{ marginTop: 40 }}>
        <h3>訂單管理</h3>
        {loadError && <div className="card" style={{color:'var(--danger)'}}>{loadError}</div>}
        {(!loadError && orders.length===0) ? <div className="card">尚無訂單</div> : null}
        {(!loadError && orders.length>0) && (
          <div style={{display:'grid',gap:12}}>
            {orders.map(o => (
              <div key={o.id} className="card" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:700}}>#{String(o.id).substring(0,8)} {o.playerid ? `(${o.playerid})` : ''}</div>
                  <div className="muted">{o.createdAt ? new Date(o.createdAt).toLocaleString() : ''}</div>
                  <div style={{marginTop:8}}>
                    <div className="muted">總額</div>
                    <div style={{fontWeight:700}}>${o.totalAmount}</div>
                  </div>
                  {o.proofUrl && <div style={{marginTop:8}}><img src={o.proofUrl} alt="proof" style={{width:120,borderRadius:6}}/></div>}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8,alignItems:'flex-end'}}>
                  <div style={{fontWeight:700,color:o.status==='approved' ? 'var(--success)' : o.status==='rejected' ? 'var(--danger)' : 'var(--accent)'}}>{o.status}</div>
                  <div style={{display:'flex',gap:8}}>
                    <button className="btn" onClick={()=>handleApprove(o.id)}>Approve</button>
                    <button className="btn ghost" onClick={()=>handleReject(o.id)}>Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ProductEditModal
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onSave={handleSaveProduct}
      />
    </div>
  );
}
