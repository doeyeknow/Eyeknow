# eyeKnow — domain options

Checked Sun Oct 18, 2026, ~11:55 MDT via Porkbun bulk domain search
(prices USD, include ICANN fees; no purchase made, no account created).

Context: the app is branded **eyeKnow** everywhere (header, reports,
checkout) but still lives at irisread.vercel.app. Adam was told on
Oct 18 that a matching domain would need separate setup; no decision
was recorded. Note the QR codes on printed reports and the shared-
reading links currently point at irisread.vercel.app — a domain move
means updating those, the Vercel project domains, and the Google
OAuth redirect URI (which is pinned to irisread.vercel.app in
LAUNCH-STEPS.md).

## Results

| Domain | Status | First year | Renewal |
|---|---|---|---|
| eyeknow.com | TAKEN (registrar shows "Inquire" only) | — | — |
| eyeknow.app | Available | $8.75 (sale) | $14.93/yr |
| eyeknow.co | Available | $15.76 (sale) | $31.20/yr |
| eyeknow.health | Available | $10.81 (sale) | $62.31/yr — steep renewal |
| geteyeknow.com | Available | $11.08 | $11.08/yr |
| tryeyeknow.com | Available | $11.08 | $11.08/yr |
| eyeknowreadings.com | Available | $11.08 | $11.08/yr |

Also known taken: eyeknow.ai is a live site for an unrelated company
(EyeKnow AI — CCTV violence-detection for care facilities), so the
plain "eyeknow" name already has a namesake in AI/health-adjacent
space. Worth knowing for search results and confusion, not a blocker.

## Recommendation (agent's, Adam decides)

- **eyeknow.app** — cleanest match for a web app, cheapest sensible
  renewal, name reads exactly as the brand.
- **geteyeknow.com** — if a .com matters more than the exact name;
  flat $11.08/yr renewal.
- Skip eyeknow.health despite the cheap first year — the $62.31
  renewal is a trap compared to the others.

Nothing bought. If Adam picks one, the follow-on work is agent-side:
add the domain in Vercel, point DNS, update base URLs / QR link base,
and update the Google OAuth redirect URI in LAUNCH-STEPS.md before
he creates the OAuth client.
