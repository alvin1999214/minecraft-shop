import React, { useState, useEffect } from 'react';
import apiClient, { updateProduct, toggleProductStatus } from '../services/api';
import { useNavigate } from 'react-router-dom';
import ProductEditModal from '../components/ProductEditModal';

export default function AdminPanelPage() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', price: '', command: '', stock: '', description: '', image: null });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadError, setLoadError] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewingProof, setViewingProof] = useState(null);
  const [activeSection, setActiveSection] = useState('products-list');
  const [orderPage, setOrderPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [resetPasswordResult, setResetPasswordResult] = useState(null);
  const ordersPerPage = 10;

  const token = localStorage.getItem('admin_token');
  const navigate = useNavigate();

  useEffect(() => {
    if(!token) { navigate('/admin/login'); return; }
    setAuthorized(true);
    fetchProducts();
    fetchOrders();
    fetchUsers();
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

  const fetchUsers = async () => {
    if(!token) return;
    try{
      const res = await apiClient.get('/admin/users', { headers: { Authorization: `Bearer ${token}` } });
      setUsers(Array.isArray(res.data) ? res.data : []);
    }catch(e){
      setUsers([]);
      console.error('Failed to fetch users:', e);
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
      setTimeout(() => setSuccess(''), 3000);
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

  const handleResetPassword = async (userId) => {
    if(!token) return;
    if(!confirm('確定要重置此用戶的密碼嗎？')) return;
    
    try{
      const res = await apiClient.post(`/admin/users/${userId}/reset-password`, {}, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      setResetPasswordResult(res.data);
    }catch(e){
      alert('重置密碼失敗: ' + (e.response?.data?.error || e.message));
    }
  }

  const handleDeleteUser = async (userId) => {
    if(!token) return;
    if(!confirm('確定要刪除此用戶嗎？此操作不可逆轉！')) return;
    
    try{
      const res = await apiClient.delete(`/admin/users/${userId}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      alert(res.data.message);
      fetchUsers();
    }catch(e){
      alert('刪除失敗: ' + (e.response?.data?.error || e.message));
      if(e.response?.data?.suggestion){
        alert('建議: ' + e.response.data.suggestion);
      }
    }
  }

  if(!authorized) return null;

  const totalOrderPages = Math.ceil(orders.length / ordersPerPage);
  const paginatedOrders = orders.slice(
    (orderPage - 1) * ordersPerPage,
    orderPage * ordersPerPage
  );

  // 統計數據
  const stats = {
    totalProducts: products.length,
    activeProducts: products.filter(p => p.active).length,
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.statuses && o.statuses.includes('pending')).length,
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      {/* 側邊欄 */}
      <aside style={{
        width: 280,
        background: '#1a1a2e',
        color: 'white',
        padding: '24px 0',
        boxShadow: '4px 0 12px rgba(0,0,0,0.1)',
        position: 'fixed',
        height: '100vh',
        overflowY: 'auto',
      }}>
        <div style={{
          padding: '0 24px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          marginBottom: 24,
        }}>
          <h2 style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            管理後台
          </h2>
          <p style={{
            margin: '8px 0 0',
            fontSize: 13,
            color: 'rgba(255,255,255,0.6)',
          }}>
            Minecraft 商店管理系統
          </p>
        </div>

        {/* 統計概覽 */}
        <div style={{ padding: '0 16px 24px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 12,
            padding: 16,
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
              快速統計
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>商品總數</span>
                <span style={{ 
                  fontSize: 18, 
                  fontWeight: 700,
                  color: '#667eea',
                }}>{stats.totalProducts}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>上架中</span>
                <span style={{ 
                  fontSize: 18, 
                  fontWeight: 700,
                  color: '#4ade80',
                }}>{stats.activeProducts}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>訂單總數</span>
                <span style={{ 
                  fontSize: 18, 
                  fontWeight: 700,
                  color: '#fbbf24',
                }}>{stats.totalOrders}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>待處理</span>
                <span style={{ 
                  fontSize: 18, 
                  fontWeight: 700,
                  color: '#f87171',
                }}>{stats.pendingOrders}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 導航選單 */}
        <nav style={{ padding: '0 16px' }}>
          <div style={{ 
            fontSize: 11, 
            fontWeight: 600, 
            color: 'rgba(255,255,255,0.4)',
            marginBottom: 8,
            padding: '0 8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            商品管理
          </div>
          {[
            { id: 'products-list', label: '商品列表', icon: '📦' },
            { id: 'products-add', label: '新增商品', icon: '➕' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              style={{
                width: '100%',
                background: activeSection === item.id ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
                border: activeSection === item.id ? '1px solid rgba(102, 126, 234, 0.3)' : '1px solid transparent',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: activeSection === item.id ? '#667eea' : 'rgba(255,255,255,0.7)',
                fontSize: 14,
                fontWeight: activeSection === item.id ? 600 : 400,
                transition: 'all 0.2s',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div style={{ 
            fontSize: 11, 
            fontWeight: 600, 
            color: 'rgba(255,255,255,0.4)',
            margin: '24px 0 8px',
            padding: '0 8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            訂單管理
          </div>
          <button
            onClick={() => { setActiveSection('orders'); setSelectedOrder(null); }}
            style={{
              width: '100%',
              background: activeSection === 'orders' ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
              border: activeSection === 'orders' ? '1px solid rgba(102, 126, 234, 0.3)' : '1px solid transparent',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: activeSection === 'orders' ? '#667eea' : 'rgba(255,255,255,0.7)',
              fontSize: 14,
              fontWeight: activeSection === 'orders' ? 600 : 400,
              transition: 'all 0.2s',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 18 }}>📋</span>
            訂單列表
            {stats.pendingOrders > 0 && (
              <span style={{
                marginLeft: 'auto',
                background: '#f87171',
                color: 'white',
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 12,
              }}>
                {stats.pendingOrders}
              </span>
            )}
          </button>

          <div style={{ 
            fontSize: 11, 
            fontWeight: 600, 
            color: 'rgba(255,255,255,0.4)',
            margin: '24px 0 8px',
            padding: '0 8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            用戶管理
          </div>
          <button
            onClick={() => { setActiveSection('users'); setResetPasswordResult(null); }}
            style={{
              width: '100%',
              background: activeSection === 'users' ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
              border: activeSection === 'users' ? '1px solid rgba(102, 126, 234, 0.3)' : '1px solid transparent',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: activeSection === 'users' ? '#667eea' : 'rgba(255,255,255,0.7)',
              fontSize: 14,
              fontWeight: activeSection === 'users' ? 600 : 400,
              transition: 'all 0.2s',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 18 }}>👥</span>
            用戶列表
          </button>
        </nav>

        {/* 登出按鈕 */}
        <div style={{ padding: '24px 16px', marginTop: 'auto' }}>
          <button
            onClick={() => {
              localStorage.removeItem('admin_token');
              navigate('/admin/login');
            }}
            style={{
              width: '100%',
              background: 'rgba(248, 113, 113, 0.1)',
              border: '1px solid rgba(248, 113, 113, 0.3)',
              borderRadius: 8,
              padding: '12px 16px',
              cursor: 'pointer',
              color: '#f87171',
              fontSize: 14,
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
          >
            登出
          </button>
        </div>
      </aside>

      {/* 主內容區 */}
      <main style={{
        marginLeft: 280,
        flex: 1,
        padding: 32,
        minHeight: '100vh',
      }}>
        {/* 商品列表 */}
        {activeSection === 'products-list' && (
          <div>
            <div style={{
              background: 'white',
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            }}>
              <h2 style={{ margin: '0 0 8px 0', fontSize: 28, fontWeight: 700, color: '#1a1a2e' }}>
                商品列表
              </h2>
              <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
                管理所有商品的狀態、庫存和資訊
              </p>
            </div>

            {products.length === 0 ? (
              <div style={{
                background: 'white',
                borderRadius: 16,
                padding: 48,
                textAlign: 'center',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
                <h3 style={{ margin: '0 0 8px 0', color: '#1a1a2e' }}>尚無商品</h3>
                <p style={{ margin: '0 0 16px 0', color: '#6b7280' }}>點擊「新增商品」開始上架您的第一個商品</p>
                <button
                  className="btn"
                  onClick={() => setActiveSection('products-add')}
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    padding: '12px 24px',
                    color: 'white',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  新增商品
                </button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 20,
              }}>
                {products.map(p => (
                  <div
                    key={p.id}
                    style={{
                      background: 'white',
                      borderRadius: 16,
                      overflow: 'hidden',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      transition: 'all 0.3s',
                      cursor: 'pointer',
                      border: p.active ? '2px solid #667eea' : '2px solid #e5e7eb',
                      opacity: p.active ? 1 : 0.7,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                    }}
                  >
                    <div style={{ position: 'relative' }}>
                      <img
                        src={p.image ? `/api${p.image}?t=${Date.now()}` : 'https://via.placeholder.com/400'}
                        alt={p.name}
                        style={{
                          width: '100%',
                          height: 200,
                          objectFit: 'cover',
                        }}
                        onClick={() => handleEditProduct(p)}
                      />
                      {!p.active && (
                        <div style={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          background: '#ef4444',
                          color: 'white',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 12px',
                          borderRadius: 16,
                        }}>
                          已下架
                        </div>
                      )}
                      <div style={{
                        position: 'absolute',
                        bottom: 12,
                        left: 12,
                        background: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '6px 12px',
                        borderRadius: 8,
                      }}>
                        庫存: {p.stock || 0}
                      </div>
                    </div>
                    <div style={{ padding: 16 }} onClick={() => handleEditProduct(p)}>
                      <h3 style={{
                        margin: '0 0 8px 0',
                        fontSize: 18,
                        fontWeight: 700,
                        color: '#1a1a2e',
                      }}>
                        {p.name}
                      </h3>
                      <div style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: '#667eea',
                        marginBottom: 8,
                      }}>
                        NT${Math.round(p.price)}
                      </div>
                      {p.description && (
                        <p style={{
                          margin: '0 0 12px 0',
                          fontSize: 13,
                          color: '#6b7280',
                          lineHeight: '1.5',
                          height: 40,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}>
                          {p.description}
                        </p>
                      )}
                      {p.command && (
                        <div style={{
                          fontSize: 11,
                          color: '#6b7280',
                          background: '#f3f4f6',
                          padding: '6px 10px',
                          borderRadius: 6,
                          fontFamily: 'monospace',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {p.command}
                        </div>
                      )}
                    </div>
                    <div style={{
                      padding: '0 16px 16px',
                      display: 'flex',
                      gap: 8,
                    }}>
                      <button
                        className="btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditProduct(p);
                        }}
                        style={{
                          flex: 1,
                          background: '#667eea',
                          color: 'white',
                          border: 'none',
                          padding: '10px',
                          fontSize: 13,
                          fontWeight: 600,
                          borderRadius: 8,
                          cursor: 'pointer',
                        }}
                      >
                        編輯
                      </button>
                      <button
                        className="btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(p.id, p.active);
                        }}
                        style={{
                          flex: 1,
                          background: p.active ? '#ef4444' : '#10b981',
                          color: 'white',
                          border: 'none',
                          padding: '10px',
                          fontSize: 13,
                          fontWeight: 600,
                          borderRadius: 8,
                          cursor: 'pointer',
                        }}
                      >
                        {p.active ? '下架' : '上架'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 新增商品 */}
        {activeSection === 'products-add' && (
          <div>
            <div style={{
              background: 'white',
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            }}>
              <h2 style={{ margin: '0 0 8px 0', fontSize: 28, fontWeight: 700, color: '#1a1a2e' }}>
                新增商品
              </h2>
              <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
                填寫商品資訊並上架到商店
              </p>
            </div>

            <div style={{
              background: 'white',
              borderRadius: 16,
              padding: 32,
              maxWidth: 700,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            }}>
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gap: 20 }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#1a1a2e',
                    }}>
                      商品名稱 *
                    </label>
                    <input
                      className="input"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      required
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: 14,
                        border: '2px solid #e5e7eb',
                        borderRadius: 8,
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#667eea'}
                      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#1a1a2e',
                      }}>
                        價格 *
                      </label>
                      <input
                        className="input"
                        name="price"
                        type="number"
                        value={form.price}
                        onChange={handleChange}
                        required
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          fontSize: 14,
                          border: '2px solid #e5e7eb',
                          borderRadius: 8,
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#667eea'}
                        onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                      />
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#1a1a2e',
                      }}>
                        庫存數量
                      </label>
                      <input
                        className="input"
                        name="stock"
                        type="number"
                        value={form.stock}
                        onChange={handleChange}
                        min="0"
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          fontSize: 14,
                          border: '2px solid #e5e7eb',
                          borderRadius: 8,
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#667eea'}
                        onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#1a1a2e',
                    }}>
                      商品描述
                    </label>
                    <textarea
                      className="input"
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      rows="4"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: 14,
                        border: '2px solid #e5e7eb',
                        borderRadius: 8,
                        resize: 'vertical',
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#667eea'}
                      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#1a1a2e',
                    }}>
                      指令
                    </label>
                    <input
                      className="input"
                      name="command"
                      value={form.command}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: 14,
                        border: '2px solid #e5e7eb',
                        borderRadius: 8,
                        fontFamily: 'monospace',
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#667eea'}
                      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#1a1a2e',
                    }}>
                      商品圖片
                    </label>
                    <input
                      className="input"
                      name="image"
                      type="file"
                      accept="image/*"
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: 14,
                        border: '2px solid #e5e7eb',
                        borderRadius: 8,
                      }}
                    />
                  </div>

                  {error && (
                    <div style={{
                      background: '#fee2e2',
                      color: '#dc2626',
                      padding: '12px 16px',
                      borderRadius: 8,
                      fontSize: 14,
                    }}>
                      {error}
                    </div>
                  )}

                  {success && (
                    <div style={{
                      background: '#d1fae5',
                      color: '#059669',
                      padding: '12px 16px',
                      borderRadius: 8,
                      fontSize: 14,
                    }}>
                      {success}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      className="btn"
                      type="submit"
                      style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '14px',
                        fontSize: 16,
                        fontWeight: 600,
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                    >
                      上架商品
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForm({ name: '', price: '', command: '', stock: '', description: '', image: null });
                        setError('');
                        setSuccess('');
                      }}
                      style={{
                        background: '#f3f4f6',
                        color: '#6b7280',
                        border: 'none',
                        padding: '14px 24px',
                        fontSize: 16,
                        fontWeight: 600,
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                    >
                      重置
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 訂單列表 */}
        {activeSection === 'orders' && !selectedOrder && (
          <div>
            <div style={{
              background: 'white',
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            }}>
              <h2 style={{ margin: '0 0 8px 0', fontSize: 28, fontWeight: 700, color: '#1a1a2e' }}>
                訂單管理
              </h2>
              <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
                查看和處理所有訂單
              </p>
            </div>

            {loadError && (
              <div style={{
                background: 'white',
                borderRadius: 16,
                padding: 24,
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                color: '#dc2626',
              }}>
                {loadError}
              </div>
            )}

            {!loadError && orders.length === 0 && (
              <div style={{
                background: 'white',
                borderRadius: 16,
                padding: 48,
                textAlign: 'center',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                <h3 style={{ margin: '0 0 8px 0', color: '#1a1a2e' }}>尚無訂單</h3>
                <p style={{ margin: 0, color: '#6b7280' }}>當有客戶下單時，訂單會顯示在這裡</p>
              </div>
            )}

            {!loadError && orders.length > 0 && (
              <>
                <div style={{ display: 'grid', gap: 16 }}>
                  {paginatedOrders.map(o => (
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <h3 style={{ 
                              margin: 0, 
                              fontSize: 20, 
                              fontWeight: 700, 
                              color: '#1a1a2e',
                            }}>
                              #{o.orderGroupId ? o.orderGroupId.substring(0, 8).toUpperCase() : 'N/A'}
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
                          </div>

                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: 16,
                          }}>
                            <div>
                              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>買家</div>
                              <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>{o.playerid}</div>
                            </div>
                            {o.discordId && (
                              <div>
                                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Discord ID</div>
                                <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>{o.discordId}</div>
                              </div>
                            )}
                            <div>
                              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>總金額</div>
                              <div style={{ fontSize: 20, fontWeight: 700, color: '#667eea' }}>NT${Math.round(o.totalAmount)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>商品數量</div>
                              <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>{o.itemCount} 件</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>下單時間</div>
                              <div style={{ fontSize: 13, color: '#1a1a2e' }}>
                                {o.createdAt ? new Date(o.createdAt).toLocaleString('zh-TW') : ''}
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleViewOrderDetails(o.orderGroupId)}
                          style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            fontSize: 14,
                            fontWeight: 600,
                            borderRadius: 8,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          查看詳情
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {totalOrderPages > 1 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 16,
                    marginTop: 32,
                  }}>
                    <button
                      onClick={() => setOrderPage(p => Math.max(1, p - 1))}
                      disabled={orderPage === 1}
                      style={{
                        background: orderPage === 1 ? '#f3f4f6' : 'white',
                        color: orderPage === 1 ? '#9ca3af' : '#1a1a2e',
                        border: '2px solid #e5e7eb',
                        padding: '10px 20px',
                        fontSize: 14,
                        fontWeight: 600,
                        borderRadius: 8,
                        cursor: orderPage === 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      ← 上一頁
                    </button>
                    <span style={{ 
                      fontSize: 15, 
                      fontWeight: 600,
                      color: 'white',
                    }}>
                      第 {orderPage} / {totalOrderPages} 頁
                    </span>
                    <button
                      onClick={() => setOrderPage(p => Math.min(totalOrderPages, p + 1))}
                      disabled={orderPage === totalOrderPages}
                      style={{
                        background: orderPage === totalOrderPages ? '#f3f4f6' : 'white',
                        color: orderPage === totalOrderPages ? '#9ca3af' : '#1a1a2e',
                        border: '2px solid #e5e7eb',
                        padding: '10px 20px',
                        fontSize: 14,
                        fontWeight: 600,
                        borderRadius: 8,
                        cursor: orderPage === totalOrderPages ? 'not-allowed' : 'pointer',
                      }}
                    >
                      下一頁 →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 訂單詳情 */}
        {activeSection === 'orders' && selectedOrder && (
          <div>
            <button
              onClick={() => setSelectedOrder(null)}
              style={{
                background: 'white',
                color: '#1a1a2e',
                border: '2px solid #e5e7eb',
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 8,
                cursor: 'pointer',
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              ← 返回訂單列表
            </button>

            {/* 訂單概要 */}
            <div style={{
              background: 'white',
              borderRadius: 16,
              padding: 32,
              marginBottom: 24,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            }}>
              <h2 style={{ margin: '0 0 24px 0', fontSize: 28, fontWeight: 700, color: '#1a1a2e' }}>
                訂單 #{selectedOrder.orderGroupId ? selectedOrder.orderGroupId.substring(0, 8).toUpperCase() : 'N/A'}
              </h2>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 24,
              }}>
                <div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>買家（遊戲 ID）</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a2e' }}>{selectedOrder.playerid}</div>
                </div>
                {selectedOrder.discordId && (
                  <div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Discord ID</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a2e' }}>{selectedOrder.discordId}</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>總金額</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#667eea' }}>NT${Math.round(selectedOrder.totalAmount)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>購買時間</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: '#1a1a2e' }}>
                    {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString('zh-TW') : ''}
                  </div>
                </div>
              </div>

              {selectedOrder.proofUrl && (
                <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>付款證明</div>
                  <img
                    src={`/api${selectedOrder.proofUrl}`}
                    alt="付款證明"
                    style={{
                      maxWidth: 300,
                      borderRadius: 12,
                      cursor: 'pointer',
                      border: '2px solid #e5e7eb',
                      transition: 'transform 0.2s',
                    }}
                    onClick={() => setViewingProof(`/api${selectedOrder.proofUrl}`)}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    title="點擊放大檢視"
                  />
                </div>
              )}
            </div>

            {/* 商品列表 */}
            <div style={{
              background: 'white',
              borderRadius: 16,
              padding: 32,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>
                購買商品
              </h3>

              <div style={{ display: 'grid', gap: 16 }}>
                {selectedOrder.items && selectedOrder.items.map(item => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      gap: 20,
                      padding: 20,
                      border: '2px solid #e5e7eb',
                      borderRadius: 12,
                      alignItems: 'center',
                    }}
                  >
                    {item.productImage && (
                      <img
                        src={`/api${item.productImage}`}
                        alt={item.productName}
                        style={{
                          width: 100,
                          height: 100,
                          objectFit: 'cover',
                          borderRadius: 8,
                        }}
                      />
                    )}

                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>
                        {item.productName}
                      </h4>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#667eea', marginBottom: 8 }}>
                        NT${Math.round(item.productPrice)}
                      </div>
                      {item.rconResult && (
                        <div style={{
                          fontSize: 12,
                          color: '#6b7280',
                          background: '#f3f4f6',
                          padding: '6px 10px',
                          borderRadius: 6,
                          fontFamily: 'monospace',
                          marginTop: 8,
                        }}>
                          執行結果: {item.rconResult}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end', minWidth: 140 }}>
                      <div style={{
                        fontWeight: 700,
                        fontSize: 13,
                        padding: '6px 16px',
                        borderRadius: 20,
                        background: item.status === 'approved' ? '#d1fae5' : item.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                        color: item.status === 'approved' ? '#065f46' : item.status === 'rejected' ? '#991b1b' : '#92400e',
                      }}>
                        {item.status === 'approved' ? '已批准' : item.status === 'rejected' ? '已拒絕' : '待處理'}
                      </div>

                      {item.status === 'pending' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                          <button
                            onClick={() => handleApproveItem(item.id)}
                            style={{
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              padding: '8px 16px',
                              fontSize: 13,
                              fontWeight: 600,
                              borderRadius: 8,
                              cursor: 'pointer',
                            }}
                          >
                            批准
                          </button>
                          <button
                            onClick={() => handleRejectItem(item.id)}
                            style={{
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              padding: '8px 16px',
                              fontSize: 13,
                              fontWeight: 600,
                              borderRadius: 8,
                              cursor: 'pointer',
                            }}
                          >
                            拒絕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 用戶管理 */}
        {activeSection === 'users' && (
          <div>
            <div style={{
              marginBottom: 32,
              paddingBottom: 20,
              borderBottom: '2px solid rgba(255,255,255,0.1)',
            }}>
              <h2 style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 700,
                color: 'white',
              }}>
                👥 用戶管理
              </h2>
              <p style={{
                margin: '8px 0 0',
                fontSize: 14,
                color: 'rgba(255,255,255,0.7)',
              }}>
                共 {users.length} 個註冊用戶
              </p>
            </div>

            {resetPasswordResult && (
              <div style={{
                background: '#4ade80',
                color: 'white',
                padding: 20,
                borderRadius: 12,
                marginBottom: 24,
              }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>
                  ✅ 密碼重置成功
                </h3>
                <div style={{ fontSize: 14, marginBottom: 8 }}>
                  <strong>玩家ID：</strong>{resetPasswordResult.playerid}
                </div>
                <div style={{ 
                  background: 'rgba(0,0,0,0.2)', 
                  padding: 12, 
                  borderRadius: 8,
                  marginBottom: 12,
                  fontFamily: 'monospace',
                  fontSize: 16,
                  letterSpacing: 1,
                }}>
                  <strong>新密碼：</strong> {resetPasswordResult.newPassword}
                </div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  ⚠️ 請將此密碼通過 Discord 發送給用戶，然後關閉此提示
                </div>
                <button
                  onClick={() => setResetPasswordResult(null)}
                  style={{
                    marginTop: 12,
                    padding: '8px 16px',
                    background: 'white',
                    color: '#4ade80',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  關閉
                </button>
              </div>
            )}

            <div style={{
              background: 'white',
              borderRadius: 16,
              padding: 0,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#334155' }}>
                      玩家 ID
                    </th>
                    <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#334155' }}>
                      註冊時間
                    </th>
                    <th style={{ padding: 16, textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td colSpan="3" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                        暫無用戶
                      </td>
                    </tr>
                  )}
                  {users.map(user => (
                    <tr key={user.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: 16 }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {user.playerid}
                        </div>
                      </td>
                      <td style={{ padding: 16, color: '#64748b', fontSize: 14 }}>
                        {new Date(user.created_at).toLocaleString('zh-TW')}
                      </td>
                      <td style={{ padding: 16, textAlign: 'right' }}>
                        <button
                          onClick={() => handleResetPassword(user.id)}
                          style={{
                            padding: '8px 16px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 600,
                            marginRight: 8,
                          }}
                        >
                          🔑 重置密碼
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          style={{
                            padding: '8px 16px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          🗑️ 刪除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <ProductEditModal
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onSave={handleSaveProduct}
      />

      {viewingProof && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            cursor: 'pointer',
          }}
          onClick={() => setViewingProof(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
            <img
              src={viewingProof}
              alt="付款證明"
              style={{
                maxWidth: '100%',
                maxHeight: '90vh',
                borderRadius: 12,
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <button
              style={{
                position: 'absolute',
                top: -16,
                right: -16,
                background: 'white',
                border: 'none',
                borderRadius: '50%',
                width: 48,
                height: 48,
                fontSize: 24,
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1a1a2e',
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
