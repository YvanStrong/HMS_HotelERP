/**
 * Parse Rwanda national ID scanner payloads.
 *
 * Example (spaces optional):
 *   1 2001 7 0135399 0 050109072019INGABIREGloria1726
 *
 * - First 16 digits → national ID (status + birth year + gender + serial + issue + checksum)
 * - Letter block in the middle → SURNAME (caps) + Firstname
 * - Gender digit (6th of ID): 7 = female, 8 = male
 * - Birth year from digits 2–5 of the ID (YYYY)
 */
export type RwandaIdScanResult = {
  nationalId: string;
  lastName: string;
  firstName: string;
  fullName: string;
  gender: "FEMALE" | "MALE" | "";
  birthYear: string;
  /** Best-effort ISO date (YYYY-MM-DD); month/day may be 01-01 if only year is known */
  dateOfBirth: string;
  raw: string;
};

export function parseRwandaIdScan(rawInput: string): RwandaIdScanResult | null {
  const raw = String(rawInput ?? "").trim();
  if (!raw) return null;

  const compact = raw.replace(/\s+/g, "");
  const match = compact.match(/^(\d{16})(\d*)([A-Za-z]+)(\d*)$/);
  if (!match) return null;

  const nationalId = match[1];
  const midDigits = match[2] ?? "";
  const nameBlock = match[3] ?? "";

  const nameParts = nameBlock.match(/^([A-Z]+?)([A-Z][a-z][A-Za-z]*)$/);
  let lastName = "";
  let firstName = "";
  if (nameParts) {
    lastName = nameParts[1];
    firstName = nameParts[2];
  } else {
    // Fallback when first name is also ALL CAPS: split on a later capital (e.g. INGABIREGORIA)
    const midCap = nameBlock.slice(1).search(/[A-Z]/);
    if (midCap >= 0) {
      const at = midCap + 1;
      lastName = nameBlock.slice(0, at);
      firstName = nameBlock.slice(at);
    } else {
      lastName = nameBlock;
    }
  }

  const birthYear = nationalId.slice(1, 5);
  const genderDigit = nationalId.charAt(5);
  const gender = genderDigit === "7" ? "FEMALE" : genderDigit === "8" ? "MALE" : "";

  let dateOfBirth = "";
  if (/^\d{4}$/.test(birthYear)) {
    // Prefer explicit DDMMYYYY sitting in the middle digit run when year matches ID birth year
    const ddmmyyyy = midDigits.match(/(\d{2})(\d{2})(\d{4})/);
    if (ddmmyyyy && ddmmyyyy[3] === birthYear) {
      const dd = ddmmyyyy[1];
      const mm = ddmmyyyy[2];
      const yyyy = ddmmyyyy[3];
      if (isValidYmd(yyyy, mm, dd)) {
        dateOfBirth = `${yyyy}-${mm}-${dd}`;
      }
    }
    if (!dateOfBirth) {
      // YYYYMMDD anywhere in middle digits matching birth year
      const yyyymmdd = midDigits.match(new RegExp(`(${birthYear})(\\d{2})(\\d{2})`));
      if (yyyymmdd && isValidYmd(yyyymmdd[1], yyyymmdd[2], yyyymmdd[3])) {
        dateOfBirth = `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;
      }
    }
    if (!dateOfBirth) {
      dateOfBirth = `${birthYear}-01-01`;
    }
  }

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || lastName;

  return {
    nationalId,
    lastName,
    firstName,
    fullName,
    gender,
    birthYear,
    dateOfBirth,
    raw: compact,
  };
}

function isValidYmd(yyyy: string, mm: string, dd: string): boolean {
  const y = Number(yyyy);
  const m = Number(mm);
  const d = Number(dd);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
