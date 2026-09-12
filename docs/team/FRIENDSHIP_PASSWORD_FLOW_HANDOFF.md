# Password accounts and friendship refresh

For cross-feature instructions and the next live-test steps, read [LLM_HANDOFF.md](LLM_HANDOFF.md). This feature merged to `main` in [PR #26](https://github.com/vszhu/tasteDNA/pull/26), commit `4516ba0`.

The app now has password sign-in and sign-up alongside email magic links. Successful signup without a session shows an email-confirmation message. Signed-in users can identify their account, sign out, and switch accounts. Auth changes create the public user profile needed by taste persistence and friendships, including password logins that do not visit the email callback route.

The friends page still uses the real friendship HTTP API introduced in #25. It now resets when the authenticated user changes, cancels stale reads, refreshes when the page regains focus and every 15 seconds while visible, and has a manual refresh button. Request, accept, and decline operations refresh the list. Failed reads show a retryable error instead of a misleading empty list. Concurrent mutations are disabled.

## Validation

- `npm test`: 254 tests in 49 files.
- `npm run lint` and `npm run build`.
- Chrome: rendered the updated password sign-in and account creation screens locally.
- Regression tests cover password login, confirmation-required signup, provider errors, sign-out failures, public-profile bootstrap, account-switch races, request/accept/decline, failed-load retry, and acceptance refresh on focus.
- Existing medication, taste persistence, friendship API/repository, and group ranking tests remain included in the full suite.

## Live test status — September 12, 2026 (updated)

Both user-authorized accounts were created through the deployed app at [TasteDNA](https://taste-dna-seven.vercel.app), and password sign-in succeeded. No further confirmation step was required by the current project settings; no auth settings were changed. The Gmail account sent a request to the CMU account. The sender saw outgoing Pending; the recipient saw the incoming request and accepted it, then saw Friends. Switching back to Gmail and reloading also showed the accepted CMU friendship.

This supersedes the previous invalid-credentials/email-rate-limit observation. Passwords and tokens are not stored in the repository. No Google account password was changed.

The deployed site includes the real group-session UI and PR #31's account medication integration. Migration `202609120005_medication_profiles.sql` was applied after the user explicitly authorized project-console access. Real two-account tests verified medication saving/isolation, group invitation acceptance, computation, result invalidation after the friend's list changed, and opt-out coverage. Nonempty lists correctly required review for the tested menus' missing ingredient details; successful assignments used an explicit empty-list control. See [the medication handoff](MEDICATION_CATALOG_EXPANSION_HANDOFF.md) for exact evidence and limits. Synthetic medications and food ratings were removed; accounts and the accepted friendship remain. Decline is covered by automated tests; do not decline this accepted pair or claim a live decline test. Rejected pairs remain terminal by schema design.

Local application validation for the combined change: 334 tests, lint, and production build. Historical PR #26 validation above remains specific to that revision. The latest deployed friendship workflow confirms those routes work in the deployed environment; it does not independently prove every hosted migration is present.
