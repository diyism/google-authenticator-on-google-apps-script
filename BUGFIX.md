# Bug 修复说明

## 修复的问题

### 1. HTTP 429 错误（请求过于频繁）

**原因**：
- 前端每30秒刷新时在边界条件（0秒和30秒）会重复触发
- 没有并发请求保护，导致请求堆积
- 缺少最小请求间隔限制

**修复方案**：
- ✅ 添加 `isRefreshing` 全局锁，防止并发请求
- ✅ 添加 `MIN_REFRESH_INTERVAL = 25秒`，防止过于频繁
- ✅ 将刷新触发时机从 `remaining === 0 || remaining === 30` 改为 `remaining === 1`
- ✅ 添加完善的错误处理和日志

### 2. TOTP 生成错误（返回 "Error"）

**原因 1：时间戳转换错误**

README 中 `generateTOTP()` 函数的时间戳转换逻辑有严重 bug：

```javascript
// ❌ 错误的代码
for (let i = 7; i >= 0; i--) {
  msg[i] = time & 0xFF;  // 第一次赋值
  var tempTime = time / Math.pow(256, 7-i);
  msg[i] = Math.floor(tempTime) & 0xFF;  // 覆盖了上一行，且计算错误
}
```

这会导致：
- 第一次赋值被第二次覆盖
- `tempTime` 计算方式完全错误
- 生成的字节数组不是正确的大端序格式

**修复方案**：

```javascript
// ✅ 正确的代码
let time = Math.floor(epoch / timeStep);
const msg = [];
for (let i = 7; i >= 0; i--) {
  msg[i] = time & 0xFF;
  time = Math.floor(time / 256);  // 正确的右移操作
}
```

**原因 2：HMAC 函数名称错误**

错误信息：`TypeError: Utilities.computeHmacSha1Signature is not a function`

**根本原因**：Google Apps Script 中**不存在** `computeHmacSha1Signature()` 这个函数！

正确的函数名是 `computeHmacSignature(algorithm, value, key)`，需要指定算法类型。

**原因 3：字节数组编码错误（导致验证码无法验证）**

即使生成了6位数字验证码，但验证不通过的根本原因是：**使用 `String.fromCharCode()` 将字节数组转换为字符串时出错**。

```javascript
// ❌ 错误的做法
const msgString = msg.map(function(b) { return String.fromCharCode(b); }).join('');
const keyString = key.map(function(b) { return String.fromCharCode(b); }).join('');
const hash = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, msgString, keyString);
```

**问题**：
- `String.fromCharCode()` 对于大于127的字节会产生 Unicode 字符（UTF-16）
- 这会导致 HMAC 计算完全错误
- 生成的验证码看起来是6位数字，但与预期值不符

**修复方案**：

Google Apps Script 从 **2018年6月19日** 起支持直接使用字节数组，无需转换为字符串：

```javascript
// ✅ 正确的代码 - 直接使用字节数组
const hash = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, msg, key);
```

**原因 4：有符号字节数组处理错误**

Google Apps Script 返回的字节数组是**有符号的**（-128 到 127），而 TOTP 算法需要无符号字节（0 到 255）。

```javascript
// ❌ 错误 - 没有处理有符号字节
const offset = hash[hash.length - 1] & 0xf;

// ✅ 正确 - 先转换为无符号
const offset = (hash[hash.length - 1] & 0xff) & 0xf;

// 所有字节都需要 & 0xff 来转换为无符号
const binary =
    (((hash[offset] & 0xff) & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
```

**Google Apps Script HMAC API 说明**：
- 函数名：`Utilities.computeHmacSignature(algorithm, value, key)`
- 第一个参数必须是算法枚举值：`Utilities.MacAlgorithm.HMAC_SHA_1`
- 参数可以是字符串或**字节数组**（推荐直接使用字节数组）
- 返回值是**有符号**字节数组（-128 到 127）

## 主要改进

### Code.gs (后端)

1. **修复时间戳转换算法**：正确实现 64 位整数的大端序编码
2. **添加错误日志**：在 catch 块中记录详细错误信息
3. **添加测试函数**：`testTOTP()` 可用于验证算法正确性

### Index.html (前端)

1. **请求频率控制**：
   - 防并发锁机制
   - 最小请求间隔（25秒）
   - 优化触发时机

2. **错误处理增强**：
   - 完整的失败回调处理
   - 429 错误特殊处理
   - 错误信息显示

3. **UI 改进**：
   - 显示密钥错误的账号（红色边框）
   - 错误提示更友好
   - 添加输入验证（trim）

## 部署步骤

1. **复制新代码**：
   - 将 `Code.gs` 的内容粘贴到 script.google.com 的 Code.gs 文件中
   - 将 `Index.html` 的内容粘贴到 script.google.com 的 Index.html 文件中

2. **测试 TOTP 算法**：
   - 在编辑器中选择 `testTOTP` 函数
   - 点击"运行"
   - 在"执行日志"中查看生成的验证码
   - 验证码应该是 6 位数字

3. **重新部署**：
   - 点击"部署" → "管理部署"
   - 选择当前部署 → 点击"编辑"（铅笔图标）
   - "版本"选择"新版本"
   - 点击"部署"

4. **清除缓存**：
   - 清除浏览器缓存或使用隐私模式访问
   - 刷新页面

## 验证修复

修复成功的标志：
- ✅ 验证码显示为 6 位数字（如 "123 456"）
- ✅ 每 30 秒自动刷新一次
- ✅ 控制台无 HTTP 429 错误
- ✅ 验证码可以正常用于登录

如果仍显示 "Error"：
1. 检查密钥格式是否正确（应为 Base32 字符串）
2. 在编辑器中运行 `testTOTP()` 函数查看错误日志
3. 确认已保存并重新部署代码

## 测试用例

标准测试密钥：`JBSWY3DPEHPK3PXP`（对应明文 "Hello!"）

可以添加这个测试账号，验证生成的验证码是否与 Google Authenticator 或其他 TOTP 应用一致。

## 技术细节

### TOTP 算法核心步骤

1. **获取时间步数**：`time = floor(current_time / 30)`
2. **转换为字节数组**：64位大端序整数
3. **Base32 解码密钥**
4. **HMAC-SHA1 计算**：`hash = HMAC-SHA1(msg, key)`
5. **动态截断**：提取 4 字节生成 31 位整数
6. **生成 6 位数字**：`otp = (binary % 1000000)`

### 关键修复点

原代码的 bug 在于步骤 2，错误的字节转换导致 HMAC 输入错误，最终生成的验证码完全不正确。

修复后的算法遵循 [RFC 6238](https://tools.ietf.org/html/rfc6238) 标准。
