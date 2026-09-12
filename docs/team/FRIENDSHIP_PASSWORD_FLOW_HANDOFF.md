# Password accounts and friendship refresh

The app now has password sign-in and sign-up alongside email magic links. Successful signup without a session shows an email-confirmation message. Signed-in users can identify their account, sign out, and switch accounts. Auth changes create the public user profile needed by taste persistence and friendships, including password logins that do not visit the email callback route.

The friends page still uses the real friendship HTTP API introduced in #25. It now resets when the authenticated user changes, cancels stale reads, refreshes when the page regains focus and every 15 seconds while visible, and has a manual refresh button. Request, accept, and decline operations refresh the list. Failed reads show a retryable error instead of a misleading empty list. Concurrent mutations are disabled.

## Validation

- `npm test`: 254 tests in 49 files.
- `npm run lint` and `npm run build`.
- Chrome: rendered the updated password sign-in and account creation screens locally.
- Regression tests cover password login, confirmation-required signup, provider errors, sign-out failures, public-profile bootstrap, account-switch races, request/accept/decline, failed-load retry, and acceptance refresh on focus.
- Existing medication, taste persistence, friendship API/repository, and group ranking tests remain included in the full suite.

## Live test status — September 12, 2026

The deployed app at https://taste-dna-seven.vercel.app was tested before publishing these changes. It displayed Supabase's sign-in email limit error. Password sign-in attempts for both user-authorized test accounts returned `invalid_credentials`. One password signup attempt returned HTTP 429 `over_email_send_rate_limit`; further signup attempts stopped. Neither account is verified as created, and a real two-account friendship request/acceptance has not been completed.

The local checkout has no Supabase admin credentials or linked project. Chrome's Supabase dashboard requires sign-in. Project access is needed to resolve email delivery and confirm account creation. Do not bypass email confirmation or commit credentials. Supabase's default mailer is restricted; see https://supabase.com/docs/guides/auth/auth-smtp for custom SMTP setup.

The earlier `DEVELOPER_3_AUTH_FRIENDSHIP_FIX_HANDOFF.md` also reported `202609120003_friendship_api.sql` pending on the hosted project. That is a reported configuration dependency, not a migration status verified in this test. The project owner should review the pending migrations with `supabase db push --dry-run`, apply the friendship migration if needed, and verify that the server-only Supabase key is configured in Vercel before the authenticated live test.

Once access is available, create and confirm both accounts, send a request from the first, accept from the second, and confirm both show the accepted friendship after focus/refresh. Test decline with a separate relationship, since rejected pairs currently remain terminal by schema design. Group-session invitation UI is still a separate mock implementation, as documented in #25's handoff.
