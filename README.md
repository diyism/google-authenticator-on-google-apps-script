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
```

### 第三步：编写前端界面 (Index.html)
点击左侧的文件列表旁边的 “+” 号，选择 “HTML”，命名为 Index。粘贴以下代码：

```html
<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <style>
      body { font-family: 'Segoe UI', Roboto, Helvetica, sans-serif; background-color: #f5f5f5; color: #333; max-width: 400px; margin: 0 auto; padding: 20px; }
      h2 { text-align: center; color: #4285f4; }
      
      /* 卡片样式 */
      .card { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
      .account-name { font-size: 14px; color: #666; font-weight: 500; }
      .otp-code { font-size: 24px; font-family: monospace; color: #4285f4; font-weight: bold; letter-spacing: 2px; }
      .delete-btn { color: #ff4444; cursor: pointer; font-size: 18px; margin-left: 10px; border: none; background: none; }
      
      /* 输入区域 */
      .input-group { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
      input { width: 100%; padding: 10px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
      button { width: 100%; padding: 10px; background-color: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
      button:hover { background-color: #357abd; }
      
      /* 进度条 */
      .progress-bar { height: 4px; background-color: #e0e0e0; margin-bottom: 20px; border-radius: 2px; overflow: hidden; }
      .progress-fill { height: 100%; background-color: #4285f4; width: 100%; transition: width 1s linear; }
      
      .loader { text-align: center; margin-top: 20px; color: #888; }
    </style>
  </head>
  <body>
    <h2>Web Authenticator</h2>
    
    <div class="progress-bar">
      <div id="progress" class="progress-fill"></div>
    </div>

    <div id="code-list">
      <div class="loader">正在加载验证码...</div>
    </div>

    <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">

    <div class="input-group">
      <h3>添加新账号</h3>
      <input type="text" id="new-name" placeholder="账号名称 (如: Google, Github)">
      <input type="text" id="new-secret" placeholder="密钥 (Base32 Key, 如: JBSWY...)" autocomplete="off">
      <button onclick="addAccount()">添加</button>
    </div>

    <script>
      // 页面加载后立即获取
      window.onload = function() {
        refreshCodes();
        startTimer();
      };

      // 定时刷新逻辑
      function startTimer() {
        setInterval(() => {
          const epoch = Math.floor(Date.now() / 1000);
          const seconds = epoch % 30;
          const remaining = 30 - seconds;
          
          // 更新进度条
          const percentage = (remaining / 30) * 100;
          document.getElementById('progress').style.width = percentage + '%';

          // 刚好过30秒时刷新数据 (或者当剩余时间为29秒时，给一点缓冲)
          if (remaining === 30 || remaining === 0) {
            refreshCodes();
          }
        }, 1000);
      }

      // 从后端获取数据
      function refreshCodes() {
        google.script.run.withSuccessHandler(renderCodes).getCodes();
      }

      // 渲染列表
      function renderCodes(data) {
        const container = document.getElementById('code-list');
        if (data.length === 0) {
          container.innerHTML = '<div class="loader">暂无账号，请在下方添加。</div>';
          return;
        }

        let html = '';
        data.forEach(item => {
          // 格式化 123456 -> 123 456
          const formatted = item.code.slice(0,3) + ' ' + item.code.slice(3);
          html += `
            <div class="card">
              <div>
                <div class="account-name">${item.name}</div>
                <div class="otp-code">${formatted}</div>
              </div>
              <button class="delete-btn" onclick="deleteAccount('${item.name}')">&times;</button>
            </div>
          `;
        });
        container.innerHTML = html;
      }

      // 添加账号
      function addAccount() {
        const name = document.getElementById('new-name').value;
        const secret = document.getElementById('new-secret').value;
        
        if(!name || !secret) {
          alert("请填写名称和密钥");
          return;
        }

        const btn = document.querySelector('button');
        btn.textContent = '添加中...';
        btn.disabled = true;

        google.script.run.withSuccessHandler(() => {
          document.getElementById('new-name').value = '';
          document.getElementById('new-secret').value = '';
          btn.textContent = '添加';
          btn.disabled = false;
          refreshCodes();
        }).withFailureHandler((e) => {
          alert("错误: " + e.message);
          btn.textContent = '添加';
          btn.disabled = false;
        }).addAccount(name, secret);
      }

      // 删除账号
      function deleteAccount(name) {
        if(confirm('确定要删除 ' + name + ' 吗?')) {
          google.script.run.withSuccessHandler(refreshCodes).deleteAccount(name);
        }
      }
    </script>
  </body>
</html>
```

### 第四步：测试与部署

1. **部署项目**：
    * 点击编辑器右上角的 **“部署 (Deploy)”** -> **“新建部署 (New deployment)”**。
    * 点击左上角的齿轮图标 ⚙️ -> 选择 **“Web 应用 (Web app)”**。
2. **配置选项**：
    * **执行身份 (Execute as)**：选择 **“我 (Me)”**。
    * **谁可以访问 (Who has access)**：**强烈建议**选择 **“仅限我自己 (Only myself)”** (出于安全考虑，防止他人访问你的验证码)。
3. **完成发布**：
    * 点击 **“部署”** 按钮。
    * 复制生成的 **“Web App URL”**。
    * 在浏览器中打开该链接即可开始使用。

#### 🔑 如何获取密钥 (Secret Key)?
当你在第三方网站（如 Google, Github, Facebook）开启两步验证 (2FA) 时：
1.  通常网页会显示一个二维码供 App 扫描。
2.  寻找二维码旁边的 **“无法扫描？”**、**“手动输入”** 或 **“显示密钥 (Show Secret Key)”** 链接。
3.  点击后会显示一串字母和数字（例如 `JBSWY3DPEHPK3PXP`）。
4.  将这串字符复制并粘贴到本工具的 **“密钥”** 输入栏中即可。

---

## 📦 功能说明

* **录入账号**：
    * 在界面下方输入“账号名称”和“密钥”。
    * 数据存储在 Google 账号的 `UserProperties` 中。这是 Google 提供的私有存储空间，**只有该脚本和你本人的 Google 账号**有权限访问，脚本的其他协作者（如果有）无法直接查看该数据。
* **查看验证码**：
    * 界面会自动计算并显示所有已保存账号的当前 6 位验证码。
* **自动刷新**：
    * 顶部设有倒计时进度条。
    * 每当 30 秒周期结束验证码失效时，前端页面会自动请求后端，获取并更新最新的验证码。

## 💡 进阶优化建议

如果你需要更高的安全性或便携性，可以考虑以下改进方向：

* **本地计算 (Client-side Calculation)**：
    * **现状**：目前的逻辑是后端计算 TOTP，前端只负责显示。
    * **改进**：可以修改代码，仅从后端获取加密后的密钥，然后在前端浏览器使用 JavaScript（例如引入 `jsSHA` 库）在本地计算 TOTP。
    * **优势**：密钥只需在加载时传输一次，后续的时间计算完全在本地浏览器完成，减少了网络请求，理论上更安全且响应更快。
