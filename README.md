# Google Apps Script Web Authenticator

这是一个基于 Google Apps Script (GAS) 实现的轻量级 Web 版 Google Authenticator (TOTP 生成器)。

它允许你在任何支持浏览器的设备上，通过一个私有的 Web 界面录入 2FA 密钥，并查看实时生成的 6 位验证码。

## ⚠️ 安全警告

> **请务必阅读：**
> 1.  **风险提示**：本项目将你的 2FA 密钥（Secrets）存储在 Google Apps Script 的 `PropertiesService` 中。虽然这属于你的私有存储空间，但如果你的 Google 账号被入侵，攻击者将同时获得你的邮件访问权和 2FA 验证码。
> 2.  **使用建议**：**请勿**将此工具用于高价值账号（如银行、主邮箱、支付账户等）。建议仅用于测试、学习或非核心服务的两步验证。
> 3.  **访问权限**：部署时请务必将访问权限设置为 **"仅限我自己 (Only myself)"**。

## ✨ 功能特性

* **无需服务器**：完全运行在 Google 云端脚本上，免费且免维护。
* **数据持久化**：账号和密钥存储在 Google 用户属性中，不会随页面刷新丢失。
* **实时刷新**：内置 30 秒倒计时进度条，自动从后端获取最新验证码。
* **简洁界面**：响应式设计，支持手机和桌面端访问。

## 🚀 部署指南

### 第一步：创建项目
1. 访问 [script.google.com](https://script.google.com)。
2. 点击左上角的 **“新项目 (New Project)”**。
3. 将项目重命名为 `My Web Authenticator`。

### 第二步：配置后端代码
1. 在编辑器左侧，点击 `Code.gs`。
2. 删除原有内容，粘贴以下代码：

```javascript
// Code.gs

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('My Web Authenticator')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * 获取所有已保存账号的当前验证码
 */
function getCodes() {
  const userProps = PropertiesService.getUserProperties();
  const accounts = userProps.getProperties();
  const result = [];

  for (let name in accounts) {
    const secret = accounts[name];
    try {
      const code = generateTOTP(secret);
      result.push({ name: name, code: code });
    } catch (e) {
      result.push({ name: name, code: "Error" });
    }
  }
  return result;
}

/**
 * 添加新账号
 */
function addAccount(name, secret) {
  // 简单的清理和验证
  const cleanSecret = secret.replace(/\s/g, '').toUpperCase();
  if (!cleanSecret) throw new Error("密钥不能为空");
  
  const userProps = PropertiesService.getUserProperties();
  userProps.setProperty(name, cleanSecret);
  return "Success";
}

/**
 * 删除账号
 */
function deleteAccount(name) {
  const userProps = PropertiesService.getUserProperties();
  userProps.deleteProperty(name);
  return "Deleted";
}

// --- TOTP 核心算法 ---

function generateTOTP(secret) {
  // 1. 获取时间步长 (30秒)
  const epoch = Math.round(new Date().getTime() / 1000.0);
  const timeStep = 30;
  const time = Math.floor(epoch / timeStep);

  // 2. 将时间转换为 8 字节的大端 buffer
  const msg = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    msg[i] = time & 0xFF;
    var tempTime = time / Math.pow(256, 7-i); 
    msg[i] = Math.floor(tempTime) & 0xFF;
  }

  // 3. Base32 解码密钥
  const key = base32ToBytes(secret);

  // 4. HMAC-SHA1 计算
  const hash = Utilities.computeHmacSha1Signature(msg, key);

  // 5. 动态截断 (Dynamic Truncation)
  const offset = hash[hash.length - 1] & 0xf;
  const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

  // 6. 生成 6 位数字
  let otp = binary % 1000000;
  
  // 补零
  return ("000000" + otp).slice(-6);
}

// 辅助函数：Base32 解码
function base32ToBytes(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = [];

  for (let i = 0; i < base32.length; i++) {
    const char = base32.charAt(i).toUpperCase();
    const val = alphabet.indexOf(char);
    if (val === -1) continue; // 跳过非 Base32 字符

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xFF);
      bits -= 8;
    }
  }
  return output;
}
