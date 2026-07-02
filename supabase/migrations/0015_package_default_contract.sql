-- #5: a package can have a default contract template; buying it auto-assigns
-- the right contract with variables pre-filled.
alter table packages add column if not exists default_contract_template_id uuid references contract_templates(id) on delete set null;
