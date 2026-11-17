# Email and verification

## Neon Auth verification

Neon Auth currently uses its shared email provider with OTP verification:

- verification email sent on sign-up: enabled
- verification method: one-time code
- verification required to sign in: disabled
- verification required to publish: enforced by the app (`emailVerified`), with a
  temporary content-admin allowlist bypass until production SMTP is verified
- application name in auth emails: Tosder Communities

The user requests a code at `/verify-email`, then enters the code to verify.

## Production SMTP

Switch the Neon Auth email provider from `shared` to `standard` with the
production SMTP host, port, username, password, sender email, and sender name.
Then send a test message to an address the launch owner explicitly provides and
confirm delivery, SPF/DKIM alignment, and password-reset/verification flows.

Required env if the app also sends its own transactional mail:

```text
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM="Tosder Communities <hello@your-domain>"
```

Do not commit SMTP credentials. Add them to the hosting environment only.

## Verification checklist

- [ ] Standard SMTP provider configured in Neon Auth
- [ ] Test verification email received and OTP accepted
- [ ] Password reset email received and reset works
- [ ] Sender domain SPF/DKIM/DMARC aligned
- [ ] Bounce/complaint handling owner assigned
- [ ] App transactional email path configured (if enabled)

Until the standard provider is verified, `#63` remains a launch blocker for
normal creator publishing. Shared OTP delivery is enabled for development and
staging.
