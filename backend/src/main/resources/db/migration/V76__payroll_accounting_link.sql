-- Link paid payroll records to accounting expenses (employee salaries)

ALTER TABLE hr_payroll_records
    ADD COLUMN accounting_expense_id UUID REFERENCES accounting_expenses(id) ON DELETE SET NULL;

CREATE INDEX idx_hr_payroll_accounting_expense ON hr_payroll_records(accounting_expense_id);
