# EcoCash Payment Setup with Ngrok

## 🚀 Quick Start

Your EcoCash merchant credentials have been configured. Now you need to setup ngrok to allow EcoCash to send payment callbacks to your local development server.

---

## Step 1: Install Ngrok

### Option A: Microsoft Store (Recommended)
```powershell
# Open Microsoft Store and search for "ngrok"
# Click Install
# Or use this direct link:
# https://apps.microsoft.com/detail/9mvs1j51gmk6
```

### Option B: Download Directly
1. Visit: https://ngrok.com/download
2. Download the Windows version
3. Extract the .exe to a folder (e.g., `C:\ngrok`)
4. Add to PATH or run directly from folder

### Option C: Winget (if available)
```powershell
winget install ngrok
```

---

## Step 2: Get Your Ngrok Auth Token

1. Visit: https://dashboard.ngrok.com/signup
2. Create a free account (or login if you have one)
3. Go to: https://dashboard.ngrok.com/get-started/your-authtoken
4. Copy your Authtoken

---

## Step 3: Configure Ngrok (First Time Only)

```powershell
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```

Replace `YOUR_AUTHTOKEN_HERE` with the token from Step 2.

---

## Step 4: Start Ngrok Tunnel

Open a **NEW PowerShell window** and run:

```powershell
ngrok http 4001
```

This will output something like:

```
ngrok                                       (Ctrl+C to quit)

Session Status                online
Account                       yourname@example.com (Plan: Free)
Version                       3.x.x
Region                        us (United States)
Latency                       10ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123def456.ngrok.io -> http://localhost:4001
Forwarding                    http://abc123def456.ngrok.io -> http://localhost:4001

Connections                   ttl    opn    rt1    rt5    p50    p95
                              0      0      0.00   0.00   0.00   0.00

HTTP Requests
POST /api/ecocash/notify
GET /api/health
...
```

**Copy the HTTPS URL** (e.g., `https://abc123def456.ngrok.io`)

---

## Step 5: Update Your Configuration

Open `server-php/.env` and update this line:

```env
ECOCASH_NOTIFY_URL=https://abc123def456.ngrok.io/api/ecocash/notify
```

Replace `abc123def456` with your actual ngrok URL.

---

## Step 6: Restart PHP Server

In your PHP terminal, press `Ctrl+C` to stop the current server, then restart:

```powershell
cd server-php
php -S localhost:4001 -t public public/index.php
```

---

## Step 7: Test the Setup

### Test 1: Check Health Endpoint
```powershell
Invoke-RestMethod http://localhost:4001/api/health
```

Should return: `status: ok`

### Test 2: Make a Test Purchase
1. Go to http://localhost:5500 (frontend)
2. Add an item to cart
3. Click "Pay with EcoCash"
4. Fill in test details:
   - Name: "Test User"
   - Phone: "0783123456"
   - Address: "Test Address"
5. Click "Send payment request"

### Test 3: Watch Ngrok Logs
In the ngrok window, watch for:
```
POST /api/ecocash/notify 200 OK
```

This confirms EcoCash is calling your callback URL successfully.

### Test 4: Check Admin Panel
1. Go to http://localhost:5500/admin.html
2. Login with your admin credentials
3. Go to "Payments" tab
4. Your test payment should appear with status updates

---

## Troubleshooting

### "ngrok: command not found"
- Add ngrok to PATH, or
- Use full path: `C:\ngrok\ngrok.exe http 4001`

### Ngrok shows "Connection refused"
- Make sure PHP server is running on port 4001
- Check: `php -S localhost:4001 -t public public/index.php`

### "Invalid auth token"
- Re-run: `ngrok config add-authtoken YOUR_TOKEN`
- Get new token: https://dashboard.ngrok.com/get-started/your-authtoken

### EcoCash Notify not arriving
- Check .env has correct ECOCASH_NOTIFY_URL
- Watch ngrok logs for incoming POST to `/api/ecocash/notify`
- Restart PHP server after changing .env
- Check payment status in database

### Payment status stuck on "pending"
1. Check ngrok logs - is callback arriving?
2. Check browser console for any errors
3. Check PHP error log in server-php folder
4. Try admin manual update as temporary workaround

---

## Keep Ngrok Running

**Important**: Ngrok tunnel needs to stay running while you're testing. If you close it:
- EcoCash callbacks will fail
- Payments will stay "pending"
- Start a new session with a new URL

---

## For Production

When deploying to production:
1. Replace ngrok URL with your actual domain
2. Update .env: `ECOCASH_NOTIFY_URL=https://yourdomain.com/api/ecocash/notify`
3. Use HTTPS certificate (required by EcoCash)
4. Restart your production server

---

## Current Configuration

Your merchant credentials are already set:
- ✅ ECOCASH_API_USERNAME=ecocash
- ✅ ECOCASH_API_PASSWORD=mobiquity
- ✅ ECOCASH_MERCHANT_CODE=8003
- ✅ ECOCASH_MERCHANT_PIN=2222
- ✅ ECOCASH_MERCHANT_NUMBER=0789111401
- ⏳ ECOCASH_NOTIFY_URL=<needs ngrok URL>

**Next Step**: Complete Step 5 above to finish configuration.
