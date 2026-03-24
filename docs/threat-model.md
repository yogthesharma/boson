# Threat Model

Boson runs on user machines with potential access to local files and command execution paths. This model captures primary risks.

## Assets

- Source code and workspace files
- Local credentials and tokens
- Shell execution environment
- User trust and intent

## Threats

1. Prompt injection from untrusted code files
2. Accidental destructive tool execution
3. Overbroad file access
4. Secret leakage in prompts or logs
5. Malicious or compromised provider responses

## Mitigations

- Explicit approval for high-impact actions
- Scoped file access rules
- Command allow/deny controls
- Secret redaction in logs and prompts
- Clear action traces for operator decisions

## Residual risk

No local operator system is risk-free. Users should review permissions and run Boson with least privilege possible.
