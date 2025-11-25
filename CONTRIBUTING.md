# 貢獻指南

感謝您對 Minecraft Shop 項目的興趣！

## 🤝 如何貢獻

### 報告 Bug

如果您發現了 bug，請：

1. 檢查 [Issues](../../issues) 確認該問題尚未被報告
2. 創建新的 Issue，包含：
   - 清晰的標題
   - 詳細的問題描述
   - 復現步驟
   - 預期行為 vs 實際行為
   - 系統環境信息（OS、Docker 版本等）
   - 相關日誌或截圖

### 提出新功能

1. 創建新的 Issue，標記為 "enhancement"
2. 詳細描述功能需求和使用場景
3. 等待社區討論和反饋

### 提交代碼

1. Fork 本倉庫
2. 創建您的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

### Pull Request 要求

- 代碼風格保持一致
- 添加必要的註釋
- 更新相關文檔
- 確保不破壞現有功能
- 一個 PR 只做一件事

## 📝 開發環境設置

### 後端開發

```bash
cd api
npm install
npm start  # 或使用 nodemon 進行熱重載
```

### 前端開發

```bash
cd web
npm install
npm run dev
```

### 使用 Docker 開發

```bash
docker-compose up --build
```

## 🧪 測試

目前項目尚未包含自動化測試。歡迎貢獻測試代碼！

## 📋 代碼規範

### JavaScript/Node.js
- 使用 ES6+ 語法
- 使用 2 空格縮進
- 使用有意義的變量名
- 適當添加註釋

### React
- 使用函數式組件和 Hooks
- 保持組件單一職責
- 適當拆分組件

## 🏗️ 項目結構

```
.
├── api/              # 後端 API
│   ├── index.js     # Express 主程序
│   ├── init.sql     # 數據庫初始化
│   └── ...
├── web/              # 前端應用
│   ├── src/
│   │   ├── pages/   # 頁面組件
│   │   ├── components/  # 共用組件
│   │   └── services/    # API 服務
│   └── ...
└── ...
```

## 📄 Commit 訊息規範

使用清晰的 commit 訊息：

```
feat: 添加新功能
fix: 修復 bug
docs: 文檔更新
style: 代碼格式調整
refactor: 代碼重構
test: 測試相關
chore: 其他修改
```

範例：
```
feat: 添加商品搜索功能
fix: 修復購物車數量更新問題
docs: 更新 README 安裝說明
```

## 🎯 優先開發項目

歡迎貢獻以下功能：

- [ ] 單元測試和集成測試
- [ ] 商品搜索和篩選
- [ ] 優惠券/折扣碼系統
- [ ] 郵件通知功能
- [ ] 多語言支持
- [ ] 數據統計和報表
- [ ] 更多付款方式（如加密貨幣）
- [ ] 移動端 App

## ❓ 問題和幫助

如有任何問題，可以：

1. 查看 [README](README.md) 和 [QUICKSTART](QUICKSTART.md)
2. 搜索現有的 Issues
3. 創建新的 Issue 提問

## 📜 許可證

提交代碼即表示您同意您的貢獻將遵循 MIT 許可證。

---

感謝您的貢獻！🎉
