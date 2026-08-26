-- 009_sync_receipt_sequence.sql
-- organization_receipt_settings.next_sequence was never advanced past 1
-- because the original seed data inserted receipts directly, bypassing
-- getAndIncrementSequence(). Sync it to (highest existing receipt number
-- for that org) + 1 so newly generated receipts stop colliding with
-- already-seeded ones.
BEGIN;

INSERT INTO organization_receipt_settings (organization_id, prefix, next_sequence)
SELECT DISTINCT organization_id, 'RCPT-', 1
FROM donation_receipts
ON CONFLICT (organization_id) DO NOTHING;

UPDATE organization_receipt_settings s
SET next_sequence = sub.max_seq + 1,
    updated_at = now()
FROM (
  SELECT organization_id,
         MAX(CAST(SUBSTRING(receipt_number FROM LENGTH('RCPT-') + 1) AS INTEGER)) AS max_seq
  FROM donation_receipts
  WHERE receipt_number LIKE 'RCPT-%'
  GROUP BY organization_id
) sub
WHERE s.organization_id = sub.organization_id
  AND sub.max_seq + 1 > s.next_sequence;

COMMIT;