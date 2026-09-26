# Lab investigation booking

Vercel-ready Vite application for booking lab tests. Patients choose tests, view estimated prices and message previews, request a collection slot, and receive a booking ID. Staff view today's bookings with a private key.

## Setup

1. Run `npm install` and `npm run dev` for the interface. For local API testing, use `vercel dev` after setting environment values.
2. Create a Supabase project. Run `supabase/schema.sql` in its SQL editor. Enable API access. The table has RLS and no client policies.
3. In Vercel, import the repository with Framework Preset **Vite**, build `npm run build`, output `dist`, root directory the repository root.
4. Add the variables from `.env.example` to Vercel Project Settings → Environment Variables. Keep the Supabase service role key and messaging tokens server-side. Set a strong random `STAFF_ACCESS_KEY` for trusted lab staff.
5. Create a Telegram bot, add it to the lab's destination chat and set the bot token and chat ID.
6. Create an approved Meta WhatsApp Business utility template with **one body variable** containing the confirmation message. Set its name, language, number ID and access token. Business-initiated messages use an approved template, not a free-form text message. Confirm recipient opt-in.

Bookings are saved before notification attempts. The response reports a failed or missing messaging channel instead of claiming it was delivered. Bookings are persistent across deployments. The patient sees a requested slot; staff must confirm availability.

## Before clinical use

Prices in `src/main.js` and `api/bookings.js` are examples: update both from the actual lab price list. Add individual staff authentication, audit history, rate limiting, a retry queue, retention and deletion controls before using at scale with patient data. The staff key is a simple internal control. Do not include clinical results in outbound messaging without reviewing consent and privacy requirements.
