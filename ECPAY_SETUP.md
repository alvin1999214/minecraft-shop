# ECPay 綠界金流設定說明

## 功能說明

本系統整合了 ECPay 綠界金流，支援以下付款方式：
- **ATM 虛擬帳號**：取得虛擬帳號後，可至任何 ATM 轉帳（3天內有效）
- **超商代碼繳費**：取得繳費代碼後，可至 7-11/全家/萊爾富繳費（7天內有效）

付款成功後，訂單將自動批准並在 24 小時內發貨。

## 設定步驟

### 1. 註冊 ECPay 帳號

1. 前往 [ECPay 綠界科技](https://www.ecpay.com.tw/) 註冊商家帳號
2. 完成實名認證和商家審核

### 2. 取得 API 金鑰

**測試環境（Stage）：**
- 登入 [ECPay 測試後台](https://vendor-stage.ecpay.com.tw/)
- 前往「系統開發管理」→「系統介接設定」
- 取得以下資訊：
  - MerchantID（特店編號）
  - HashKey（金鑰）
  - HashIV（向量）

**正式環境（Production）：**
- 登入 [ECPay 正式後台](https://vendor.ecpay.com.tw/)
- 前往相同路徑取得正式環境金鑰

### 3. 配置 ecpay-config.json

複製範例配置文件並編輯：

```bash
cp api/ecpay-config.example.json api/ecpay-config.json
```

編輯 `api/ecpay-config.json` 檔案，填入您的 ECPay 資訊：

```json
{
  "merchant_id": "YOUR_MERCHANT_ID",
  "hash_key": "YOUR_HASH_KEY",
  "hash_iv": "YOUR_HASH_IV",
  "test_mode": true,
  "return_url": "http://localhost:8880/orders",
  "payment_info_url": "http://localhost:18081/api/ecpay/payment-info",
  "order_result_url": "http://localhost:18081/api/ecpay/order-result"
}
```

**參數說明：**

| 參數 | 說明 | 範例 |
|------|------|------|
| `merchant_id` | ECPay 特店編號 | `2000132` |
| `hash_key` | ECPay HashKey | `5294y06JbISpM5x9` |
| `hash_iv` | ECPay HashIV | `v77hoKGq4kWxNNIS` |
| `test_mode` | 測試模式開關 | `true` = 測試環境<br>`false` = 正式環境 |
| `return_url` | 付款完成後返回的前端頁面 | `http://your-domain.com/orders` |
| `payment_info_url` | ATM/超商資訊接收網址（後端） | `http://your-domain.com/api/ecpay/payment-info` |
| `order_result_url` | 付款結果通知網址（後端） | `http://your-domain.com/api/ecpay/order-result` |
| `merchant_id` | ECPay 特店編號 | `2000132` |
| `hash_key` | ECPay HashKey | `5294y06JbISpM5x9` |
| `hash_iv` | ECPay HashIV | `v77hoKGq4kWxNNIS` |
| `test_mode` | 測試模式開關 | `true` = 測試環境<br>`false` = 正式環境 |
| `return_url` | 付款完成後返回的前端頁面 | `http://your-domain.com/orders` |
| `payment_info_url` | ATM/超商資訊接收網址（後端） | `http://your-domain.com:18081/ecpay/payment-info` |
| `order_result_url` | 付款結果通知網址（後端） | `http://your-domain.com:18081/ecpay/order-result` |

### 4. 測試模式與正式模式切換

**測試模式（test_mode: true）：**
- 使用測試環境金鑰
- 不會實際扣款
- 可使用測試帳號進行測試
- API 端點：`https://payment-stage.ecpay.com.tw`

**正式模式（test_mode: false）：**
- 使用正式環境金鑰
- 實際扣款
- 需要正式審核通過的商家帳號
- API 端點：`https://payment.ecpay.com.tw`

**切換方法：**
修改 `ecpay-config.json` 中的 `test_mode` 值，然後重啟 API 服務：

```bash
docker-compose restart api
```

### 5. 設定 ECPay 後台回傳網址

在 ECPay 後台設定以下回傳網址：

**本地開發環境（需使用 ngrok 等工具）：**
```
付款結果通知網址: https://your-ngrok-url.ngrok.io/api/ecpay/order-result
```

**正式環境：**
```
付款結果通知網址: https://your-domain.com/api/ecpay/order-result
```

## 使用限制

- **僅支援新台幣（TWD）**：ECPay 只支援新台幣付款，使用其他貨幣時選項會自動隱藏
- **最低金額限制**：
  - ATM 虛擬帳號：NT$1 起
  - 超商代碼：NT$30 起（各超商可能有不同限制）
  - 超商代碼最高金額：NT$20,000

## 測試方法

### 測試模式測試流程

1. 確認 `test_mode: true`
2. 進入結帳頁面，選擇 ATM 或超商繳費
3. 點擊「取得虛擬帳號」或「取得繳費代碼」
4. 系統會跳轉到 ECPay 測試頁面
5. 測試環境會顯示付款資訊（虛擬帳號或繳費代碼）
6. 在測試環境中可以模擬付款完成

### 正式環境測試

1. 將 `test_mode` 改為 `false`
2. 重啟服務
3. 使用實際金額進行小額測試
4. 確認付款流程和自動發貨功能正常

## 故障排除

### 1. ECPay 選項未顯示

**檢查項目：**
- 確認 `api/ecpay-config.json` 檔案存在
- 確認金鑰設定正確
- 確認當前貨幣為 TWD
- 檢查瀏覽器 Console 是否有錯誤訊息

### 2. 付款後訂單未自動批准

**檢查項目：**
- 確認 ECPay 後台回傳網址設定正確
- 檢查 API 日誌：`docker logs app-api-1`
- 確認防火牆允許 ECPay 伺服器連入
- 驗證 CheckMacValue 是否正確

### 3. 本地開發無法接收回調

**解決方法：**
- 使用 ngrok 或其他內網穿透工具
- 設定公開網址到 ECPay 後台
- 或使用測試環境的模擬功能

## 安全建議

1. **保護配置檔案**：
   - `ecpay-config.json` 已加入 `.gitignore`
   - 不要將金鑰上傳到 GitHub
   
2. **定期更換金鑰**：
   - 定期在 ECPay 後台更換 HashKey 和 HashIV
   
3. **驗證回調**：
   - 系統會自動驗證 ECPay 回調的 CheckMacValue
   - 確保只處理來自 ECPay 的合法請求

4. **使用 HTTPS**：
   - 正式環境必須使用 HTTPS
   - 保護用戶付款資訊安全

## 相關文件

- [ECPay API 文件](https://developers.ecpay.com.tw/)
- [ATM 虛擬帳號串接說明](https://developers.ecpay.com.tw/?p=2856)
- [超商代碼串接說明](https://developers.ecpay.com.tw/?p=2857)

## 技術支援

如有問題，請聯繫：
- ECPay 客服：02-2657-9000
- 系統管理員：查看系統日誌 `docker logs app-api-1`
