-- Add EdfaPay as a subscription payment provider alongside manual and moyasar.
-- Only the check constraint on workspace_invoices.provider changes; the column,
-- the checkout/verify flow and the webhook are all provider-agnostic already.
alter table workspace_invoices drop constraint if exists workspace_invoices_provider_check;
alter table workspace_invoices
  add constraint workspace_invoices_provider_check
  check (provider in ('manual', 'moyasar', 'edfapay'));
