<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Finance Advisor

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and configure the Supabase URL and anonymous key.
3. Configure `GEMINI_API_KEY` locally. Keep it server-only; never add a `NEXT_PUBLIC_` prefix.
4. Optionally configure `GEMINI_MODEL`, `AI_USER_HOURLY_LIMIT`, `AI_USER_DAILY_LIMIT`, and `AI_GLOBAL_DAILY_LIMIT`. Defaults are `gemini-3-flash-preview`, 20 requests/hour per user, 100 requests/24 hours per user, and 500 requests/24 hours globally.
5. Apply the migration in `supabase/migrations/20261120000000_create_ai_usage.sql` to the local or test Supabase project before using the AI routes. Do not apply it to production without review.
6. Run the app:
   `npm run dev`

AI requests use authenticated API routes. The browser sends the current Supabase access token; the server validates it with Supabase Auth and reads financial context under that user's RLS policies. Gemini requests are limited through the `ai_usage` table using the server-only service role, and fail closed if the migration or limiter is unavailable.

Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` to validate changes. Automated tests use no live Gemini calls.

Before enabling the feature in a Vercel Preview or Production environment, verify that `GEMINI_API_KEY` is configured there and that any optional `GEMINI_MODEL`, `AI_USER_HOURLY_LIMIT`, `AI_USER_DAILY_LIMIT`, and `AI_GLOBAL_DAILY_LIMIT` values are intentional. This change does not modify deployment settings or apply the migration.

To check a Preview manually, sign in, upload a supported statement or request an investment/budget analysis, then confirm that results are returned and that an over-limit response is friendly. Verify the API routes return 401 without a valid Supabase session. Do not send live Gemini requests from automated tests.
