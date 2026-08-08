# check-prices

Supabase Edge Function backing the Prices tab. Fetches each tracked product page,
parses the current price out of JSON-LD or meta tags, and flags price drops.

Called by pg_cron once daily, and by the app's "Check now" button.
