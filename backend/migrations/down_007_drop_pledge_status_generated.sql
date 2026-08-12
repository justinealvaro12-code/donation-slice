-- Rollback for 007_drop_pledge_status_generated.sql
-- Restores the generated status column on donation_pledges.

BEGIN;

ALTER TABLE donation_pledges
  ADD COLUMN status VARCHAR(20) GENERATED ALWAYS AS (
    CASE
      WHEN amount_fulfilled >= amount_pledged THEN 'fulfilled'
      WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE THEN 'overdue'
      ELSE 'pending'
    END
  ) STORED;

COMMIT;
