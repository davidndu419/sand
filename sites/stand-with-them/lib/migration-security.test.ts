import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "202610170001_initial_secure_platform.sql"),
  "utf8",
).toLowerCase();

const soldierTagRepairMigration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "202610170002_fix_soldier_tag_generation.sql"),
  "utf8",
).toLowerCase();

const refinementMigration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "202610170003_consolidate_tracking_and_optional_crypto_hash.sql"),
  "utf8",
).toLowerCase();

const donationReferenceRepairMigration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "202610170004_fix_donation_reference_generation.sql"),
  "utf8",
).toLowerCase();

const singleVerificationCodeMigration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "202610170005_single_receipt_verification_code.sql"),
  "utf8",
).toLowerCase();

const editableContactMigration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "202610170006_editable_public_contact.sql"),
  "utf8",
).toLowerCase();

const categoryMinimumMigration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "202610170007_category_minimum_amounts.sql"),
  "utf8",
).toLowerCase();

const requiredTables = [
  "admin_profiles", "support_categories", "soldiers", "donations",
  "payment_submissions", "payment_evidence", "receipts", "fund_allocations",
  "purchases", "volunteer_assignments", "fulfilment_records",
  "general_fund_transactions", "audit_logs", "app_settings",
];

describe("database security contract", () => {
  it("defines every required operational entity", () => {
    for (const table of requiredTables) {
      expect(migration).toContain(`create table if not exists public.${table}`);
    }
  });

  it("enables row-level security on every required entity", () => {
    for (const table of requiredTables) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("revokes direct anonymous and authenticated table access", () => {
    expect(migration).toContain("revoke all on all tables in schema public from anon, authenticated");
    expect(migration).toContain("revoke all on all sequences in schema public from anon, authenticated");
  });

  it("keeps both evidence buckets private and file constrained", () => {
    expect(migration).toMatch(/'payment-evidence','payment-evidence',false,5242880/);
    expect(migration).toMatch(/'fulfilment-evidence','fulfilment-evidence',false,5242880/);
    expect(migration).toContain("intentionally no anon/authenticated storage policies");
  });

  it("hashes access and receipt verification codes", () => {
    expect(migration).toContain("access_code_hash=digest(p_access_code,'sha256')");
    expect(migration).toContain("digest(v_verification,'sha256')");
    expect(migration).toContain("verification_code_hash=digest(upper(trim(p_verification_code)),'sha256')");
  });

  it("stores one verification code as a hash plus protected ciphertext", () => {
    for (const sql of [migration, refinementMigration, singleVerificationCodeMigration]) {
      expect(sql).toContain("verification_code_ciphertext");
      expect(sql).toContain("digest(v_verification,'sha256')");
      expect(sql).toContain("'verificationcode',v_verification");
      expect(sql).not.toContain("'receiptnumber',v_receipt");
    }
  });

  it("links legacy codes only through an active administrator and records an audit event", () => {
    for (const sql of [migration, singleVerificationCodeMigration]) {
      const start = sql.indexOf("create or replace function public.link_receipt_verification_code");
      const linkFunction = sql.slice(start, sql.indexOf("end; $$;", start));
      expect(linkFunction).toContain("where id=p_admin_id and active");
      expect(linkFunction).toContain("verification_code_hash=digest(v_code,'sha256')");
      expect(linkFunction).toContain("'receipt.verification_code_linked'");
      expect(linkFunction).not.toContain("verification_code_hash=p_verification_code");
    }
  });

  it("allows payment decisions only from the pending state", () => {
    expect(migration).toContain("if v_payment.status <> 'pending' then raise exception 'invalid_transition'");
    expect(migration).toContain("if v_new not in ('confirmed','declined') then raise exception 'invalid_status'");
  });

  it("does not equate a confirmed payment with delivery", () => {
    expect(migration).toContain("then 'awaiting_allocation'::public.fulfilment_status");
    expect(migration).not.toContain("then 'delivered'::public.fulfilment_status");
  });

  it("allows cryptocurrency submissions to remain pending without a transaction hash", () => {
    for (const sql of [migration, refinementMigration]) {
      expect(sql).toContain("method = 'cryptocurrency' and gift_card_code_ciphertext is null");
      expect(sql).not.toContain("transaction_hash_required");
    }
  });

  it("preserves the required hyphen in generated soldier tags", () => {
    for (const sql of [migration, soldierTagRepairMigration]) {
      expect(sql).toContain("v_tag := 'sld-' || regexp_replace(");
      expect(sql).not.toContain("v_tag := regexp_replace(v_tag");
    }
  });

  it("whitelists donation-reference suffixes after uppercasing", () => {
    for (const sql of [migration, donationReferenceRepairMigration]) {
      const start = sql.indexOf("create or replace function public.create_donation_draft");
      const donationFunction = sql.slice(start, sql.indexOf("end; $$;", start));
      expect(donationFunction).toContain("upper(substr(encode(gen_random_bytes(8),'base64'),1,8))");
      expect(donationFunction).toContain("'[^a-hj-np-z2-9]', 'k', 'g'");
      expect(donationFunction).not.toContain("v_reference := regexp_replace(v_reference");
    }
  });

  it("records confirmed general support in its separate ledger", () => {
    expect(migration).toContain("if v_new='confirmed' and v_donation.kind='general' then");
    expect(migration).toContain("insert into public.general_fund_transactions");
    expect(migration).toContain("if v_donation.kind <> 'soldier' then raise exception 'general_fund_required'");
  });

  it("rejects missing or inactive administrator roles inside privileged functions", () => {
    expect(migration).toContain("if v_role is null or v_role not in ('super_administrator','payment_reviewer')");
    expect(migration).toContain("if v_role is null or v_role not in ('super_administrator','fulfilment_manager')");
    expect(migration).toContain("if v_role is null or v_role <> 'super_administrator'");
    expect(migration).not.toMatch(/if v_role not in/);
  });

  it("updates public email and phone atomically through an audited administrator function", () => {
    for (const sql of [migration, editableContactMigration]) {
      const start = sql.indexOf("create or replace function public.update_public_contact");
      const contactFunction = sql.slice(start, sql.indexOf("end; $$;", start));
      expect(contactFunction).toContain("where id=p_admin_id and active");
      expect(contactFunction).toContain("v_role is null or v_role <> 'super_administrator'");
      expect(contactFunction).toContain("'contact.email'");
      expect(contactFunction).toContain("'contact.phone'");
      expect(contactFunction).toContain("'contact.updated'");
      expect(contactFunction).toContain("contact_required");
    }
  });

  it("prevents recorded purchase costs from exceeding allocated funds", () => {
    expect(migration).toContain("v_spent+p_actual_cost_minor > v_allocated");
    expect(migration).toContain("raise exception 'cost_exceeds_allocation'");
  });

  it("enforces category minimums and seeds only the supported gift cards", () => {
    expect(categoryMinimumMigration).toContain("minimum_amount_minor");
    expect(categoryMinimumMigration).toContain("amount_below_category_minimum");
    expect(categoryMinimumMigration).toContain("'apple'");
    expect(categoryMinimumMigration).toContain("'razer'");
    expect(categoryMinimumMigration).toContain("'xbox'");
  });

  it("limits public receipt verification to an explicit field projection", () => {
    for (const sql of [migration, refinementMigration, singleVerificationCodeMigration]) {
      const verifyFunction = sql.slice(
        sql.indexOf("create or replace function public.public_verify_receipt"),
        sql.indexOf("create or replace function public.public_get_receipt"),
      );
      expect(verifyFunction).toContain("jsonb_build_object");
      expect(verifyFunction).toContain("'fulfilment_status',d.fulfilment_status");
      expect(verifyFunction).toContain("e.public_description");
      expect(verifyFunction).not.toContain("'donation_id'");
      expect(verifyFunction).not.toContain("'receipt_number'");
      expect(verifyFunction).not.toContain("'donation_reference'");
      expect(verifyFunction).not.toContain("donor_email");
      expect(verifyFunction).not.toContain("gift_card_code_ciphertext");
      expect(verifyFunction).not.toContain("object_path");
      expect(verifyFunction).not.toContain("mobile_number_ciphertext");
      expect(verifyFunction).not.toMatch(/ps\.status\s*=/);
    }
  });

  it("retires the separate donation-tracking database function", () => {
    expect(migration).not.toContain("create or replace function public.public_track_donation");
    expect(refinementMigration).toContain("drop function if exists public.public_track_donation(text,text)");
  });
});
