// Code.gs - 修复后的完整后端代码

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
      Logger.log('生成TOTP失败 - 账号: ' + name + ', 错误: ' + e.toString());
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

// --- TOTP 核心算法 (修复版) ---

function generateTOTP(secret) {
  // 1. 获取时间步长 (30秒)
  const epoch = Math.round(new Date().getTime() / 1000.0);
  const timeStep = 30;
  let time = Math.floor(epoch / timeStep);

  // 2. 将时间转换为 8 字节的大端序 buffer
  const msg = [];
  for (let i = 7; i >= 0; i--) {
    msg[i] = time & 0xFF;
    time = Math.floor(time / 256);
  }

  // 3. Base32 解码密钥
  const key = base32ToBytes(secret);

  // 4. 将数组转换为字符串再转为字节（确保正确的类型）
  const msgString = msg.map(function(b) { return String.fromCharCode(b); }).join('');
  const keyString = key.map(function(b) { return String.fromCharCode(b); }).join('');

  // 5. HMAC-SHA1 计算
  const hash = Utilities.computeHmacSha1Signature(msgString, keyString);

  // 6. 动态截断 (Dynamic Truncation)
  const offset = hash[hash.length - 1] & 0xf;
  const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

  // 7. 生成 6 位数字
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

/**
 * 测试函数 - 用于验证 TOTP 生成是否正确
 * 可以在脚本编辑器中运行此函数来测试
 */
function testTOTP() {
  // 使用标准测试密钥
  const testSecret = "JBSWY3DPEHPK3PXP";  // 对应 "Hello!"
  const code = generateTOTP(testSecret);
  Logger.log("生成的验证码: " + code);
  Logger.log("验证码长度: " + code.length);
  return code;
}
