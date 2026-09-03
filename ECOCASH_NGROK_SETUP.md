Open a **NEW PowerShell window** and run:

```powershell
ngrok http 4001
```
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

