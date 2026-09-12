# Meal invitation links

Read [LLM_HANDOFF.md](LLM_HANDOFF.md) and [DEVELOPER_3_TASK_6_HANDOFF.md](DEVELOPER_3_TASK_6_HANDOFF.md) before changing group authorization. This repair starts from main `9f6714f` and preserves the private medication integration.

## Reproduced problem

On September 12, 2026, created a fresh real meal invitation from the authorized CMU account to the authorized Gmail account using their accepted friendship. In the wedge Chrome profile, the signed-out recipient opened the exact URL produced by **Copy link**, followed **Sign in**, and authenticated successfully. The app discarded the meal URL and left the recipient on the account screen. The database invitation itself existed and remained pending.

The laptop app also lacks privileged group-server configuration. A localhost session URL cannot be shared to another device; previously Copy link copied the current browser address without checking this. These are separate failures from the medication table migration repaired earlier.

## Behavior and boundaries

- Session-room and result sign-in links carry a validated `next` path. The new-session gate retains candidate selections. The header sign-in button preserves session paths too.
- Password sign-in and immediate signup return to the requested meal **after** the session provider verifies the user and bootstraps the public profile. Existing authenticated users see their account plus **Continue to your meal**, so they can switch accounts before continuing. Signing out retains the destination.
- Signup confirmation and magic-link requests carry the same destination through `/auth/callback`. Callback errors preserve it for a password retry. No email is sent merely by creating a group invitation.
- `safeNextPath` allows only local paths and rejects external origins, backslashes, and control characters. Never pass arbitrary query values directly to router navigation or redirects.
- A session unavailable to the current login shows its account email and a **Switch account** link that preserves the meal. Possession of a link grants no membership. Existing accepted-friend invitation rules, verified server identity, RLS, and private medication rules are unchanged.
- **Copy link** produces a canonical `/sessions/{id}` URL and also displays a read-only field. If the clipboard is unavailable, the user can select/copy that field. Device-only addresses are rejected rather than reported as successfully shared.
- Optional `NEXT_PUBLIC_APP_URL` configures the published origin for copied links. It must be an HTTPS origin using the **same Supabase project**, not a preview pointed at different data. The laptop's ignored `.env.local` now uses the verified production origin. No secret was added or exposed. Published deployments without an override use their own origin.
- When local group reads return 503 and a different valid published origin is configured, **Open this meal on the live site** opens that same persisted session there. This is a recovery route; it does not pretend the laptop has privileged group-server configuration or bypass an invitation.

## Verification

- Full application suite: **367 tests in 60 files passed**. ESLint and the production build passed.
- Automated coverage includes verified-login timing, account switching, signup/email callback destinations, expired-link retry, unsafe redirects, room/result/new-meal sign-in links, clipboard failure, device-only links, and the local-to-live recovery link. Existing invitation acceptance and account isolation tests remain included.
- Local Chrome: switched from the CMU account to Gmail while keeping the meal destination; password login automatically returned to the exact session URL. The local 503 recovery link then opened the live pending invitation and displayed **Accept** to the intended recipient.
- Hosted deployment and full post-fix acceptance verification are pending at this checkpoint. Update this section after they finish; a unit test or a merge alone does not establish live success.

No medication selections, taste ratings, existing friendships, or unrelated users were changed during this repair. Keep test sessions clearly named; never reset someone else's list to force a recommendation.
