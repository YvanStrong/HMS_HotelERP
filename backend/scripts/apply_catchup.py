"""Apply railway_catchup_v102_v110.sql using SPRING_DATASOURCE_* env vars."""
import os
import re
import sys

import psycopg2


def jdbc_to_dsn(url: str, user: str, password: str) -> str:
    # jdbc:postgresql://host:port/db?params -> host/port/db
    m = re.match(
        r"jdbc:postgresql://([^:/?]+)(?::(\d+))?/([^?]+)",
        url.strip(),
    )
    if not m:
        raise SystemExit(f"Unrecognized JDBC URL: {url[:40]}...")
    host, port, db = m.group(1), m.group(2) or "5432", m.group(3)
    return f"host={host} port={port} dbname={db} user={user} password={password} sslmode=require"


def main() -> None:
    # Prefer public proxy when running locally via `railway run`.
    url = (
        os.environ.get("DATABASE_PUBLIC_URL")
        or os.environ.get("DATABASE_URL")
        or os.environ.get("SPRING_DATASOURCE_URL")
    )
    user = os.environ.get("SPRING_DATASOURCE_USERNAME") or os.environ.get("PGUSER", "postgres")
    password = os.environ.get("SPRING_DATASOURCE_PASSWORD") or os.environ.get("PGPASSWORD", "")
    if not url:
        raise SystemExit("No DATABASE_PUBLIC_URL / DATABASE_URL in environment")

    if url.startswith("jdbc:"):
        dsn = jdbc_to_dsn(url, user, password)
    else:
        dsn = url

    sql_path = os.path.join(os.path.dirname(__file__), "railway_catchup_v102_v110.sql")
    with open(sql_path, encoding="utf-8") as f:
        sql = f.read()

    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            cur.execute(
                """
                SELECT version, description, success
                FROM flyway_schema_history
                WHERE version::int BETWEEN 100 AND 110
                ORDER BY installed_rank
                """
            )
            rows = cur.fetchall()
            print("flyway 100-110:")
            for r in rows:
                print(f"  {r[0]} | {r[1]} | success={r[2]}")

            cur.execute(
                """
                SELECT
                  to_regclass('public.tenant_billing_requests') IS NOT NULL AS billing,
                  to_regclass('public.hr_duty_shifts') IS NOT NULL AS duty,
                  to_regclass('public.ebm_code_list') IS NOT NULL AS ebm_codes,
                  EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'bug_reports' AND column_name = 'screenshot_data'
                  ) AS bug_screenshot
                """
            )
            print("objects:", cur.fetchone())
        print("CATCHUP_OK")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
    sys.exit(0)
