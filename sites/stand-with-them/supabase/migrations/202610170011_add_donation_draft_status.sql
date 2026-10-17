-- A donor's first step creates an unfinished record used to open the payment page.
-- Keep that record distinct from an actual payment awaiting verification.

alter type public.payment_status add value if not exists 'draft' before 'pending';
