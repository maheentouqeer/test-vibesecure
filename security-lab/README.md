# VibeSecure Security Lab

This directory contains intentionally vulnerable, non-production fixtures for testing the VibeSecure scanner.

Expected repo-level detections:
- Hardcoded AWS, Stripe, GitHub, Google and generic credential patterns
- Wildcard CORS configuration
- Missing Supabase Row-Level Security (RLS)

All credentials in the fixtures are fake test values.
