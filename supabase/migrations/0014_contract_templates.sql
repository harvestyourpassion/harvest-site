-- #30/#28/#29: link contracts to a template + store the rendered agreement text
-- so both coach and client can view exactly what was sent/signed.
alter table contracts add column if not exists template_id uuid references contract_templates(id) on delete set null;
alter table contracts add column if not exists content text;

-- Let coaches (not just admin) manage their own contract templates.
alter table contract_templates enable row level security;
drop policy if exists "contract_templates_coach_admin" on contract_templates;
create policy "contract_templates_coach_admin" on contract_templates for all
  using (exists (select 1 from coaches c where c.id = contract_templates.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from coaches c where c.id = contract_templates.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Re-point the seeded sample template to Leo's active coach record.
update contract_templates
set coach_id = '389b085c-19f1-4b45-b989-a94cc7863288'
where coach_id = '59f2d5ae-37a5-46fe-abec-b250cbc23424';
