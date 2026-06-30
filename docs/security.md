# Security Notes

## Admin bootstrap

Public signup always creates a `member` with no module grants. The initial owner is
created by:

```bash
ADMIN_EMAIL=founder@example.com npm run seed:admin
```

Open the printed invite link, set the password, then manage users/modules in Admin.

## AI daily budget

Real OpenRouter calls are capped per signed-in user by `AI_DAILY_LIMIT_PER_USER`
(default `20`). Mock mode does not consume budget when `OPENROUTER_API_KEY` is blank.
The database records usage through a locked RPC, so parallel requests cannot all
pass the same budget check.

## Watched dependency advisory

`npm audit` currently reports a moderate PostCSS advisory through Next's nested
dependency (`next@15.5.19` and stable `next@16.2.9` both bundle
`postcss@8.4.31`). The patched nested version is visible on the Next canary line
(`postcss@8.5.10`), but this template stays on stable Next. Dependabot watches for
the stable release that carries the fix; `npm run audit:security` fails only on
high/critical advisories.
