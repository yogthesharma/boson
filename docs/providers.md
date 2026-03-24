# Providers

Boson is designed to support multiple model providers through a common adapter interface.

## Provider classes

- OpenAI-compatible API endpoints
- Local model servers (self-hosted)
- Custom enterprise gateways

## Configuration goals

- Provider setup should be explicit and documented
- Secrets should come from environment variables or secure OS keychain integrations
- No hardcoded provider lock-in

## Example configuration shape

```env
BOSON_PROVIDER=openai-compatible
BOSON_BASE_URL=https://api.example.com/v1
BOSON_API_KEY=your_api_key_here
BOSON_MODEL=gpt-4.1-mini
```

## Validation and errors

- Validate required config at startup
- Show clear action-oriented errors for misconfiguration
- Surface rate-limit and auth errors in user-friendly form

## Next steps

- Add provider discovery UI
- Add per-workspace provider profiles
- Add local-only offline mode presets
