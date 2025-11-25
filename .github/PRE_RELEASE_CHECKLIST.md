# 開源發布前檢查清單

在將項目推送到 GitHub 前，請確認以下事項：

## ✅ 代碼清理

- [x] 刪除所有測試文件和過渡性代碼
- [x] 刪除 migration 腳本
- [x] 刪除舊的 README 文件
- [x] 移除個人敏感信息

## ✅ 配置文件

- [x] `docker-compose.yml` - 所有密碼已替換為佔位符
- [x] `api/paypal-config.json` - PayPal 密鑰已清空
- [x] `.env.example` - 包含配置範例
- [x] `.gitignore` - 正確配置

## ✅ 文檔

- [x] `README.md` - 完整的項目說明
- [x] `QUICKSTART.md` - 快速啟動指南
- [x] `CONTRIBUTING.md` - 貢獻指南
- [x] `LICENSE` - MIT 許可證

## ✅ 目錄結構

- [x] `api/uploads/.gitkeep` - 保留上傳目錄結構
- [x] `data/.gitkeep` - 保留數據目錄結構
- [x] `screenshots/README.md` - 截圖目錄說明

## 📋 需要用戶配置的地方

### docker-compose.yml (3 處)
1. Line 9: `POSTGRES_PASSWORD`
2. Line 20-26: `PGPASSWORD`, `ADMIN_PASSWORD`, `RCON_PASSWORD`
3. Line 60: `RCON_PASSWORD`

### api/paypal-config.json (可選)
- `client_id`
- `client_secret`

## 🚀 發布前最後檢查

### 1. 本地測試
```bash
# 清理舊數據
docker-compose down -v

# 使用佔位符配置測試是否會提示用戶修改
docker-compose up -d
# 應該看到配置錯誤或提示

# 修改為真實配置後重新測試
docker-compose down
# 修改 docker-compose.yml
docker-compose up -d
# 確認服務正常啟動
```

### 2. 檢查敏感信息
```bash
# 搜索可能的密碼或密鑰
git grep -i "password" | grep -v "your_"
git grep -i "secret" | grep -v "YOUR_"
git grep -i "key" | grep -v "YOUR_"
```

### 3. 初始化 Git 倉庫
```bash
git init
git add .
git commit -m "Initial commit: Minecraft Shop System"
```

### 4. 創建 GitHub 倉庫
1. 前往 GitHub 創建新倉庫
2. 不要初始化 README（我們已有）
3. 添加遠程倉庫：
   ```bash
   git remote add origin https://github.com/your-username/minecraft-shop.git
   git branch -M main
   git push -u origin main
   ```

### 5. 倉庫設置
- [ ] 添加項目描述
- [ ] 添加主題標籤（minecraft, shop, docker, paypal）
- [ ] 設置默認分支為 `main`
- [ ] 啟用 Issues
- [ ] 添加項目截圖到 `screenshots/` 目錄
- [ ] 更新 README 添加截圖連結

### 6. 發布說明
建議創建一個 Release：
- 版本號：v1.0.0
- 標題：Initial Release
- 說明：包含功能列表和已知問題

## 📝 推薦的倉庫描述

```
A full-featured Minecraft shop system with shopping cart, dual payment methods (manual + PayPal), and automatic item delivery via RCON. Built with Node.js, React, PostgreSQL, and Docker.
```

## 🏷️ 推薦的標籤

- minecraft
- shop
- ecommerce
- docker
- nodejs
- react
- postgresql
- paypal
- rcon
- paper-server

## ⚠️ 提醒事項

1. 確保沒有真實的密碼或密鑰被提交
2. 確認 `.gitignore` 正確排除敏感文件
3. 測試新用戶能否通過 README 快速部署
4. 準備好回答 Issues 中的問題
5. 考慮設置 GitHub Actions 進行 CI/CD（未來改進）

## 📊 項目統計

- 總文件數：約 50+
- 代碼行數：約 3000+
- 主要語言：JavaScript (Node.js + React)
- Docker 鏡像：4 個（db, api, web, mc-spigot）

---

✅ 所有檢查完成後，您就可以將項目推送到 GitHub 了！

祝項目順利開源！🎉
