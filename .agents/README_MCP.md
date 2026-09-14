# Senior Developer & QA MCP Servers

Bu layihədə Antigravity agenti üçün 3 əsas Model Context Protocol (MCP) serveri konfiqurasiya edilib:

1. **GitHub MCP Server** (`@modelcontextprotocol/server-github`)
   - PR baxışı, kod analizi, issue-ların idarə edilməsi və commit fərqlərinin incələnməsi.
   - Tələb olunur: GitHub Personal Access Token (PAT).
2. **Puppeteer MCP Server** (`@modelcontextprotocol/server-puppeteer`)
   - Brauzerdə UI/UX testləri, avtomatlaşdırılmış QA ssenariləri, ekran görüntüləri (screenshot) və konsol xətalarının analizi.
3. **Filesystem MCP Server** (`@modelcontextprotocol/server-filesystem`)
   - QAZANPOS layihəsinin bütün qovluq və fayllarına birbaşa və təhlükəsiz giriş.

---

## Konfiqurasiya Faylları

- `.agents/config.json`
- `.agents/mcp_config.json`
- `.agents/plugins/dev-qa-toolkit/mcp_config.json`
- `~/.gemini/config/mcp_config.json` (qlobal səviyyədə)
