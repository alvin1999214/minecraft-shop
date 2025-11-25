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
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div className="card" style={{
        maxWidth: 600,
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>編輯商品</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              color: 'var(--text)',
            }}
          >×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>商品名稱</label>
            <input
              className="input"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <label>價格</label>
            <input
              className="input"
              name="price"
              type="number"
              value={form.price}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <label>庫存數量</label>
            <input
              className="input"
              name="stock"
              type="number"
              value={form.stock}
              onChange={handleChange}
              min="0"
            />
          </div>

          <div className="form-row">
            <label>商品描述</label>
            <textarea
              className="input"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows="3"
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="form-row">
            <label>指令</label>
            <input
              className="input"
              name="command"
              value={form.command}
              onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <label>商品圖片</label>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="預覽"
                style={{
                  width: '100%',
                  maxHeight: 200,
                  objectFit: 'cover',
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              />
            )}
            <input
              className="input"
              name="image"
              type="file"
              accept="image/*"
              onChange={handleChange}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button className="btn" type="submit">保存</button>
            <button className="btn ghost" type="button" onClick={onClose}>取消</button>
          </div>
        </form>
      </div>
    </div>
  );
}
