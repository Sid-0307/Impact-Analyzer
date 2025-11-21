# Model Selection

## Gemini 2.0 Flash

This project uses **Gemini 2.0 Flash** as the primary model for generating change‑impact analysis from diffs and scan outputs.

## Why This Model Was Chosen

### ✔ Fast & Low Latency
Gemini Flash is optimized for speed, making it ideal for CI/CD pipelines where diff analysis needs to happen quickly and reliably.

### ✔ Cost‑Efficient (Generous Free Tier)
Google provides a high‑volume free tier, enabling frequent scans and large‑scale diff processing without incurring operational costs.

### ✔ Stable Structured Outputs
Flash performs well with strict formatting requirements (e.g., boolean prefix + HTML output), maintaining predictable, clean structure.

### ✔ High Throughput
Handles large numbers of requests efficiently, supporting batch diff analysis and parallel workflows across services.

### ✔ Easy Integration
Simple API surface allows seamless use in Python, FastAPI, serverless jobs, and CI workers.

## Limitations

### ✖ Weaker Deep Reasoning
Less capable than larger models (e.g., Gemini Pro, GPT-4.1, Claude Sonnet) for complex multi-step analysis.

### ✖ Sensitive to Prompt Injection
May reproduce injected HTML/JS or follow adversarial instructions if inputs are not sanitized.

### ✖ Not Ideal for Multimodal Workloads
Best suited for text; heavier vision or audio tasks perform better on larger models.

### ✖ Free Tier May Change
High free limits are not guaranteed and may throttle or vary over time.

## Summary
Gemini 2.0 Flash offers the best balance of **speed**, **cost**, **predictability**, and **scalability** for this project's text‑heavy, structured diff‑analysis workload.

