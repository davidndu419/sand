# Stand With Them

A production-oriented humanitarian donation platform built with the Next.js App Router, TypeScript, Tailwind CSS, Supabase PostgreSQL/Auth/Storage, Vinext, QR-code receipts, and server-generated PDFs.

## What is implemented

- Public homepage, mission, donation choice, soldier-specific and general donation flows.
- Server-side soldier-tag validation with no public tag creation or private identity disclosure.
- Gift-card and cryptocurrency submission using administrator-configured methods only.
- Private payment and fulfilment evidence buckets, MIME/size validation, and short-lived signed review URLs.
- AES-256-GCM encryption for gift-card codes and soldier mobile numbers.
- Pending receipts with stable receipt numbers, hashed 128-bit verification codes, QR links, and PDF download.
- Rate-limited public receipt verification and private-code donation tracking.
- Supabase Auth administration with roles for super administrators, payment reviewers, and fulfilment managers.
- Soldier registration, payment confirmation/decline, allocation, purchase, fulfilment, general-fund, settings, and audit modules.
- Database constraints, row-level security, transactional security-definer workflows, and explicit state transitions.

## Required setup

1. Create a Supabase project.
2. Apply `supabase/migrations/202610170001_initial_secure_platform.sql` with the Supabase CLI or SQL editor.
3. Copy `.env.example` to `.env.local` and supply the project URL, anon key, service-role key, encryption key, and canonical site URL.
4. Generate the 32-byte encryption key with `npm run security:generate-key`. Store it as a server secret. Rotating this key requires a planned data re-encryption migration.
5. Provision the first administrator after the migration:

   ```powershell
   npm run admin:provision -- --email admin@example.org --name "Primary Administrator" --role super_administrator
   ```

   The script invites the address through Supabase Auth when it does not already exist. It never embeds or prints a password.
6. Sign in, open **Settings**, and add the real gift-card types and/or cryptocurrency networks, tokens, wallet addresses, and instructions. No wallet or payment credential is hardcoded.
7. Publish a monitored contact email from **Settings**.

## Environment variables

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project API origin. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase Auth browser/server session key; RLS still applies. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server secret | Server routes and controlled RPC/storage operations. |
| `PAYMENT_ENCRYPTION_KEY_BASE64` | Server secret | Exactly 32 random bytes encoded as base64 for AES-GCM. |
| `NEXT_PUBLIC_SITE_URL` | Public | Canonical origin embedded in receipt QR links. |
| `REQUIRE_ADMIN_MFA` | Server | Set to `true` after administrators have enrolled and verified a TOTP factor. |
| `EVIDENCE_MAX_BYTES` | Server | Optional upload ceiling; database/storage default is 5 MiB. |

## Commands

- `npm run dev` — portable Vinext development server.
- `npm run typecheck` — strict TypeScript validation.
- `npm test` — critical business-rule and security tests.
- `npm run lint` — source linting.
- `npm run build` — production Sites/Worker build.

## Security operations

- Keep the service-role and encryption keys only in the hosting secret store.
- Enable Supabase Auth MFA for administrators before public launch; set and test the MFA enforcement policy deliberately.
- Review admin memberships and audit logs regularly.
- Back up PostgreSQL and private storage according to the organisation's recovery objectives, and restore-test backups.
- Rotate credentials after personnel changes or suspected exposure.
- Configure retention schedules for payment evidence, donor contact data, and fulfilment documentation.
- Add an organisation-approved refund/reallocation policy and real support address before accepting live donations.

## External configuration still required

The application does not simulate third-party success. A Supabase project and administrator-approved payment options are required. Cryptocurrency is manually reviewed; no blockchain verification provider is claimed. Data-bundle fulfilment is manually recorded; no telecom provider integration is claimed.

The homepage's illustrative humanitarian-aid photograph is a public-domain U.S. Air Force image by Tech. Sgt. Alexander Cook, sourced via Wikimedia Commons. It is explicitly labelled as illustrative and is not presented as Stand With Them delivery evidence.
