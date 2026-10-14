/**
 * Issue or renew a Let's Encrypt certificate for kivucloud.rw.
 * HTTP-01 files are written under certs/acme-www for the reverse proxy to serve.
 */
const fs = require("fs");
const path = require("path");
const acme = require("acme-client");

const DOMAINS = (process.env.HMS_TLS_DOMAINS || "kivucloud.rw,www.kivucloud.rw")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const EMAIL = process.env.HMS_ACME_EMAIL || "admin@kivucloud.rw";
const CERT_DIR = process.env.HMS_CERT_DIR
  ? path.resolve(process.env.HMS_CERT_DIR)
  : path.join(__dirname, "..", "..", "certs");
const ACME_DIR = path.join(CERT_DIR, "acme-www", ".well-known", "acme-challenge");
const ACCOUNT_KEY = path.join(CERT_DIR, "account.key");
const PRIVKEY = path.join(CERT_DIR, "privkey.pem");
const FULLCHAIN = path.join(CERT_DIR, "fullchain.pem");
const RENEW_WITHIN_DAYS = 30;
const STAGING = process.env.HMS_ACME_STAGING === "1";

function daysLeft(pem) {
  try {
    const { X509Certificate } = require("crypto");
    const cert = new X509Certificate(pem);
    const ms = Date.parse(cert.validTo) - Date.now();
    return ms / (1000 * 60 * 60 * 24);
  } catch {
    return -1;
  }
}

async function challengeCreate(_authz, challenge, keyAuthorization) {
  if (challenge.type !== "http-01") {
    throw new Error(`Unsupported challenge: ${challenge.type}`);
  }
  fs.mkdirSync(ACME_DIR, { recursive: true });
  fs.writeFileSync(path.join(ACME_DIR, challenge.token), keyAuthorization);
}

async function challengeRemove(_authz, challenge) {
  try {
    fs.unlinkSync(path.join(ACME_DIR, challenge.token));
  } catch {
    /* already gone */
  }
}

async function main() {
  fs.mkdirSync(ACME_DIR, { recursive: true });

  if (fs.existsSync(FULLCHAIN) && fs.existsSync(PRIVKEY)) {
    const left = daysLeft(fs.readFileSync(FULLCHAIN, "utf8"));
    if (left > RENEW_WITHIN_DAYS) {
      console.log(`Certificate still valid for ${left.toFixed(1)} days; skipping issue.`);
      return;
    }
    console.log(`Certificate expires in ${left.toFixed(1)} days; renewing.`);
  }

  let accountKey;
  if (fs.existsSync(ACCOUNT_KEY)) {
    accountKey = fs.readFileSync(ACCOUNT_KEY);
  } else {
    accountKey = await acme.crypto.createPrivateKey();
    fs.writeFileSync(ACCOUNT_KEY, accountKey, { mode: 0o600 });
  }

  const client = new acme.Client({
    directoryUrl: STAGING
      ? acme.directory.letsencrypt.staging
      : acme.directory.letsencrypt.production,
    accountKey,
  });

  await client.createAccount({
    termsOfServiceAgreed: true,
    contact: [`mailto:${EMAIL}`],
  });

  const [key, csr] = await acme.crypto.createCsr({
    commonName: DOMAINS[0],
    altNames: DOMAINS,
  });

  console.log(`Requesting certificate for ${DOMAINS.join(", ")} (${STAGING ? "staging" : "production"})`);
  const cert = await client.auto({
    csr,
    email: EMAIL,
    termsOfServiceAgreed: true,
    challengeCreateFn: challengeCreate,
    challengeRemoveFn: challengeRemove,
    challengePriority: ["http-01"],
    // This host cannot hairpin-NAT its public IP; Let's Encrypt still validates from the internet.
    skipChallengeVerification: true,
  });

  fs.writeFileSync(PRIVKEY, key, { mode: 0o600 });
  fs.writeFileSync(FULLCHAIN, cert);
  console.log(`Wrote ${PRIVKEY}`);
  console.log(`Wrote ${FULLCHAIN}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
