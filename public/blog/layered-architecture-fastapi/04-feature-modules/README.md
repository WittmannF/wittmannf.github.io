# 04 - Feature Modules

When the app has multiple domains, global `services/` and `repositories/` folders can become too broad.

This example groups by feature first:

- `modules/news_qa/`
- `modules/users/`

Each feature still keeps the same layer names inside the module.
