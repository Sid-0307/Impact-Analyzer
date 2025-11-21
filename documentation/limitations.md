# Limitations

This document summarizes the key limitations of the current change‑impact analysis system.

## 1. Team Email Mapping
Ownership resolution relies on simple or static mappings, causing:
- Over-broad or irrelevant notifications
- Missed targeting due to unclear ownership

**Limitation:** Lacks an automated, intelligent ownership‑resolution mechanism.

## 2. No HTML Sanitization Middleware
Generated reports may include HTML or HTML‑like structures from diffs.
Without sanitization, this can lead to:
- Unsafe or unintended HTML elements
- Unpredictable email-client rendering

**Limitation:** HTML output is not sanitized before sending emails.

## 3. No AST‑Based Code Understanding
The system relies on textual diffs, limiting understanding of deeper structural or semantic changes.

**Limitation:** Absence of AST parsing reduces accuracy for:
- Behavioral changes not visible in text diffs
- Multi-file logical modifications
- Large refactors with minimal actual impact

## 4. Limited Email Grouping Logic
Multiple related changes may trigger separate emails.

**Limitation:** No batching or digesting leads to:
- Notification overload
- Repeated, fragmented communication

## 5. Free‑Tier LLM Rate Limits
Using the free tier of Gemini 2.0 Flash introduces:
- Daily quota restrictions
- Throttling during high load
- Pipeline delays or failures

**Limitation:** Model availability and throughput are constrained by free‑tier limits.

