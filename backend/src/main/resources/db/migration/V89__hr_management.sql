-- HR Management Module

INSERT INTO platform_modules (module_key, label, description, nav_section, tier, is_locked, is_paid_addon, sort_order)
VALUES ('HR', 'HR', 'Human resources — employees, payroll, leave, and recruitment', 'administration', 'core', true, false, 9)
ON CONFLICT (module_key) DO NOTHING;



CREATE TABLE hr_employee_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    department      VARCHAR(120),
    job_title       VARCHAR(120),
    employment_type VARCHAR(32) NOT NULL DEFAULT 'FULL_TIME',
    employment_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    hire_date       DATE,
    base_salary     NUMERIC(14, 2),
    salary_currency VARCHAR(8) DEFAULT 'USD',
    phone           VARCHAR(32),
    address         TEXT,
    national_id     VARCHAR(64),
    emergency_contact_name  VARCHAR(120),
    emergency_contact_phone VARCHAR(32),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (hotel_id, user_id)
);

CREATE INDEX idx_hr_emp_prof_hotel_status ON hr_employee_profiles(hotel_id, employment_status);
CREATE INDEX idx_hr_emp_prof_user ON hr_employee_profiles(user_id);

-- -------------------------------------------------------

CREATE TABLE hr_payroll_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES app_users(id),
    period_year     INT NOT NULL,
    period_month    INT NOT NULL,
    base_pay        NUMERIC(14, 2) NOT NULL DEFAULT 0,
    bonus           NUMERIC(14, 2) NOT NULL DEFAULT 0,
    overtime_pay    NUMERIC(14, 2) NOT NULL DEFAULT 0,
    benefits        NUMERIC(14, 2) NOT NULL DEFAULT 0,
    deductions      NUMERIC(14, 2) NOT NULL DEFAULT 0,
    net_pay         NUMERIC(14, 2) NOT NULL DEFAULT 0,
    currency        VARCHAR(8) DEFAULT 'USD',
    status          VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    approved_by     VARCHAR(128),
    approved_at     TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (hotel_id, user_id, period_year, period_month)
);

CREATE INDEX idx_hr_payroll_hotel_period ON hr_payroll_records(hotel_id, period_year, period_month);
CREATE INDEX idx_hr_payroll_user ON hr_payroll_records(user_id);
CREATE INDEX idx_hr_payroll_status ON hr_payroll_records(hotel_id, status);

-- -------------------------------------------------------

CREATE TABLE hr_leave_types (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id             UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    name                 VARCHAR(80) NOT NULL,
    annual_days_allowed  INT NOT NULL DEFAULT 0,
    is_paid              BOOLEAN NOT NULL DEFAULT TRUE,
    description          TEXT,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (hotel_id, name)
);

CREATE INDEX idx_hr_leave_types_hotel ON hr_leave_types(hotel_id, is_active);

-- -------------------------------------------------------

CREATE TABLE hr_leave_balances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    leave_type_id   UUID NOT NULL REFERENCES hr_leave_types(id) ON DELETE CASCADE,
    year            INT NOT NULL,
    days_allocated  NUMERIC(5, 1) NOT NULL DEFAULT 0,
    days_used       NUMERIC(5, 1) NOT NULL DEFAULT 0,
    days_pending    NUMERIC(5, 1) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (hotel_id, user_id, leave_type_id, year)
);

CREATE INDEX idx_hr_leave_bal_hotel_year ON hr_leave_balances(hotel_id, year);
CREATE INDEX idx_hr_leave_bal_user ON hr_leave_balances(user_id);

-- -------------------------------------------------------

CREATE TABLE hr_leave_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    leave_type_id   UUID NOT NULL REFERENCES hr_leave_types(id),
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    total_days      NUMERIC(5, 1) NOT NULL DEFAULT 1,
    reason          TEXT,
    status          VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    reviewed_by     VARCHAR(128),
    reviewed_at     TIMESTAMPTZ,
    review_notes    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hr_leave_req_hotel_status ON hr_leave_requests(hotel_id, status);
CREATE INDEX idx_hr_leave_req_user ON hr_leave_requests(user_id);
CREATE INDEX idx_hr_leave_req_type ON hr_leave_requests(leave_type_id);

-- -------------------------------------------------------

CREATE TABLE hr_job_positions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    title           VARCHAR(120) NOT NULL,
    department      VARCHAR(80),
    description     TEXT,
    requirements    TEXT,
    employment_type VARCHAR(32) DEFAULT 'FULL_TIME',
    location        VARCHAR(120),
    status          VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    posted_date     DATE,
    deadline_date   DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hr_job_pos_hotel_status ON hr_job_positions(hotel_id, status);

-- -------------------------------------------------------

CREATE TABLE hr_candidates (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id         UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    job_position_id  UUID REFERENCES hr_job_positions(id) ON DELETE SET NULL,
    full_name        VARCHAR(160) NOT NULL,
    email            VARCHAR(255),
    phone            VARCHAR(32),
    resume_url       TEXT,
    cover_letter     TEXT,
    stage            VARCHAR(16) NOT NULL DEFAULT 'APPLIED',
    stage_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hr_candidates_hotel_stage ON hr_candidates(hotel_id, stage);
CREATE INDEX idx_hr_candidates_position ON hr_candidates(job_position_id);
