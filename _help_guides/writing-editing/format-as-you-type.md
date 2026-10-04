---
layout: help-article
title: Format as you type with markdown
category: writing-editing
order: 2
summary: Type a few characters and Writing Desk turns them into headings, lists and formatting. Works in every kind of document.
related_faqs: [markdown-typing, markdown-support, markdown-images, frontmatter]
---

Markdown is a simple way to format text by typing. Type `## ` at the start of a line and it becomes a chapter heading; wrap a word in `**` and it turns bold. You'll find this reference inside the app under **Help → Markdown Reference**.

These shortcuts work in every document, whether it's a markdown file, a Word file or a Writing Desk project. In a markdown file, the formatting is saved as markdown. In Word files and Writing Desk documents, it's saved as ordinary formatting.

## Type to format

Type these at the start of a line, or around a word, and they turn into formatting as you go.

| Type | You get |
|---|---|
| `# ` | Heading 1 |
| `## ` | Heading 2 (chapter) |
| `### ` | Heading 3 (scene) |
| `- ` or `* ` | Bulleted list |
| `1. ` | Numbered list |
| `> ` | Quote |
| `**bold**` or `__bold__` | **Bold** |
| `*italic*` or `_italic_` | *Italic* |
| `~~struck~~` | Strikethrough |
| `` `code` `` | Code |
| <code>```</code> | Code block |
| `---` | Divider line |

The space after `#`, `-`, `1.` and `>` matters: it's what tells Writing Desk to start the heading, list or quote.

Code and divider lines are markdown features. They're kept in markdown files and Writing Desk documents, and left out when you save or export to Word (.docx).

## In a markdown file

You'll mostly see these in markdown files written elsewhere, such as posts from a blogging platform. Writing Desk shows them as formatting and saves them back exactly as written.

| In the file | What it is |
|---|---|
| `[words](https://example.com)` | A link |
| `![description](images/photo.png)` | An image, found relative to the file's folder |
| `<u>underlined</u>` | Underline |
| `\| Name \| Role \|` | A table: a header row, then `\| --- \| --- \|`, then one row per line |
| `title: My post` between two `---` lines at the very top | Frontmatter, kept exactly as written |
| `\` at the end of a line | A line break |
| A blank line | A new paragraph |

Other HTML tags in a markdown file show as plain text.
