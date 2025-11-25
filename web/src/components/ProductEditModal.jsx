import React, { useState, useEffect } from 'react';

export default function ProductEditModal({ product, onClose, onSave }) {
  const [form, setForm] = useState({
    name: '',
    price: '',
    stock: '',
    description: '',
    command: '',
    image: null,
  });
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        price: product.price || '',
        stock: product.stock || 0,
        description: product.description || '',
        command: product.command || '',
        image: null,
      });
      setPreviewUrl(product.image ? `/api${product.image}?t=${Date.now()}` : '');
    }
  }, [product]);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'image' && files && files[0]) {
      setForm(f => ({ ...f, image: files[0] }));
      setPreviewUrl(URL.createObjectURL(files[0]));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('price', form.price);
      formData.append('stock', form.stock);
      formData.append('description', form.description);
      formData.append('command', form.command);
      if (form.image) {
        console.log('Appending image file:', form.image.name, form.image.type, form.image.size);
        formData.append('image', form.image);
      }
      console.log('Submitting product update with FormData');
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('保存失敗:', error);
      alert('保存失敗，請重試');
    }
  };

  if (!product) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: 32,
        maxWidth: 600,
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#1a1a2e' }}>編輯商品</h2>
          <button
            onClick={onClose}
            style={{
              background: '#f3f4f6',
              border: 'none',
              borderRadius: '50%',
              width: 40,
              height: 40,
              fontSize: 24,
              cursor: 'pointer',
              color: '#1a1a2e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
            }}
          >×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              marginBottom: 8,
              fontSize: 14,
              fontWeight: 600,
              color: '#1a1a2e',
            }}>商品名稱</label>
            <input
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: 8,
                fontSize: 14,
                fontWeight: 600,
                color: '#1a1a2e',
              }}>價格</label>
              <input
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
              }}>庫存數量</label>
              <input
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

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              marginBottom: 8,
              fontSize: 14,
              fontWeight: 600,
              color: '#1a1a2e',
            }}>商品描述</label>
            <textarea
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

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              marginBottom: 8,
              fontSize: 14,
              fontWeight: 600,
              color: '#1a1a2e',
            }}>指令</label>
            <input
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

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              marginBottom: 8,
              fontSize: 14,
              fontWeight: 600,
              color: '#1a1a2e',
            }}>商品圖片</label>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="預覽"
                style={{
                  width: '100%',
                  maxHeight: 200,
                  objectFit: 'cover',
                  borderRadius: 12,
                  marginBottom: 12,
                  border: '2px solid #e5e7eb',
                }}
              />
            )}
            <input
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

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button 
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
              保存
            </button>
            <button 
              type="button" 
              onClick={onClose}
              style={{
                flex: 1,
                background: '#f3f4f6',
                color: '#6b7280',
                border: 'none',
                padding: '14px',
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
