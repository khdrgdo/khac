const https = require('https');

const TOKEN = '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';

const body = JSON.stringify({
  title: "fix: security hardening + code quality improvements (batch 2)",
  body: `## Summary

### Security Fixes
- **XSS Prevention**: Added DOMPurify sanitization + rehype-raw in MarkdownViewer
- **SubAdmin Permissions**: Added \`__PERMS__\` prefix to bio field JSON to prevent accidental misparse

### Code Quality
- **ErrorBoundary**: Added React ErrorBoundary component wrapping root Outlet
- **Console Cleanup**: Removed 43 console.log/warn/error statements from 21 source files
- **TypeScript**: Replaced \`any\` types in MentionList with proper interfaces
- **Unused Dependencies**: Removed react-quill, embla-carousel-react, input-otp

### Architecture (File Splitting)
- **admin.tsx**: Split from 137KB → 11KB orchestrator + 10 tab components in \`components/admin/\`
- **courses.\\$id.tsx**: Split from 67KB → 10KB orchestrator + 8 tab/dialog components in \`components/courses/\`

### Cleanup
- Removed PWA registration console logs from __root.tsx
- .env already in .gitignore (verified)`,
  base: "main",
  head: "fix/security-and-code-quality"
});

const req = https.request({
  hostname: 'api.github.com',
  path: '/repos/khdrgdo/khac/pulls',
  method: 'POST',
  headers: {
    'Authorization': `token ${TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'node',
    'Accept': 'application/vnd.github+json',
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.html_url) {
        console.log('PR created:', json.html_url);
      } else {
        console.log('Response:', data);
      }
    } catch(e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(body);
req.end();
