# 快速啟動指南

## 🚀 5 分鐘快速部署

### 第一步：克隆項目
```bash
git clone <your-repo-url>
cd minecraft-shop
```

### 第二步：配置密碼

編輯 `docker-compose.yml`，找到並修改以下三處密碼：

1. **數據庫密碼**（第 9 行）：
```yaml
POSTGRES_PASSWORD: your_secure_db_password_here
```

2. **API 配置**（第 20、23、26 行）：
```yaml
PGPASSWORD: your_secure_db_password_here      # 與數據庫密碼一致
ADMIN_PASSWORD: your_admin_password_here       # 設置管理員密碼
RCON_PASSWORD: your_rcon_password_here         # 設置 RCON 密碼
```

3. **Minecraft 服務器**（第 60 行）：
```yaml
RCON_PASSWORD: your_rcon_password_here         # 與上面的 RCON 密碼一致
```

### 第三步：啟動服務
```bash
docker-compose up -d
```

### 第四步：訪問系統

等待 1-2 分鐘後訪問：
- **商店**: http://localhost:8880
- **管理員**: http://localhost:8880/admin/login
- **Minecraft**: localhost:25565

---

## 📝 詳細配置（可選）

### PayPal 自動付款（可選）

如果您想啟用 PayPal 自動付款：

1. 訪問 https://developer.paypal.com/dashboard/
2. 創建應用並獲取憑證
3. 編輯 `api/paypal-config.json`：

```json
{
  "mode": "sandbox",
  "client_id": "您的_CLIENT_ID",
  "client_secret": "您的_CLIENT_SECRET"
}
```

4. 重啟服務：
```bash
docker-compose restart api
```

### 自定義配置

**修改端口**（在 `docker-compose.yml`）：
```yaml
ports:
  - "8880:8880"    # 網站端口
  - "18081:18081"  # API 端口
  - "25565:25565"  # Minecraft 端口
```

**調整服務器內存**（在 `docker-compose.yml`）：
```yaml
MEMORY: "12G"  # 根據您的硬件調整
```

**修改 Minecraft 版本**（在 `docker-compose.yml`）：
```yaml
VERSION: "1.21.10"  # 更改為您需要的版本
```

---

## ✅ 檢查清單

啟動前請確認：

- [ ] 已修改 `docker-compose.yml` 中的所有密碼
- [ ] 所有密碼已正確填寫（數據庫、管理員、RCON）
- [ ] RCON 密碼在兩處保持一致
- [ ] Docker 已安裝並運行
- [ ] 端口未被占用（8880, 18081, 25565）

---

## 🎮 使用流程

### 管理員操作

1. 訪問 http://localhost:8880/admin/login
2. 使用您設置的 `ADMIN_PASSWORD` 登入
3. 添加商品：
   - 填寫商品信息
   - 上傳圖片
   - **重要**：設置 RCON 指令，例如：
     ```
     give {playerid} diamond 64
     ```
   - `{playerid}` 會自動替換為玩家 ID

### 玩家操作

1. 訪問 http://localhost:8880
2. 註冊帳號（使用 Minecraft 玩家 ID）
3. 登入並瀏覽商品
4. 添加商品到購物車
5. 結帳並選擇付款方式：
   - **上傳付款證明**：上傳截圖，等待管理員審核
   - **PayPal 付款**：即時付款，自動發貨

---

## 🔧 常用命令

```bash
# 啟動服務
docker-compose up -d

# 停止服務
docker-compose down

# 重啟服務
docker-compose restart

# 查看日誌
docker-compose logs -f

# 查看特定服務日誌
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs mc-spigot

# 備份數據庫
docker exec app-db-1 pg_dump -U mcshop mcshop > backup.sql

# 進入容器
docker exec -it app-api-1 sh
docker exec -it mc-spigot bash
```

---

## ⚠️ 故障排除

### 服務無法啟動
```bash
docker-compose logs -f
```
查看錯誤信息

### 無法訪問網站
1. 確認服務已啟動：`docker-compose ps`
2. 檢查端口是否被占用
3. 等待 1-2 分鐘讓服務完全啟動

### 管理員無法登入
確認您輸入的密碼與 `docker-compose.yml` 中的 `ADMIN_PASSWORD` 一致

### Minecraft 服務器連接失敗
1. 等待服務器完全啟動（可能需要 3-5 分鐘）
2. 檢查日誌：`docker logs mc-spigot`

---

更多詳細信息請查看 [完整 README](README.md)
