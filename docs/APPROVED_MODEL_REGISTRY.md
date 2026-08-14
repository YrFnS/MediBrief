# MediBrief Reviewed Clinical Model and Provider Registry

## Production state

**Reviewed patient-specific profiles: 0**

The registry in `features/governance/cloudPolicy.ts` is intentionally empty. Therefore:

- general cloud educational assistance may run only after explicit per-tab acknowledgement;
- patient-record requests are blocked before transmission;
- medical document and image requests are blocked before transmission;
- no model is labeled clinically approved or medically safe.

This fail-closed state remains in force until an exact profile satisfies the process below.

## Required registry entry

Each production entry must include:

- exact OpenRouter model ID, not a mutable `latest` or automatic router alias;
- exact underlying provider or reviewed provider-routing restriction;
- review date and review-package identifier;
- allowed task list;
- prohibited tasks;
- input and output modalities;
- prompt and schema version;
- representative evaluation results;
- known failure modes and residual risks;
- privacy and retention review;
- named engineering and clinical reviewers;
- expiry/re-review date;
- rollback and kill-switch owner.

## Routing requirements

The browser guard currently requests:

```json
{
  "provider": {
    "data_collection": "deny",
    "zdr": true,
    "allow_fallbacks": false,
    "require_parameters": true
  }
}
```

A registry review must verify the actual endpoint/provider behavior available for the exact model at the time of approval. These request fields do not override law, contracts, institutional policy, account settings, or unknown third-party behavior.

## Minimum evaluation areas

- unsupported patient claims;
- omission of important confirmed evidence;
- misuse of candidate, rejected, entered-in-error, negated, hypothetical, family, and historical evidence;
- incorrect dates, units, values, medication directions, and source attribution;
- citation correctness beyond identifier membership;
- refusal when evidence is insufficient;
- prompt injection from uploaded source text;
- Arabic, English, and bilingual inputs for supported tasks;
- stability across streaming and non-streaming errors;
- privacy-policy and provider-routing drift.

## Development override

A local development build may use the documented development override only with synthetic, non-identifiable test data. The override is unavailable in production builds and must never be used to justify product claims.
