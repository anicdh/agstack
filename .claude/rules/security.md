# Security Rules

---

## ⛔ CRITICAL WARNINGS

### NEVER Do These

```
❌ NEVER hardcode secrets, API keys, passwords, connection strings
❌ NEVER commit .env, credentials.json, *.pem, *.key files
❌ NEVER log sensitive data (passwords, tokens, PII)
❌ NEVER push to public repo without checking for secrets
❌ NEVER store secrets in code comments
❌ NEVER use production credentials in development
❌ NEVER share database URLs in chat/issues/PRs
```

### Before EVERY Commit

```bash
# Check for secrets in staged files
git diff --staged | grep -iE "(password|secret|api_key|token|credential|private_key)"

# If found → STOP and remove before committing
```

---

## Input Validation

- NEVER trust user input without validation
- Sanitize all inputs before processing
- Validate data types, ranges, formats
- Use parameterized queries (NEVER string concatenation for SQL)

---

## Secrets Management

### Environment Variables

```bash
# ✅ Correct - load from environment
DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}
API_KEY=${API_KEY}

# ❌ Wrong - hardcoded
DATABASE_URL="postgres://user:password@localhost/db"
```

### Required .env Structure

```bash
# .env.example (commit this - NO real values)
DATABASE_URL=postgres://user:password@host:port/db
REDIS_URL=redis://host:port
API_KEY=your-api-key-here
PRIVATE_KEY=path/to/key.pem

# .env (NEVER commit - real values)
DATABASE_URL=postgres://prod_user:real_pass@prod-host:5432/prod_db
```

### Files to ALWAYS Gitignore

```
.env
.env.*
.env.local
.env.production
*.pem
*.key
*.p12
*.pfx
credentials.json
service-account.json
secrets.yaml
secrets.json
.secrets/
config/secrets/
```

---

## External Resources Security

### Database Connections

```rust
// ✅ Correct - from environment
let db_url = std::env::var("DATABASE_URL")
    .expect("DATABASE_URL must be set");

// ✅ Use connection pooling with limits
let pool = PgPoolOptions::new()
    .max_connections(10)
    .acquire_timeout(Duration::from_secs(5))
    .connect(&db_url)
    .await?;

// ❌ Wrong - hardcoded
let db_url = "postgres://user:pass@localhost/db";
```

**Database Security Checklist:**
- [ ] Connection string from env var
- [ ] Use connection pooling (limit connections)
- [ ] Set connection timeout
- [ ] Use SSL/TLS in production (`?sslmode=require`)
- [ ] Least privilege DB user (not superuser)
- [ ] Parameterized queries only (no string concat)

### Redis Connections

```rust
// ✅ Correct
let redis_url = std::env::var("REDIS_URL")
    .expect("REDIS_URL must be set");
let client = redis::Client::open(redis_url)?;

// ✅ With authentication
// REDIS_URL=redis://:password@host:6379/0

// ❌ Wrong
let client = redis::Client::open("redis://localhost:6379")?;
```

**Redis Security Checklist:**
- [ ] Connection string from env var
- [ ] Use password authentication in production
- [ ] Use TLS if over network (`rediss://`)
- [ ] Set key expiration (TTL) for sensitive data
- [ ] Don't store plaintext secrets in Redis

### API Keys & External Services

```rust
// ✅ Correct
let api_key = std::env::var("EXCHANGE_API_KEY")?;
let api_secret = std::env::var("EXCHANGE_API_SECRET")?;

// ✅ Validate before use
if api_key.is_empty() {
    return Err(anyhow!("API key not configured"));
}

// ❌ Wrong - in code
let api_key = "sk-1234567890abcdef";
```

**API Security Checklist:**
- [ ] API keys from env vars
- [ ] Validate keys are non-empty at startup
- [ ] Use separate keys for dev/staging/prod
- [ ] Rotate keys periodically
- [ ] Monitor for unauthorized usage

---

## Logging Security

### What to NEVER Log

```rust
// ❌ NEVER log these
tracing::info!("Password: {}", password);           // Passwords
tracing::info!("Token: {}", api_token);             // Tokens
tracing::info!("Key: {}", private_key);             // Private keys
tracing::info!("DB URL: {}", database_url);         // Connection strings
tracing::info!("User data: {:?}", user_pii);        // PII

// ✅ Safe logging
tracing::info!("User {} authenticated", user_id);
tracing::info!("API call to {} completed", endpoint);
tracing::info!("DB connection pool: {} active", pool.size());
```

### Redaction Pattern

```rust
fn redact_sensitive(url: &str) -> String {
    // postgres://user:password@host → postgres://user:***@host
    let re = regex::Regex::new(r":([^:@]+)@").unwrap();
    re.replace(url, ":***@").to_string()
}
```

---

## Pre-Push Checklist

Before pushing to ANY remote (especially public):

```bash
# 1. Check for secrets in entire repo
gitleaks detect --source .

# 2. Check staged changes
gitleaks protect --staged

# 3. Manual grep check
grep -rn "password\|secret\|api_key\|private_key" --include="*.rs" --include="*.toml" --include="*.json"

# 4. Verify .env not staged
git status | grep -E "\.env"
# If found → git reset .env
```

---

## If Secrets Are Leaked

### Immediate Actions

1. **Rotate immediately** - Generate new credentials
2. **Revoke old credentials** - Disable leaked keys
3. **Audit access logs** - Check for unauthorized usage
4. **Remove from git history** - Use BFG or git-filter-repo

```bash
# Remove file from entire git history
git filter-repo --path .env --invert-paths

# Or use BFG
bfg --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

5. **Force push** - Update remote (coordinate with team)
6. **Notify** - Alert team/security if production credentials

---

## API Security

- Validate all API responses before using
- Handle timeout and error cases
- Rate limit outgoing requests
- Use HTTPS only (never HTTP for sensitive data)
- Validate SSL certificates

---

## Dependency Security

- Run `cargo audit` before committing
- Review new dependencies before adding
- Keep dependencies updated
- Check for typosquatting (verify crate names)
- Pin versions in production

---

## Encryption Standards

### Approved Algorithms

| Purpose | Algorithm | Notes |
|---------|-----------|-------|
| Password hashing | Argon2id, bcrypt | NEVER MD5/SHA1 |
| Symmetric encryption | AES-256-GCM | With authenticated encryption |
| Asymmetric | Ed25519, RSA-4096 | Ed25519 preferred |
| Hashing | SHA-256, SHA-3 | NEVER MD5 |
| TLS | TLS 1.3, TLS 1.2 | Disable older versions |

### Deprecated (NEVER Use)

```
❌ MD5 - broken
❌ SHA1 - broken
❌ DES/3DES - weak
❌ RC4 - broken
❌ TLS 1.0/1.1 - deprecated
```
