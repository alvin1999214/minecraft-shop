# Minecraft Shop - 我的世界商店系統

一個功能完整的 Minecraft 商店系統，支援商品管理、購物車、訂單處理和自動發貨（通過 RCON）。

## ✨ 主要功能

### 用戶端功能
- 🛒 商品瀏覽和購物車系統
- 💳 雙付款方式：
  - 手動上傳付款證明（需管理員審核）
  - PayPal 自動付款（付款成功後自動發貨）
- 📜 訂單歷史查詢
- 🔐 用戶註冊和登入系統

### 管理員功能
- 📦 商品管理（新增、編輯、刪除、上下架）
- 🖼️ 商品圖片上傳
- 📋 訂單管理（審核、批准、拒絕）
- 🎮 自動執行 RCON 指令發放遊戲內物品

### 技術特點
- 🐳 完整 Docker 化部署
- 🔄 自動化訂單處理（PayPal 付款）
- 🎨 現代化 UI 設計
- 📱 響應式網頁設計
- 🔒 JWT 認證系統

## 🛠️ 技術棧

**後端：**
- Node.js + Express
- PostgreSQL 資料庫
- PayPal Checkout Server SDK
- RCON Client

**前端：**
- React + Vite
- React Router
- Axios

**部署：**
- Docker + Docker Compose
- Nginx

**遊戲服務器：**
- Paper (Spigot) 1.21.10

## 📋 系統需求

- Docker 和 Docker Compose
- 至少 2GB RAM（推薦 4GB 以上）
- 用於 Minecraft 服務器至少 12GB RAM（可在 docker-compose.yml 中調整）

## 🚀 快速開始

### 1. 克隆項目

```bash
git clone <your-repo-url>
cd minecraft-shop
```

### 2. 配置環境變量

編輯 `docker-compose.yml` 文件，修改以下配置：

```yaml
# 數據庫密碼
POSTGRES_PASSWORD: your_secure_db_password_here

# API 配置
PGPASSWORD: your_secure_db_password_here  # 與數據庫密碼一致
ADMIN_PASSWORD: your_admin_password_here   # 管理員登入密碼
RCON_PASSWORD: your_rcon_password_here     # Minecraft RCON 密碼

# Minecraft 服務器配置
RCON_PASSWORD: your_rcon_password_here     # 與上面保持一致
```

### 3. 配置 PayPal（可選）

如果您想啟用 PayPal 自動付款功能：

1. 訪問 [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. 創建一個應用並獲取 Client ID 和 Secret
3. 編輯 `api/paypal-config.json`：

```json
{
  "mode": "sandbox",
  "client_id": "YOUR_PAYPAL_CLIENT_ID",
  "client_secret": "YOUR_PAYPAL_CLIENT_SECRET"
}
```

**注意：**
- `mode: "sandbox"` 用於測試環境
- `mode: "live"` 用於生產環境
- 如不使用 PayPal，系統仍可正常運行（僅支援手動付款）

### 4. 啟動服務

```bash
docker-compose up -d
```

### 5. 訪問系統

等待所有服務啟動完成（約 1-2 分鐘），然後訪問：

- **商店網站**: http://localhost:8880
- **管理員登入**: http://localhost:8880/admin/login
- **Minecraft 服務器**: localhost:25565

## 📝 首次使用

### 創建管理員帳號

管理員登入密碼在 `docker-compose.yml` 中的 `ADMIN_PASSWORD` 設置。

訪問 http://localhost:8880/admin/login，輸入密碼登入。

### 創建玩家帳號

1. 訪問 http://localhost:8880
2. 點擊「註冊」
3. 輸入 Minecraft 玩家 ID 和密碼
4. 登入後即可開始購物

### 添加商品

1. 以管理員身份登入
2. 進入管理面板
3. 點擊「新增商品」
4. 填寫商品信息：
   - 商品名稱
   - 價格
   - 描述
   - 上傳圖片
   - **RCON 指令**（重要！）例如：`give {playerid} diamond 64`

**RCON 指令說明：**
- 使用 `{playerid}` 作為玩家 ID 的佔位符
- 系統會自動將 `{playerid}` 替換為實際的玩家 ID
- 範例：`give {playerid} minecraft:diamond 64`

## 🔧 配置說明

### 端口配置

默認端口：
- **8880**: Web 前端
- **18081**: API 後端
- **25565**: Minecraft 遊戲端口
- **25575**: RCON 端口
- **5432**: PostgreSQL（僅內部訪問）

如需修改端口，請編輯 `docker-compose.yml`。

### Minecraft 服務器配置

在 `docker-compose.yml` 的 `mc-spigot` 服務中：

```yaml
environment:
  VERSION: "1.21.10"    # Minecraft 版本
  MEMORY: "12G"          # 服務器內存（根據您的硬件調整）
  MOTD: "Your Server"    # 服務器標題
```

### 數據持久化

所有數據存儲在以下位置：
- **數據庫**: Docker volume `db_data`（自動創建）
- **商品圖片**: `./api/uploads/`（自動創建）
- **Minecraft 數據**: `./data/`（Docker 自動創建和管理）

**注意**：這些目錄不包含在 Git 倉庫中，首次啟動時會自動創建。

## 💳 付款方式說明

### 方式一：手動付款（默認）

1. 用戶上傳付款證明截圖
2. 管理員在後台審核
3. 管理員批准後自動執行 RCON 指令發貨

### 方式二：PayPal 自動付款

1. 配置 PayPal API 憑證（見上文）
2. 用戶在結帳頁面選擇 PayPal 付款
3. 完成 PayPal 付款後自動批准訂單
4. 系統自動執行 RCON 指令發貨

## 📊 數據庫結構

系統會自動初始化以下數據表：
- `users` - 用戶帳號
- `products` - 商品信息
- `orders` - 訂單記錄
- `cart_items` - 購物車

## 🔒 安全建議

1. **修改所有默認密碼**
2. **定期備份數據庫**：
   ```bash
   docker exec app-db-1 pg_dump -U mcshop mcshop > backup.sql
   ```
3. **使用 HTTPS**（生產環境）
4. **定期更新 Docker 鏡像**
5. **不要將 `paypal-config.json` 提交到版本控制**

## 📁 項目結構

```
.
├── api/                      # 後端 API
│   ├── index.js             # 主程序
│   ├── init.sql             # 數據庫初始化腳本
│   ├── package.json         # 依賴配置
│   ├── paypal-config.json   # PayPal 配置（需手動設置）
│   └── uploads/             # 上傳文件存儲
├── web/                      # 前端網頁
│   ├── src/                 # 源代碼
│   └── public/              # 靜態資源
├── data/                     # Minecraft 服務器數據
├── docker-compose.yml       # Docker 編排配置
└── README.md                # 本文件
```

## 🐛 故障排除

### 服務無法啟動

```bash
# 查看日誌
docker-compose logs -f

# 重啟服務
docker-compose restart
```

### PayPal 按鈕不顯示

1. 檢查 `api/paypal-config.json` 是否正確配置
2. 查看瀏覽器控制台錯誤
3. 確認 PayPal Client ID 有效

### RCON 連接失敗

1. 確認 `RCON_PASSWORD` 在所有地方保持一致
2. 等待 Minecraft 服務器完全啟動（可能需要幾分鐘）
3. 檢查 Minecraft 服務器日誌：
   ```bash
   docker logs mc-spigot
   ```

### 數據庫連接錯誤

1. 確認 `PGPASSWORD` 與 `POSTGRES_PASSWORD` 一致
2. 等待數據庫完全啟動
3. 重啟 API 服務：
   ```bash
   docker-compose restart api
   ```

## 🔄 更新和維護

### 更新代碼

```bash
git pull
docker-compose down
docker-compose up --build -d
```

### 備份數據

```bash
# 備份數據庫
docker exec app-db-1 pg_dump -U mcshop mcshop > backup_$(date +%Y%m%d).sql

# 備份上傳文件
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz api/uploads/

# 備份 Minecraft 數據
tar -czf minecraft_backup_$(date +%Y%m%d).tar.gz data/
```

### 恢復數據

```bash
# 恢復數據庫
cat backup.sql | docker exec -i app-db-1 psql -U mcshop -d mcshop
```

## 📄 API 文檔

### 用戶 API
- `POST /auth/register` - 註冊
- `POST /auth/login` - 登入
- `GET /products` - 獲取商品列表
- `GET /cart` - 獲取購物車
- `POST /cart` - 添加到購物車
- `POST /orders/checkout` - 結帳

### 管理員 API
- `POST /admin/login` - 管理員登入
- `GET /admin/products` - 獲取所有商品
- `POST /products` - 新增商品
- `PUT /products/:id` - 更新商品
- `DELETE /products/:id` - 刪除商品
- `GET /admin/orders` - 獲取所有訂單
- `POST /admin/orders/:id/approve` - 批准訂單

### PayPal API
- `GET /paypal/config` - 獲取 PayPal 配置
- `POST /paypal/create-order` - 創建 PayPal 訂單
- `POST /paypal/capture-order` - 捕獲付款

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📜 授權

MIT License

## 📮 聯繫方式

如有問題或建議，請提交 Issue。

---

**注意**: 本項目僅供學習和個人使用。在生產環境部署前，請確保進行充分的安全測試。
