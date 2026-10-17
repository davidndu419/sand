import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "202610170001_initial_secure_platform.sql"),
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

  it("allows payment decisions only from the pending state", () => {
    expect(migration).toContain("if v_payment.status <> 'pending' then raise exception 'invalid_transition'");
    expect(migration).toContain("if v_new not in ('confirmed','declined') then raise exception 'invalid_status'");
  });

  it("does not equate a confirmed payment with delivery", () => {
    expect(migration).toContain("then 'awaiting_allocation'::public.fulfilment_status");
    expect(migration).not.toContain("then 'delivered'::public.fulfilment_status");
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

  it("prevents recorded purchase costs from exceeding allocated funds", () => {
    expect(migration).toContain("v_spent+p_actual_cost_minor > v_allocated");
    expect(migration).toContain("raise exception 'cost_exceeds_allocation'");
  });

  it("limits public receipt verification to an explicit field projection", () => {
    const verifyFunction = migration.slice(
      migration.indexOf("create or replace function public.public_verify_receipt"),
      migration.indexOf("create or replace function public.public_get_receipt"),
    );
    expect(verifyFunction).toContain("jsonb_build_object");
    expect(verifyFunction).not.toContain("donor_email");
    expect(verifyFunction).not.toContain("gift_card_code_ciphertext");
    expect(verifyFunction).not.toContain("object_path");
    expect(verifyFunction).not.toContain("mobile_number_ciphertext");
  });
});
