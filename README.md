# Beach WiFi Portal

A captive portal for paid WiFi access with Stripe Payments and UniFi/MikroTik integration.

## Architecture

The portal uses **Stripe Payment Element** (embedded card form) instead of Stripe Checkout (redirect). This is critical for captive portal environments because:

- Captive portal browsers can't reliably redirect to `checkout.stripe.com`
- SSL certificate validation fails in restricted pre-auth network state
- Stripe Elements sends card data directly from the guest's browser to Stripe via iframe — no redirect needed

## Flow

```
Guest connects to WiFi (UniFi SSID with Captive Portal)
       │
       ▼
UniFi redirects to http://<portal-ip>/?id=<client-mac>&ap=<ap-mac>&ssid=<ssid>
       │
       ▼
Portal redirects to https://beachwifi.dok.tavonni.com/ (HTTPS domain)
       │
       ▼
Guest picks a plan → /checkout?planId=X&mac=AA:BB:CC:DD:EE:FF
       │
       ▼
Portal creates PaymentIntent → embeds Stripe Payment Element on page
       │
       ▼
Guest enters card → goes directly to Stripe (iframe, no redirect)
       │
       ▼
Payment confirmed → /success?payment_intent_id=pi_xxx
       │
       ▼
Portal creates hotspot user on MikroTik + authorizes device on UniFi
       │
       ▼
Guest gets internet access
```

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
# Database
DATABASE_URL=postgresql://...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...     # NEW — required for embedded Payment Element
STRIPE_WEBHOOK_SECRET=whsec_...

# Portal
PORTAL_URL=https://beachwifi.dok.tavonni.com
HOTSPOT_LOGIN_URL=http://10.5.50.1/login

# MikroTik
MIKROTIK_API_URL=https://10.5.50.1
MIKROTIK_API_USER=admin
MIKROTIK_API_PASS=password

# UniFi (NEW — for external portal guest authorization)
UNIFI_API_URL=https://192.168.1.1       # Your UniFi Cloud Gateway URL
UNIFI_API_KEY=...                        # API key from Network > Control Plane > Integrations
UNIFI_SITE_ID=...                        # Site ID (auto-detected if only one site)
```

### 2. Database

```bash
pnpm db:push    # Create/update tables
pnpm seed       # Add default plans
```

### 3. UniFi Configuration

#### Enable External Portal

1. Go to **Insights → Hotspot → Landing Page**
2. Under **Authentication**, select **External Portal Server**
3. Enter your portal's **IP address** (UniFi only accepts IPs, not domains)
4. Under **Settings**, enable **Show Landing Page** and **Domain**
5. In the **Domain** field, enter: `beachwifi.dok.tavonni.com`

#### Configure Pre-Authorization Access (Walled Garden)

Add these domains/IPs to **Pre-Authorization Allowances** so guests can reach your portal and Stripe before they're authenticated:

```
beachwifi.dok.tavonni.com
js.stripe.com
*.stripe.com
fonts.googleapis.com
```

Also add your portal's **public IP address**.

#### Generate API Key

1. Go to **Network → Control Plane → Integrations**
2. Generate an API key
3. Copy the key and site ID to your `.env`

### 4. Stripe Configuration

1. In Stripe Dashboard, go to **Developers → Webhooks**
2. Add endpoint: `https://beachwifi.dok.tavonni.com/api/webhooks/stripe`
3. Select events:
   - `payment_intent.succeeded` (new embedded flow)
   - `checkout.session.completed` (legacy flow, optional)
4. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

### 5. Deploy

```bash
docker compose up -d
```

### 6. Admin

Go to `/admin` to create plans and manage the system.

## New Environment Variables

| Variable | Required | Description |
|---|---|---|
| `STRIPE_PUBLISHABLE_KEY` | **Yes** | Stripe publishable key (`pk_live_...` or `pk_test_...`). Required for the embedded Payment Element. |
| `UNIFI_API_URL` | No | UniFi Network Application URL. Required for UniFi guest authorization. |
| `UNIFI_API_KEY` | No | API key from UniFi Network Application integrations. |
| `UNIFI_SITE_ID` | No | UniFi site ID. Auto-detected if only one site exists. |

## Migration from Checkout Session to Payment Element

The portal now uses **Payment Intents + Payment Element** instead of **Checkout Sessions**. Key differences:

- **Before**: User clicks "Purchase" → redirected to `checkout.stripe.com` → redirected back
- **After**: User clicks "Purchase" → stays on your domain → enters card in embedded Stripe iframe → payment confirmed on-page

The legacy `/api/checkout` route still works for backward compatibility.
