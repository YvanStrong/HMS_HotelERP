-- Hibernate maps @Column(length=64) String to VARCHAR; CHAR(64) is bpchar and fails validate.
ALTER TABLE self_order_idempotency
    ALTER COLUMN key_hash TYPE VARCHAR(64);
