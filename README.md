# Minecraft Shop - 我的世界商店系統

一個功能完整的 Minecraft 商店系統，支援商品管理、購物車、訂單處理和自動發貨（通過 RCON）。

## ✨ 主要功能

### 用戶端功能
- 🛒 商品瀏覽和購物車系統
- 💳 三種付款方式：
  - 手動上傳付款證明（需管理員審核）
  - PayPal 自動付款（付款成功後自動發貨）
  - Stripe 信用卡付款（付款成功後自動發貨）
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
- Stripe API (stripe@14.0.0)
- RCON Client

**前端：**
- React + Vite
- React Router
- Axios
- Stripe.js + React Stripe.js

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
git clone https://github.com/alvin1999214/minecraft-shop.git
cd minecraft-shop
```

### 2. 配置您的域名和環境

#### 2.1 修改域名配置（重要！）

如果您使用自己的域名，需要修改以下文件：

**A. Web 前端 Nginx 配置** (`web/nginx.conf`)

```nginx
location /api/ {
    proxy_pass http://api:18081/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

如果您的 API 部署在不同的域名或端口，請相應修改 `proxy_pass`。

**B. 前端 API 基礎 URL** (`web/src/services/api.js`)

找到並修改：
```javascript
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api'  // 生產環境使用相對路徑（通過 Nginx 代理）
  : 'http://localhost:18081';  // 開發環境直接連接 API
```

如果您的 API 在不同域名（如 `https://api.yourdomain.com`），請修改為：
```javascript
const API_BASE_URL = 'https://api.yourdomain.com';
```

#### 2.2 配置環境變量和密碼

編輯 `docker-compose.yml` 文件，**必須修改**以下配置：

```yaml
services:
  db:
    environment:
      POSTGRES_PASSWORD: your_secure_db_password_here  # 改為強密碼

  api:
    environment:
      PGPASSWORD: your_secure_db_password_here    # 與上面數據庫密碼一致
      ADMIN_PASSWORD: your_admin_password_here     # 管理員登入密碼
      RCON_PASSWORD: your_rcon_password_here       # Minecraft RCON 密碼

  mc-spigot:
    environment:
      RCON_PASSWORD: your_rcon_password_here       # 與 API 中的 RCON 密碼一致
```

#### 2.3 配置端口（可選）

如果需要修改服務端口，編輯 `docker-compose.yml`：

```yaml
services:
  web:
    ports:
      - "8880:8880"  # 改為您想要的端口，如 "80:8880"
  
  api:
    ports:
      - "18081:18081"  # 改為您想要的端口
  
  mc-spigot:
    ports:
      - "25565:25565"  # Minecraft 遊戲端口
      - "25575:25575"  # RCON 端口
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
- 如不使用 PayPal，系統仍可正常運行（僅支援手動付款和 Stripe）

### 4. 配置 Stripe（可選）

如果您想啟用 Stripe 信用卡付款功能：

1. 訪問 [Stripe Dashboard](https://dashboard.stripe.com/)
2. 註冊或登入您的 Stripe 帳號
3. 在左側選單中選擇 **開發者** > **API 金鑰**
4. 複製您的 API 金鑰（測試模式以 `sk_test_` 和 `pk_test_` 開頭）
5. 編輯 `api/stripe-config.json`（從 `stripe-config.example.json` 複製）：

```json
{
  "secret_key": "sk_test_your_stripe_secret_key",
  "publishable_key": "pk_test_your_stripe_publishable_key"
}
```

**Stripe 測試卡號：**
- 成功付款：`4242 4242 4242 4242`
- 有效期：任何未來日期（如 12/34）
- CVC：任意 3 位數字（如 123）

**重要提醒：**
- ⚠️ TWD（新台幣）最低金額：NT$20（由於 Stripe 匯率轉換限制）
- ⚠️ Stripe 內部將 TWD 視為有小數位貨幣（100 units = 1 TWD）
- ✅ 系統已自動處理金額轉換，無需手動調整
- 如不使用 Stripe，系統仍可正常運行

### 5. 啟動服務

```bash
docker-compose up -d
```

### 5. 訪問系統

等待所有服務啟動完成（約 1-2 分鐘），然後訪問：

- **商店網站**: http://localhost:8880（或您的域名）
- **管理員登入**: http://localhost:8880/admin/login
- **Minecraft 服務器**: localhost:25565

## 🌐 部署到生產環境（使用自己的域名）

### 完整配置清單

如果您要部署到生產環境並使用自己的域名（如 `https://shop.yourdomain.com`），請按照以下步驟修改所有相關配置：

#### 1. 域名相關配置

**文件：`web/src/services/api.js`**
```javascript
// 修改 API 基礎 URL
const API_BASE_URL = 'https://yourdomain.com/api';
// 或如果 API 在子域名：'https://api.yourdomain.com'
```

**文件：`api/ecpay-config.json`**（如使用 ECPay）
```json
{
  "test_mode": false,
  "return_url": "https://shop.yourdomain.com/orders",
  "payment_info_url": "https://shop.yourdomain.com/api/ecpay/payment-info",
  "order_result_url": "https://shop.yourdomain.com/api/ecpay/order-result"
}
```

#### 2. HTTPS 設定

**文件：`web/nginx.conf`**

添加 SSL 證書配置（使用 Let's Encrypt 或其他 SSL 提供商）：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com;
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # ... 其他配置保持不變
}
```

#### 3. 環境變量

**文件：`docker-compose.yml`**
```yaml
web:
  environment:
    - NODE_ENV=production
    - VITE_API_URL=https://yourdomain.com/api  # 添加此行
```

#### 4. 付款服務配置

**PayPal (`api/paypal-config.json`):**
```json
{
  "mode": "live",  // 改為 live
  "client_id": "YOUR_LIVE_CLIENT_ID",
  "client_secret": "YOUR_LIVE_CLIENT_SECRET"
}
```

**Stripe (`api/stripe-config.json`):**
```json
{
  "secret_key": "sk_live_...",  // 使用 live 金鑰
  "publishable_key": "pk_live_..."
}
```

**ECPay (`api/ecpay-config.json`):**
```json
{
  "merchant_id": "YOUR_PRODUCTION_MERCHANT_ID",
  "hash_key": "YOUR_PRODUCTION_HASH_KEY",
  "hash_iv": "YOUR_PRODUCTION_HASH_IV",
  "test_mode": false,  // 改為 false
  "return_url": "https://yourdomain.com/orders",
  "payment_info_url": "https://yourdomain.com/api/ecpay/payment-info",
  "order_result_url": "https://yourdomain.com/api/ecpay/order-result"
}
```

#### 5. 防火牆和網路設定

確保開放以下端口：
- `80` (HTTP)
- `443` (HTTPS)
- `25565` (Minecraft)
- 可選：`25575` (RCON，僅在需要外部訪問時)

#### 6. 重新構建和啟動

```bash
# 停止現有服務
docker-compose down

# 重新構建（如修改了 Dockerfile 或配置）
docker-compose build --no-cache

# 啟動服務
docker-compose up -d

# 查看日誌確認啟動成功
docker-compose logs -f
```

### 域名配置檢查清單

在部署前，請確認以下所有項目：

- [ ] `docker-compose.yml` 中的所有密碼已修改
- [ ] `web/src/services/api.js` 中的 API URL 已更新
- [ ] `web/nginx.conf` 中配置了 SSL（如使用 HTTPS）
- [ ] ECPay 配置中的所有 URL 使用您的域名
- [ ] PayPal/Stripe 切換到生產模式並使用正式金鑰
- [ ] 防火牆已開放必要端口
- [ ] DNS 記錄已正確指向您的服務器
- [ ] SSL 證書已安裝並有效（如使用 HTTPS）

### 使用 Docker Compose 覆蓋文件（推薦）

為了避免修改原始 `docker-compose.yml`，您可以創建 `docker-compose.override.yml`：

```yaml
# docker-compose.override.yml
version: '3.8'
services:
  web:
    environment:
      - NODE_ENV=production
      - VITE_API_URL=https://yourdomain.com/api
    ports:
      - "80:8880"
      - "443:8880"
  
  api:
    environment:
      ADMIN_PASSWORD: your_production_admin_password
```

這樣可以保持原始配置文件不變，方便日後更新。

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

系統支援四種付款方式，可根據需求選擇啟用：

### 方式一：手動付款（默認，無需配置）

1. 用戶上傳付款證明截圖
2. 管理員在後台審核
3. 管理員批准後自動執行 RCON 指令發貨

**優點**：無需額外配置，支援任何付款方式
**缺點**：需要人工審核

### 方式二：PayPal 自動付款

1. 配置 PayPal API 憑證（見上文配置章節）
2. 用戶在結帳頁面選擇 PayPal 付款
3. 完成 PayPal 付款後自動批准訂單
4. 系統自動執行 RCON 指令發貨

**優點**：全自動化，支援全球用戶
**缺點**：需要 PayPal 商家帳號

### 方式三：Stripe 信用卡付款

1. 配置 Stripe API 金鑰（見上文配置章節）
2. 用戶在結帳頁面選擇 Stripe 付款
3. 在嵌入的表單中輸入信用卡資訊
4. 付款成功後自動批准訂單並執行 RCON 指令發貨

**優點**：支援信用卡、Alipay、WeChat Pay
**缺點**：TWD 最低金額 NT$20，需要 Stripe 帳號

### 方式四：ECPay 綠界金流（台灣推薦）

1. 配置 ECPay API（見上文配置章節）
2. 用戶選擇 ATM 虛擬帳號或超商代碼繳費
3. 用戶完成轉帳/繳費後，ECPay 通知系統
4. 系統自動批准訂單並執行 RCON 指令發貨

**優點**：
- 支援台灣常用付款方式（ATM、超商）
- 無需信用卡
- 測試模式下會在 10 秒後自動批准（方便開發測試）

**缺點**：僅支援台灣地區，需要 ECPay 商家帳號

**注意**：
- ECPay 僅支援新台幣（TWD）
- ATM 虛擬帳號：3 天內有效
- 超商代碼：7 天內有效
- 測試環境 URL 需要能被 ECPay 伺服器訪問（建議使用 ngrok 等工具）

## 📊 數據庫結構

系統會自動初始化以下數據表：
- `users` - 用戶帳號
- `products` - 商品信息
- `orders` - 訂單記錄
- `cart_items` - 購物車

## 🔒 安全建議

### 必須執行的安全措施

1. **修改所有默認密碼** ⚠️
   - `docker-compose.yml` 中的 `POSTGRES_PASSWORD`
   - `docker-compose.yml` 中的 `ADMIN_PASSWORD`
   - `docker-compose.yml` 中的 `RCON_PASSWORD`

2. **保護敏感配置文件** ⚠️
   - 確保以下文件**不要**提交到 Git：
     - `api/paypal-config.json`
     - `api/stripe-config.json`
     - `api/ecpay-config.json`
     - `api/currency-config.json`
   - 這些文件已在 `.gitignore` 中排除

3. **定期備份數據庫**：
   ```bash
   docker exec app-db-1 pg_dump -U mcshop mcshop > backup.sql
   ```

4. **使用 HTTPS**（生產環境必須）
   - 配置 SSL 證書（Let's Encrypt 免費）
   - 修改 `web/nginx.conf` 添加 SSL 配置

5. **定期更新**
   ```bash
   git pull
   docker-compose pull
   docker-compose up -d --build
   ```

### 生產環境檢查清單

- [ ] 所有密碼已改為強密碼
- [ ] 配置文件已從 `.example.json` 複製並填寫
- [ ] PayPal/Stripe/ECPay 使用正式環境金鑰
- [ ] 已配置 HTTPS 和 SSL 證書
- [ ] 防火牆已正確配置
- [ ] 已設置定期備份
- [ ] 域名 DNS 已正確設置
- [ ] ECPay 回調 URL 可被外部訪問
- [ ] 已測試所有付款流程

## 📁 項目結構

```
.
├── api/                          # 後端 API
│   ├── index.js                 # 主程序
│   ├── init.sql                 # 數據庫初始化腳本
│   ├── package.json             # 依賴配置
│   ├── Dockerfile               # API Docker 配置
│   │
│   ├── paypal-config.example.json    # PayPal 配置範例
│   ├── paypal-config.json            # PayPal 配置（需手動創建）❌ Git
│   │
│   ├── stripe-config.example.json    # Stripe 配置範例
│   ├── stripe-config.json            # Stripe 配置（需手動創建）❌ Git
│   │
│   ├── ecpay-config.example.json     # ECPay 配置範例
│   ├── ecpay-config.json             # ECPay 配置（需手動創建）❌ Git
│   │
│   ├── currency-config.example.json  # 貨幣配置範例
│   ├── currency-config.json          # 貨幣配置（可選）❌ Git
│   │
│   └── uploads/                 # 上傳文件存儲 ❌ Git
│       └── .gitkeep
│
├── web/                          # 前端網頁
│   ├── src/                     # 源代碼
│   │   ├── services/
│   │   │   └── api.js           # API 配置（需修改域名）
│   │   ├── pages/
│   │   └── components/
│   ├── public/                  # 靜態資源
│   ├── nginx.conf               # Nginx 配置（需修改 SSL）
│   ├── package.json
│   └── Dockerfile
│
├── data/                         # Minecraft 服務器數據 ❌ Git
├── docker-compose.yml           # Docker 編排配置（需修改密碼）
├── .gitignore                   # Git 忽略文件
├── README.md                    # 本文件
├── QUICKSTART.md                # 快速開始指南
├── ECPAY_SETUP.md               # ECPay 詳細設置說明
└── CONTRIBUTING.md              # 貢獻指南

註：❌ Git 表示該文件/目錄已在 .gitignore 中排除，不會提交到版本控制
```

## 📝 配置文件說明

### 必須配置的文件

| 文件 | 說明 | 是否必須 |
|------|------|----------|
| `docker-compose.yml` | 修改所有密碼 | ✅ 必須 |
| `web/src/services/api.js` | 修改 API URL（使用自己域名時） | 生產環境必須 |

### 付款配置文件（按需選擇）

| 文件 | 說明 | 範例文件 |
|------|------|----------|
| `api/paypal-config.json` | PayPal 配置 | `paypal-config.example.json` |
| `api/stripe-config.json` | Stripe 配置 | `stripe-config.example.json` |
| `api/ecpay-config.json` | ECPay 配置 | `ecpay-config.example.json` |
| `api/currency-config.json` | 貨幣配置 | `currency-config.example.json` |

**創建配置文件的命令：**
```bash
# 複製範例文件
cp api/paypal-config.example.json api/paypal-config.json
cp api/stripe-config.example.json api/stripe-config.json
cp api/ecpay-config.example.json api/ecpay-config.json
cp api/currency-config.example.json api/currency-config.json

# 然後編輯這些文件，填入您的真實金鑰
```

### 生產環境 vs 開發環境配置差異

| 配置項 | 開發環境 | 生產環境 |
|--------|----------|----------|
| PayPal mode | `sandbox` | `live` |
| Stripe keys | `sk_test_...` | `sk_live_...` |
| ECPay test_mode | `true` | `false` |
| API URL | `http://localhost:18081` | `https://yourdomain.com/api` |
| Web URL | `http://localhost:8880` | `https://yourdomain.com` |
| SSL/HTTPS | 否 | ✅ 必須 |

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

### Stripe API
- `GET /stripe/config` - 獲取 Stripe 可發布金鑰
- `POST /stripe/create-payment-intent` - 創建付款意圖
- `POST /stripe/confirm-payment` - 確認付款並創建訂單

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📜 授權

MIT License

## 📮 聯繫方式

如有問題或建議，請提交 Issue。

---

**注意**: 本項目僅供學習和個人使用。在生產環境部署前，請確保進行充分的安全測試。
