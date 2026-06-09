# Privacy Policy — Chrome Agent (Bedrock)

_Last updated: 2026-06-04_

Chrome Agent (Bedrock) ("the Extension") is a Chrome side-panel assistant that lets you
chat about the current web page and, in Agent (Computer Use) mode, perform actions on the
page on your behalf. This document explains exactly what data the Extension handles.

## Summary

- The Extension has **no backend server of its own.** It talks directly from your browser to
  **your own AWS Bedrock account** and (for web search) to public search engines.
- Your AWS Bedrock API key is stored **only in your browser** (`chrome.storage`) and is never
  sent anywhere except to the AWS Bedrock endpoint for authentication.
- The developer does **not** collect, receive, store, or sell any of your data.

## What data is processed

| Data | When | Where it goes | Stored? |
|------|------|---------------|---------|
| **Current page content** (text, interactive elements) | When you use Chat or Agent on a tab | Sent to **AWS Bedrock (Claude)** to generate a response/action | Not stored by the Extension; transient in the model request |
| **Your chat messages / task instructions** | When you type in the side panel | Sent to **AWS Bedrock (Claude)** | Chat history stored **locally** in your browser (`chrome.storage.local`) per page session |
| **Web search queries** | When the model uses the `web_search` tool | Sent to **Google / DuckDuckGo** in a background tab to fetch results | Not stored |
| **AWS Bedrock API key** | You enter it in Settings | Sent **only** to the AWS Bedrock endpoint as an auth header | Stored **locally** in `chrome.storage.sync` |
| **Model/UI preferences** (selected model, token limit, etc.) | You change settings | Stays in the browser | Stored **locally** in `chrome.storage.sync` |

## What the Extension does NOT do

- Does not send your data to any server operated by the developer (there is none).
- Does not use analytics, tracking, advertising, or fingerprinting.
- Does not sell or share your data with third parties.
- Does not collect personal information beyond what you explicitly type or the page you choose to act on.

## Data leak guard

Because `web_search` sends your query to an external search engine, the Extension blocks
searches whose query appears to contain sensitive data (email addresses, national ID numbers,
card numbers, AWS keys/account IDs, passwords) before the query leaves your browser. You remain
responsible for what you ask the agent to do.

## Permissions and why they are needed

- **`activeTab`, `tabs`, `scripting`** — read the current page's content/elements and, in Agent
  mode, perform clicks/inputs you requested; open a background tab for web search.
- **`storage`** — save your API key, model selection, and chat history locally.
- **`sidePanel`** — render the assistant UI in Chrome's side panel.
- **`host_permissions` (`<all_urls>`)** — the assistant must work on whatever page you are
  currently viewing; pages are accessed only when you actively use Chat or Agent on that tab.
- **`bedrock-runtime.us-west-2.amazonaws.com`** — the AWS Bedrock endpoint used to call Claude.

## Third-party services

- **AWS Bedrock (Amazon Web Services)** — model inference. Subject to your AWS account terms
  and the [AWS Privacy Notice](https://aws.amazon.com/privacy/).
- **Google / DuckDuckGo** — only when the agent performs a web search. Subject to their
  respective privacy policies.

## Data retention & deletion

- Chat history and settings live in your browser. Remove them anytime by clearing the chat,
  removing the API key in Settings, or uninstalling the Extension (which deletes all local data).

## Contact

Questions: [@jesamkim](https://github.com/jesamkim) · https://github.com/jesamkim/chrome-ai
