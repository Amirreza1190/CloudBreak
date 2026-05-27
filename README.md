<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=250&color=gradient&customColorList=0,2,2,5,30&text=CloudBreak&fontSize=90&fontColor=00FFCC&animation=twinkling&fontAlignY=35&desc=Break%20Through%20Every%20Wall&descSize=25&descAlignY=60&descColor=00FFCC" width="100%" />

<br/>

<a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=700&size=22&pause=1000&color=00FFCC&center=true&vCenter=true&width=700&lines=VLESS+%2B+VMEES+on+Cloudflare+Workers;One-Click+Deploy+via+GitHub+Actions;DPI-Proof+%E2%80%94+Real+TLS+%2B+Real+SNI;Free+Forever+%E2%80%94+100k+req%2Fday" alt="Typing SVG" /></a>

<br/><br/>

<a href="../../actions/workflows/deploy-vless.yml">
  <img src="https://img.shields.io/github/actions/workflow/status/AMIR11REZA/CloudBreak/deploy-vless.yml?style=for-the-badge&logo=githubactions&logoColor=white&label=DEPLOY&color=00ffcc&labelColor=0a0a2e" />
</a>
<img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white&labelColor=0a0a2e" />
<img src="https://img.shields.io/badge/Cost-FREE%20FOREVER-brightgreen?style=for-the-badge&logo=cashapp&logoColor=white&labelColor=0a0a2e" />
<img src="https://img.shields.io/badge/Protocols-VLESS%20%2B%20VMess-purple?style=for-the-badge&logo=v2ray&logoColor=white&labelColor=0a0a2e" />
<img src="https://img.shields.io/badge/TLS-GENUINE%20CLOUDFLARE-00ffcc?style=for-the-badge&logo=letsencrypt&logoColor=white&labelColor=0a0a2e" />
<img src="https://img.shields.io/badge/DPI-PROOF-ff4444?style=for-the-badge&logo=shield&logoColor=white&labelColor=0a0a2e" />
<img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge&labelColor=0a0a2e" />

</div>

---

<div align="center">

</div>

```
                                   ████████████████████████████████████████████████████████████████                                                 
                                   ██                                                            ██
                                   ██   ██████╗ ██╗       ██████╗  ██╗   ██╗ ██████╗  ███████╗   ██
                                   ██  ██╔════╝ ██║      ██╔═══██╗ ██║   ██║ ██╔══██╗ ██╔════╝   ██
                                   ██  ██║      ██║      ██║   ██║ ██║   ██║ ██║  ██║ █████╗     ██
                                   ██  ██║      ██║      ██║   ██║ ██║   ██║ ██║  ██║ ██╔══╝     ██
                                   ██  ╚██████╗ ███████╗ ╚██████╔╝ ╚██████╔╝ ██████╔╝ ███████╗   ██
                                   ██   ╚═════╝ ╚══════╝  ╚═════╝   ╚═════╝  ╚═════╝  ╚══════╝   ██
                                   ██                                                            ██
                                   ██        ██████╗  ██████╗  ███████╗  █████╗  ██╗  ██╗        ██
                                   ██        ██╔══██╗ ██╔══██╗ ██╔════╝ ██╔══██╗ ██║ ██╔╝        ██
                                   ██        ██████╔╝ ██████╔╝ █████╗   ███████║ █████╔╝         ██
                                   ██        ██╔══██╗ ██╔══██╗ ██╔══╝   ██╔══██║ ██╔═██╗         ██
                                   ██        ██████╔╝ ██║  ██║ ███████╗ ██║  ██║ ██║  ██╗        ██
                                   ██        ╚═════╝  ╚═╝  ╚═╝ ╚══════╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝        ██
                                   ██                                                            ██
                                   ██         v1.0  |  Free  |  One-Click  |  DPI-Proof          ██
                                   ████████████████████████████████████████████████████████████████
```

---


<div align="center">

### 🌐 Language / زبان

[🇺🇸 **English**](#-english-documentation) &nbsp;|&nbsp; [🇮🇷 **فارسی**](#-مستندات-فارسی)

</div>

---

# 🇺🇸 English Documentation

## 🔬 What is CloudBreak?

**CloudBreak** is a one-click, zero-cost VLESS + VMess proxy engine that runs entirely on **Cloudflare Workers** — deployed in under 60 seconds via GitHub Actions. It defeats Deep Packet Inspection (DPI) not by faking legitimacy, but by *being* legitimate.

> **The key insight:** Tools like V2Ray's Reality protocol *fake* a legitimate TLS certificate. CloudBreak doesn't fake anything — Cloudflare **is** a legitimate host with a **real** cert on a **real** globally-routable domain. DPI sees nothing but ordinary Cloudflare HTTPS traffic.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CloudBreak — Full Traffic Path                         │
└─────────────────────────────────────────────────────────────────────────────┘
 
  ╔══════════════╗     TLS 1.3 (Chrome fp)      ╔═══════════════════╗
  ║  Your Device ║ ──────────────────────────►  ║  Cloudflare Edge  ║
  ║  (V2rayNG)   ║   WebSocket over HTTPS       ║  (200+ PoPs)      ║
  ╚══════════════╝   Port 443 — NEVER blocked   ╚═══════════════════╝
         │                                               │
         │   What DPI sees:                              │  What actually happens:
         │   ✅ Normal HTTPS to Cloudflare CDN           │  Worker parses VLESS header
         │   ✅ Valid TLS cert (not self-signed)         │  Opens TCP to destination
         │   ✅ Real *.workers.dev SNI                   │  Bidirectional proxy
         │   ✅ Standard WebSocket upgrade               │
         │                                               ▼
         │                                     ╔═══════════════════╗
         │                                     ║   Open Internet   ║
         │◄────────────────────────────────────║  google.com       ║
                                               ║  github.com ...   ║
                                               ╚═══════════════════╝
 
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 
  BLOCKED  ──►  V2Ray Direct TCP          ✗ Fingerprinted by DPI
  BLOCKED  ──►  WireGuard UDP             ✗ Port blocked
  BLOCKED  ──►  OpenVPN                   ✗ Certificate mismatch
  ✅ LIVE  ──►  CloudBreak                ✓ Indistinguishable from HTTPS
 
  Client ──[VLESS/WS]──► Cloudflare CDN ──[Worker JS]──► TCP ──► Internet
            TLS 1.3          Real Cert        Pure JS     Port 80/443/any
         (Chrome TLS fp)   *.workers.dev    Zero deps    Any destination
```
 
---

## 🛡️ DPI Evasion Deep-Dive

| What DPI inspects | What DPI actually sees |
|---|---|
| 🔍 Destination IP | Cloudflare anycast IP — globally trusted CDN |
| 🔍 TLS certificate | Genuine Cloudflare cert — full valid chain |
| 🔍 Server Name Indication | Real `*.workers.dev` — whitelisted worldwide |
| 🔍 TLS fingerprint | Standard TLS 1.3 — Chrome browser profile |
| 🔍 HTTP headers | Normal `Connection: Upgrade` WebSocket handshake |
| 🔍 Traffic pattern | Indistinguishable from HTTPS web browsing |
| 🔍 Port number | `443` — never blocked by any ISP |
| 🔍 Application payload | Encrypted VLESS frames inside TLS — fully opaque |

---

## ✨ Features

<table>
<tr>
<td width="50%">

**🔒 Genuine TLS — Not Fake**
Cloudflare's real certificate with full chain validation.
No Reality, no self-signed, no tricks needed.

**🌍 200+ Edge Locations**
Your traffic exits at the nearest Cloudflare PoP
to the destination server — blazing fast.

**🎲 Random WS Path Per Deploy**
New 12-hex-char path every workflow run.
No static fingerprint to blacklist.

**🔑 Per-Deploy UUID Rotation**
Fresh UUID from kernel entropy every run.
Old configs stop working automatically.

</td>
<td width="50%">

**📡 Dual Protocol — VLESS + VMess**
One worker, one subscription URL,
two protocols for maximum client compatibility.

**💸 Free Forever**
Cloudflare Workers free tier: 100k req/day.
GitHub Actions: 2,000 min/month free.
Total cost: $0.

**🚀 60-Second Deploy**
GitHub Actions handles everything:
keygen → deploy → health check → QR codes.

**🔄 One-Click Key Rotation**
Re-run the workflow. New UUID, new path,
new QR codes. That's it.

</td>
</tr>
</table>

---

## 📋 Prerequisites

| Requirement | Where to get it |
|---|---|
| ☁️ Cloudflare account (free) | [dash.cloudflare.com](https://dash.cloudflare.com) |
| 🐙 GitHub account (free) | [github.com](https://github.com) |
| 🔑 Cloudflare API Token | Dashboard → My Profile → API Tokens → *Edit Cloudflare Workers* template |
| 🆔 Cloudflare Account ID | Dashboard → Workers & Pages → right sidebar |

---

## 🚀 Quick Start (5 steps, ~2 minutes)

### Step 1 — Fork this repository

Click **Fork** at the top right of this page.

### Step 2 — Add secrets to your fork

**Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Your API token with `Workers Scripts:Edit` |
| `CLOUDFLARE_ACCOUNT_ID` | Your 32-char account ID |

### Step 3 — Run the workflow

1. **Actions** tab → **"⚡ Deploy CloudBreak Worker"**
2. **Run workflow** → optionally set worker name
3. Click **Run workflow** (green button)

### Step 4 — Get your configs

When the workflow finishes (~60s):
- 📱 **Summary page** → two QR codes, VLESS/VMess links, subscription URL
- 📦 **Artifact** → download config files for offline use

### Step 5 — Connect

| Method | Steps |
|---|---|
| 📱 **Scan QR** | Open V2rayNG → `+` → Scan QR → scan the VLESS QR |
| 📋 **Paste Link** | Copy `vless://...` or `vmess://...` → import in client |
| 🔗 **Subscription** | Add `/sub` URL as subscription source — auto-updates |

---

## 📱 Compatible Clients

| Client | Platform | VLESS | VMess | Subscription | Notes |
|---|---|:---:|:---:|:---:|---|
| [V2rayNG](https://github.com/2dust/v2rayNG) | Android | ✅ | ✅ | ✅ | Most popular Android client |
| [V2rayN](https://github.com/2dust/v2rayN) | Windows | ✅ | ✅ | ✅ | Best Windows client |
| [Hiddify](https://github.com/hiddify/hiddify-next) | All platforms | ✅ | ✅ | ✅ | 🇮🇷 Iranian-made, recommended |
| [Streisand](https://apps.apple.com/app/streisand/id6450534064) | iOS | ✅ | ✅ | ✅ | Free iOS client |
| [Shadowrocket](https://apps.apple.com/app/shadowrocket/id932747118) | iOS | ✅ | ✅ | ✅ | Paid but powerful |
| [Clash.Meta](https://github.com/MetaCubeX/mihomo) | All platforms | ✅ | ✅ | ✅ | Advanced users |
| [NekoBox](https://github.com/MatsuriDayo/NekoBoxForAndroid) | Android | ✅ | ✅ | ✅ | SingBox core |
| [Xray Core](https://github.com/XTLS/Xray-core) | CLI | ✅ | ✅ | — | Power users |

---

## ⚙️ Manual Configuration Reference

```
Protocol:     VLESS
Address:      your-worker-name.workers.dev
Port:         443
UUID:         (from workflow summary)
Encryption:   none
Transport:    WebSocket (ws)
WS Path:      /xxxxxxxxxxxx  (12 random hex chars — from summary)
TLS:          true
SNI:          your-worker-name.workers.dev
Fingerprint:  chrome
ALPN:         h2, http/1.1
```

---

## 🔄 Key Rotation

Every workflow run:
1. **Deletes** the existing worker (fresh start)
2. **Generates** new UUID from `/proc/sys/kernel/random/uuid`
3. **Generates** new WS path via `openssl rand -hex 6`
4. **Deploys** fresh worker with new keys + new QR codes

The `/sub` subscription URL **always reflects current keys** — clients using subscriptions update automatically.

---

## 🌐 Optional: PROXYIP Chaining

If `workers.dev` is blocked by your ISP, set the `proxy_ip` workflow input to a relay server IP you control:

```
Client → Cloudflare Worker → Your relay IP → Internet
```

Two-hop routing defeats even direct `workers.dev` blocks.

---

## 🏗️ Project Structure

```
CloudBreak/
├── worker.js                         # Cloudflare Worker — pure proxy engine
│   ├── VLESS header parser           # Binary protocol implementation
│   ├── WebSocket proxy pump          # Bidirectional WS ↔ TCP relay
│   ├── Subscription generator        # /sub endpoint (VLESS + VMess links)
│   └── Health check                  # /health endpoint (JSON status)
│
├── .github/
│   └── workflows/
│       └── deploy-vless.yml          # GitHub Actions deployment pipeline
│           ├── Key generation         # UUID + WS path from kernel entropy
│           ├── Wrangler deploy        # CF Worker deployment
│           ├── QR code generation     # Python qrcode library
│           └── Step summary           # Beautiful HTML summary with QRs
│
└── README.md                         # You are here
```

---

## 🔐 Security Model

- UUID stored as Cloudflare Worker env var — **encrypted at rest**
- UUID **never** stored in this repo or GitHub secrets
- Each deploy generates completely new credentials
- Random WS path — no discoverable default endpoint
- TLS terminated by Cloudflare — your device never handles raw TLS
- VLESS frames inside TLS — payload is fully opaque to DPI

---

## 📄 License

GPL 3.0 — see [LICENSE](LICENSE)

---
---

# 🇮🇷 مستندات فارسی

<div dir="rtl">

## ⚡ CloudBreak چیست؟

**CloudBreak** یک پروکسی VLESS + VMess هست که روی **Cloudflare Workers** اجرا میشه و با یه کلیک از طریق GitHub Actions در کمتر از ۶۰ ثانیه دیپلوی میشه. هزینه؟ **صفر تومن.**

> **نکته اصلی:** ابزارهایی مثل Reality پروتکل V2Ray سعی می‌کنن گواهی TLS واقعی رو *جعل* کنن. CloudBreak اصلاً نیازی به جعل نداره — Cloudflare خودش یه هاست واقعی‌ـه با گواهی واقعی روی دامنه واقعی. DPI چیزی نمی‌بینه جز ترافیک معمولی HTTPS کلاودفلر.

---

## 🔬 چطور فیلترینگ رو دور میزنه؟

ایران از **Deep Packet Inspection** یا DPI برای فیلتر کردن استفاده می‌کنه. DPI بسته‌های اینترنتی رو اسکن می‌کنه تا پروتکل‌های VPN و پروکسی رو شناسایی کنه.

**CloudBreak چطور رو می‌کنه؟**

| DPI دنبال چی می‌گرده | CloudBreak چی نشون میده |
|---|---|
| 🔍 آدرس IP مقصد | IP آنی‌کست کلاودفلر — CDN معتبر جهانی |
| 🔍 گواهی TLS | گواهی واقعی کلاودفلر — زنجیره کامل معتبر |
| 🔍 فیلد SNI | `*.workers.dev` واقعی — در وایت‌لیست همه جا |
| 🔍 اثرانگشت TLS | TLS 1.3 استاندارد — پروفایل مرورگر Chrome |
| 🔍 هدرهای HTTP | WebSocket upgrade معمولی |
| 🔍 الگوی ترافیک | غیرقابل تشخیص از مرور عادی HTTPS |
| 🔍 شماره پورت | `443` — هیچ ISP‌ای این رو نمیبنده |
| 🔍 محتوای پکت | فریم‌های VLESS داخل TLS — کاملاً رمزنگاری شده |

---

## 🚀 شروع سریع (۵ قدم، ۲ دقیقه)

### قدم ۱ — Fork بگیر

دکمه **Fork** رو در بالای صفحه بزن.

### قدم ۲ — Secret اضافه کن

**Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| نام Secret | مقدار |
|---|---|
| `CLOUDFLARE_API_TOKEN` | توکن API با دسترسی `Workers Scripts:Edit` |
| `CLOUDFLARE_ACCOUNT_ID` | شناسه ۳۲ کاراکتری اکانت |

**توکن API رو از کجا بگیری؟**
داشبورد کلاودفلر → My Profile → API Tokens → Create Token → قالب "Edit Cloudflare Workers"

**Account ID رو از کجا بگیری؟**
داشبورد کلاودفلر → Workers & Pages → نوار کناری راست

### قدم ۳ — Workflow رو اجرا کن

1. تب **Actions** → **"⚡ Deploy CloudBreak Worker"**
2. **Run workflow** → اسم worker رو بذار (اختیاری)
3. دکمه سبز **Run workflow** رو بزن

### قدم ۴ — Config بگیر

وقتی workflow تموم شد (~۶۰ ثانیه):
- 📱 **صفحه Summary** → دو QR کد + لینک‌های VLESS/VMess + آدرس Subscription
- 📦 **Artifact** → دانلود فایل‌های config

### قدم ۵ — وصل شو

| روش | مراحل |
|---|---|
| 📱 **اسکن QR** | V2rayNG رو باز کن → `+` → Scan QR → QR رو اسکن کن |
| 📋 **پیست لینک** | لینک `vless://...` رو کپی کن → import در کلاینت |
| 🔗 **Subscription** | آدرس `/sub` رو به عنوان subscription اضافه کن — خودکار آپدیت میشه |

---

## 📱 کلاینت‌های سازگار

| کلاینت | پلتفرم | توضیح |
|---|---|---|
| [**Hiddify**](https://github.com/hiddify/hiddify-next) | همه پلتفرم‌ها | 🇮🇷 ساخت ایران — **توصیه شده** |
| [**V2rayNG**](https://github.com/2dust/v2rayNG) | اندروید | پرطرفدارترین کلاینت اندروید |
| [**V2rayN**](https://github.com/2dust/v2rayN) | ویندوز | بهترین کلاینت ویندوز |
| [**Streisand**](https://apps.apple.com/app/streisand/id6450534064) | iOS | رایگان برای iPhone |
| [**Shadowrocket**](https://apps.apple.com/app/shadowrocket/id932747118) | iOS | پولی ولی قوی |
| [**NekoBox**](https://github.com/MatsuriDayo/NekoBoxForAndroid) | اندروید | هسته SingBox |

---

## 🔄 چرخش کلید (Key Rotation)

هر بار که workflow رو اجرا کنی:
1. Worker قدیمی **حذف** میشه
2. **UUID جدید** از entropy هسته لینوکس تولید میشه
3. **مسیر WS جدید** با `openssl rand` ساخته میشه
4. Worker جدید با کلیدهای تازه **دیپلوی** میشه

آدرس `/sub` همیشه آخرین کلیدها رو داره — کلاینت‌هایی که subscription دارن خودکار آپدیت میشن.

---

## 🛡️ مدل امنیتی

- UUID به عنوان env var کلاودفلر ذخیره میشه — **رمزنگاری شده**
- UUID **هرگز** در این ریپو یا GitHub Secrets ذخیره نمیشه
- هر دیپلوی کلیدهای کاملاً تازه داره
- مسیر WS تصادفیه — هیچ endpoint پیش‌فرض قابل کشفی وجود نداره

---

## ❓ سوالات متداول

<details>
<summary><strong>آیا استفاده از CloudBreak قانونیه؟</strong></summary>

CloudBreak یک ابزار فنیه. مسئولیت استفاده از آن با کاربر است.

</details>

<details>
<summary><strong>اگه workers.dev خودش فیلتر بشه چی؟</strong></summary>

از قابلیت **PROXYIP** استفاده کن. یه IP رله‌ای که داری رو در ورودی `proxy_ip` وارد کن. ترافیک از طریق اون IP به اینترنت میره.

</details>

<details>
<summary><strong>محدودیت رایگان کلاودفلر چقدره؟</strong></summary>

Workers free tier: **100,000 درخواست در روز**. برای استفاده شخصی کاملاً کافیه.

</details>

<details>
<summary><strong>چقدر سرعت داره؟</strong></summary>

سرعت بستگی داره به نزدیک‌ترین PoP کلاودفلر به شما. معمولاً برای استریم ویدیو و مرور وب کاملاً مناسبه.

</details>

</div>

---

<div align="center">

<!-- ANIMATED FOOTER -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=0,2,2,5,30&height=120&section=footer&text=CloudBreak%20%E2%80%94%20Information%20Wants%20to%20be%20Free&fontSize=16&fontColor=00ffcc&animation=twinkling" width="100%" />

<br/>

*Built with ❤️ for everyone behind a wall.*

<br/>

[![Stars](https://img.shields.io/github/stars/AMIR11REZA/CloudBreak?style=social)](../../stargazers)
[![Forks](https://img.shields.io/github/forks/AMIR11REZA/CloudBreak?style=social)](../../forks)

</div>
