# Manual

- [Manual](#manual)
  - [Overview](#overview)
  - [Supported pages](#supported-pages)
  - [Installation](#installation)
  - [Quick start](#quick-start)
  - [Manager panel](#manager-panel)
    - [Users tab](#users-tab)
    - [Videos tab](#videos-tab)
    - [Danmakus tab](#danmakus-tab)
    - [Following tab](#following-tab)
    - [Preview mode](#preview-mode)
  - [Filtering behavior](#filtering-behavior)
    - [Blocked users](#blocked-users)
    - [Followed users](#followed-users)
    - [New-user filter](#new-user-filter)
    - [Video keyword filter](#video-keyword-filter)
    - [Short-video filter](#short-video-filter)
    - [Unpopular-video filter](#unpopular-video-filter)
    - [Badged-video filter](#badged-video-filter)
    - [Danmaku keyword filter](#danmaku-keyword-filter)
  - [Page actions](#page-actions)
    - [User-space actions](#user-space-actions)
    - [Comment actions](#comment-actions)
  - [Data format](#data-format)
  - [Persistence and synchronization](#persistence-and-synchronization)
  - [Implementation notes](#implementation-notes)
    - [Boot flow](#boot-flow)
    - [Scanning flow](#scanning-flow)
    - [Safety guards](#safety-guards)
    - [Injected UI and styling](#injected-ui-and-styling)
  - [Limitations](#limitations)
  - [Troubleshooting](#troubleshooting)
  - [Developer reference](#developer-reference)

## Overview

Bfilter is a browser userscript for Bilibili. It keeps local, browser-based user lists and keyword lists that are independent of the logged-in Bilibili account.

The script can:

- Hide videos and comments from blocked user UIDs.
- Highlight videos and comments from followed user UIDs.
- Hide videos by title keywords.
- Hide danmakus by text keywords on direct video pages.
- Optionally hide accounts that look newly registered, based on UID length.
- Optionally hide short videos, low-view videos, and selected non-standard content links such as live, manga, or course cards.
- Add quick block/follow controls to Bilibili user-space pages.
- Add per-comment block buttons and a bulk “Block All Commenters” button on supported comment pages.

The current script metadata in `main.user.js` identifies the script as version `0.13.0` and runs it at `document-start` on these URL families:

- `https://www.bilibili.com/*`
- `https://search.bilibili.com/*`
- `https://space.bilibili.com/*`
- `https://t.bilibili.com/*`

## Supported pages

Bfilter shows the manager UI on these page types:

| Page type     | URL shape                            | Main support                                                                           |
| ------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| Bilibili home | `www.bilibili.com/`                  | Video card filtering and manager panel                                                 |
| Search        | `search.bilibili.com/*`              | Video card filtering and manager panel                                                 |
| Ranking       | `www.bilibili.com/v/popular/rank...` | Video card filtering and manager panel                                                 |
| Direct video  | `www.bilibili.com/video/...`         | Recommended-card filtering, comment controls, danmaku keyword filtering, manager panel |
| User space    | `space.bilibili.com/<uid>`           | Follow/block buttons and manager panel                                                 |
| Opus          | `www.bilibili.com/opus/...`          | Comment controls and manager panel                                                     |
| T page        | `t.bilibili.com/*`                   | Comment controls and manager panel                                                     |

User-space pages deliberately do not run the normal card/comment scanner. They only render profile actions and the manager panel.

## Installation

1. Install a userscript manager such as Tampermonkey.
2. Install Bfilter by either:
   - using the raw GitHub install URL from `README.md`, or
   - copying `main.user.js` into a new userscript manually.
3. Open or refresh a supported Bilibili page.
4. Click **Open Bfilter** in the top-right corner when it appears.

The script uses these userscript grants when available:

- `GM_info`
- `GM_getValue`
- `GM_setValue`
- `GM_addValueChangeListener`

If the userscript manager APIs are unavailable, the script falls back to `localStorage` for most persisted values.

## Quick start

1. Open a supported Bilibili page.
2. Click **Open Bfilter**.
3. Add one UID or keyword per line in the relevant tab.
4. Use `#` after an entry to add an inline comment, for example:

   ```text
   12345678 # example blocked user
   87654321 # another user
   ```

5. Click **Save**.
6. Existing visible cards/comments are rescanned immediately, and newly loaded content is scanned automatically.

## Manager panel

The floating **Open Bfilter** button creates a panel with four tabs: **Users**, **Videos**, **Danmakus**, and **Following**. The panel also includes a global **Preview** toggle and a **Save** button.

The Save button is enabled only when one or more textareas differ from their last loaded value. Changing checkboxes or dropdowns is saved immediately.

### Users tab

Use this tab to maintain the blocked UID list.

- Each line should contain one numeric Bilibili UID.
- Duplicate UIDs are removed at runtime.
- Text after `#` is treated as a comment and ignored by the parser.
- The help text shows the number of blocked users currently loaded.

The tab also includes **Block new users**. When enabled, Bfilter treats sufficiently long numeric UIDs as new accounts and hides their video cards or comments.

Available new-user thresholds:

| Label    | Internal test              |
| -------- | -------------------------- |
| `> 2015` | UID has at least 8 digits  |
| `> 2017` | UID has at least 9 digits  |
| `> 2020` | UID has at least 10 digits |
| `> 2022` | UID has at least 15 digits |

The default threshold label is `> 2022`.

### Videos tab

Use this tab to maintain title keywords for video blocking.

- Each line is one keyword.
- Matching is case-sensitive and uses simple substring matching.
- Text after `#` is treated as a comment.
- Duplicate keyword lines are removed at runtime.

This tab also includes video metadata filters:

- **Hide short videos** with thresholds from `< 1 min` through `< 20 min`.
- **Hide unpopular videos** with thresholds from `< 1k views` through `< 100k views`.
- **Hide badged videos**, with selectable child types: **Live**, **Manga**, and **Course**.

Metadata filters are applied to card-like results and to recommendation areas on direct video pages. They are intentionally not applied to the primary video page owner/content area.

### Danmakus tab

Use this tab to maintain danmaku text keywords.

- Each line is one keyword.
- Matching is case-sensitive and uses simple substring matching.
- Text after `#` is treated as a comment.
- Duplicate keyword lines are removed at runtime.

Danmaku scanning is only resolved on direct video pages. Matching danmaku rows are hidden or previewed according to the global preview setting.

### Following tab

Use this tab to maintain UIDs that should be highlighted instead of hidden.

- Each line should contain one numeric UID.
- A followed UID takes priority over blocking for matching cards/comments.
- The user-space follow button can automatically append usernames as comments, for example `12345678 # username`.

The **Add usernames by default** option controls whether the user-space follow action stores the current profile username after `#`. It defaults to enabled.

### Preview mode

Preview mode changes blocking consequences from “hide” to “mark visibly.”

- Off: matching targets receive `data-bfilter-blocked="true"` and are hidden with CSS.
- On: matching targets receive `data-bfilter-previewed="true"` and are highlighted with a red preview background/outline.

Preview mode is useful for checking whether rules are too broad before hiding content.

## Filtering behavior

Bfilter evaluates candidates in this order:

1. Comments.
2. Danmakus.
3. Video cards.

For video cards, followed UIDs are checked first. If a card belongs to a followed UID, it is highlighted and later block checks are skipped for that card. Otherwise Bfilter looks for the first matching block reason in this order:

1. Blocked UID.
2. Video keyword.
3. New-user rule.
4. Short-video rule.
5. Unpopular-video rule.
6. Badged-video rule.

For comments, followed author UIDs are highlighted before block checks. If not followed, comments are hidden/previewed by blocked UID or new-user rule.

### Blocked users

Blocked users are identified by numeric UIDs discovered from links and attributes such as:

- `space.bilibili.com/<uid>` links.
- `data-usercard-mid`.
- `data-mid`.
- `mid`.

When a card/comment contains a blocked UID, Bfilter marks the target as blocked unless a safety guard rejects the target.

### Followed users

Followed users are stored separately from blocked users. Matching cards/comments receive `data-bfilter-followed="true"`, which gives them a green visual treatment.

On user-space pages, the block button is disabled for followed UIDs to avoid conflicting one-click actions.

### New-user filter

The new-user filter is a heuristic based on UID length. If enabled, a numeric UID with at least the selected number of digits is treated as newer than the selected era label.

This filter applies to video uploaders and comment authors.

### Video keyword filter

Video keyword filtering concatenates detected title text and `title` attributes from title-like elements inside a card, then checks whether that text includes any blocked video keyword.

Title sources include selectors such as `.bili-video-card__info--tit`, `.video-title`, `.title-text`, video links with `title` attributes, and nested title elements inside video links, such as direct-video recommendation cards.

### Short-video filter

When enabled, Bfilter parses duration strings such as `03:45` or `01:02:30` from duration-like elements. A video is blocked when the parsed duration is greater than zero and less than the selected threshold.

Available thresholds:

- `< 1 min` (default)
- `< 3 min`
- `< 5 min`
- `< 10 min`
- `< 20 min`

### Unpopular-video filter

When enabled, Bfilter parses view counts from stat-like elements. It recognizes plain numbers and Chinese units:

- `万` multiplies by 10,000.
- `亿` multiplies by 100,000,000.

Available thresholds:

- `< 1k views` (default)
- `< 5k views`
- `< 10k views`
- `< 50k views`
- `< 100k views`

### Badged-video filter

When enabled, Bfilter can hide card-like links to selected Bilibili content families:

| Type   | Link selector          |
| ------ | ---------------------- |
| Live   | `live.bilibili.com/`   |
| Manga  | `manga.bilibili.com/`  |
| Course | `bilibili.com/cheese/` |

The child type selector is disabled until **Hide badged videos** is enabled.

### Danmaku keyword filter

On direct video pages, Bfilter resolves danmaku rows from known player selectors and checks their text content. Matching rows are hidden or previewed.

## Page actions

### User-space actions

On `space.bilibili.com/<uid>` pages, Bfilter inserts two profile buttons:

- **FOLLOW** / **FOLLOWING** toggles the UID in the local following list.
- **BLOCK** / **BLOCKED** toggles the UID in the local blocklist.

If the UID is followed, the block button is disabled. If **Block new users** is enabled and the UID matches the new-user heuristic, the block button may show an “Already blocked as New Users” hint even if the UID is not explicitly in the blocklist.

### Comment actions

On direct video, opus, and T pages, Bfilter adds:

- A small **Block** / **Unblock** button next to each detected comment author.
- A **Block All Commenters** button in the reply navigation bar when comments are loaded.

The bulk action asks for confirmation, then adds all currently loaded comment author UIDs to the blocklist. It only affects comments present in the DOM at the time of the click.

## Data format

All editable list textareas use line-based data.

Blocked/followed UID example:

```text
12345678
87654321 # useful note
```

Keyword example:

```text
keyword
another keyword # ignored comment
```

Parsing rules:

- Entries are split by newline.
- Text after the first `#` is ignored.
- UID entries must normalize to digits only.
- Empty lines are ignored.
- Duplicates are removed while preserving first-seen order.
- Keyword entries are not trimmed after comment stripping beyond the parser's normal comment-strip trim, and matching is exact substring matching.

## Persistence and synchronization

Bfilter persists these values:

| Value                       | Storage key                           |
| --------------------------- | ------------------------------------- |
| Blocked user list           | `bfilter:blocklist`                   |
| Following user list         | `bfilter:following`                   |
| Video keyword list          | `bfilter:video-keyword-blocklist`     |
| Danmaku keyword list        | `bfilter:danmaku-keyword-blocklist`   |
| Block new users             | `bfilter:block-new-users`             |
| Registration-time threshold | `bfilter:registration-time-threshold` |
| Preview mode                | `bfilter:preview-mode`                |
| Hide short videos           | `bfilter:hide-short-videos`           |
| Short-video threshold       | `bfilter:short-video-threshold`       |
| Hide unpopular videos       | `bfilter:hide-unpopular-videos`       |
| Unpopular-video threshold   | `bfilter:unpopular-video-threshold`   |
| Hide badged videos          | `bfilter:hide-badged-videos`          |
| Hide live videos            | `bfilter:hide-live-videos`            |
| Hide manga videos           | `bfilter:hide-manga-videos`           |
| Hide course videos          | `bfilter:hide-course-videos`          |
| Add usernames to following  | `bfilter:add-usernames-to-following`  |

When `GM_addValueChangeListener` is available, Bfilter listens for remote value changes and refreshes runtime state across userscript contexts. Otherwise, it listens for the browser `storage` event as a fallback.

After a synchronized change, Bfilter refreshes consequences on the page, updates the manager panel, and rerenders relevant page buttons.

## Implementation notes

### Boot flow

At load time, Bfilter:

1. Injects CSS.
2. Reads saved UID lists, keyword lists, booleans, and threshold labels.
3. Normalizes runtime sets and settings.
4. Registers storage synchronization listeners.
5. Renders user-space buttons if appropriate.
6. Renders the manager panel if appropriate.
7. Starts scanning at `DOMContentLoaded` or immediately if the document is already ready.
8. Hooks `pageshow`, `history.pushState`, `history.replaceState`, and `popstate` so SPA-style navigation is rescanned.

### Scanning flow

The scanner is driven by a `MutationObserver`. DOM mutations schedule a batched scan via `requestAnimationFrame`.

For each scan root, Bfilter collects candidates matching known selectors for:

- video cards,
- comments,
- danmaku rows,
- uploader links/attributes,
- comment author links,
- video links,
- live/manga/course links.

It then resolves each candidate to a comment, danmaku, or video card and applies the first relevant consequence.

### Safety guards

Bfilter avoids hiding overly broad or unsafe targets. A target is rejected when it is:

- `html`, `body`, `head`, `document.documentElement`, or `document.body`.
- Larger than 75% of the viewport area.
- A container with multiple distinct video links, except recognized ranking items.
- A protected search user-video card.
- The primary uploader area on a direct video page when the uploader UID matches the page owner.

For direct video pages, metadata filters are limited to recommendation areas to avoid hiding the main video area.

### Injected UI and styling

Bfilter injects one `<style>` element with ID `bfilter-style`.

Important data attributes:

| Attribute                       | Meaning                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| `data-bfilter-blocked="true"`   | Target is hidden.                                                  |
| `data-bfilter-previewed="true"` | Target is preview-highlighted.                                     |
| `data-bfilter-followed="true"`  | Target is follow-highlighted.                                      |
| `data-bfilter-blocked-uid`      | Stores the UID associated with a block consequence when available. |

The CSS hides blocked targets with `display: none !important`, marks previewed targets with a red background/outline, and marks followed targets with a green background/outline.

## Limitations

- Bilibili DOM changes can break selectors or reduce detection quality.
- Keyword matching is simple substring matching, not regex or fuzzy matching.
- Keyword matching is case-sensitive.
- New-user detection is heuristic and based only on UID length.
- View and duration extraction depend on visible card metadata.
- Bulk comment blocking only includes currently loaded comments.
- Userscript manager storage behavior can vary by browser and manager.

## Troubleshooting

| Symptom                                                          | Checks                                                                                                               |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Open Bfilter** does not appear                                 | Confirm the page is in the supported list, refresh the page, and check that the userscript is enabled.               |
| A blocked card is still visible                                  | Turn on Preview mode to see whether it is detected; check whether the UID/title is actually present in the card DOM. |
| Too much content is hidden                                       | Disable broad metadata filters first, then review video keywords and new-user thresholds.                            |
| A direct video page hides recommendations but not the main video | This is intentional; the main video owner area is protected.                                                         |
| Comment buttons do not appear                                    | Load comments first and confirm the page is a direct video, opus, or T page.                                         |
| Changes in another tab do not appear                             | Refresh the page if the userscript manager does not support `GM_addValueChangeListener` reliably.                    |

## Developer reference

Key code areas in `main.user.js`:

| Area                   | Representative functions                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| Startup and navigation | `boot`, `start`, `refreshChromeAndScan`, `patchHistory`                                                   |
| Scan scheduling        | `scheduleScan`, `scan`, `collectCandidates`                                                               |
| Candidate resolution   | `resolveCommentItem`, `resolveDanmaku`, `resolveVideoCard`                                                |
| Rule evaluation        | `evaluateCard`, `evaluateComment`, `evaluateDanmaku`                                                      |
| UID extraction         | `getUploaderUidsInside`, `getCommentAuthorUidsInside`, `addUidFromHref`, `normalizeUid`                   |
| Metadata parsing       | `parseDurationSeconds`, `parseViewCount`, `getVideoDurationSeconds`, `getVideoViewCount`                  |
| Consequences           | `applyConsequence`, `applyFollow`, `clearConsequence`, `refreshConsequences`                              |
| Storage                | `readSaved...`, `save...`, `setupStorageSync`, `sync...`                                                  |
| Manager UI             | `renderBfilterManager`, `ensureBfilterManagerPanel`, `refreshBfilterManagerPanel`, `saveManagerTextareas` |
| User-space UI          | `renderUserPageBlockButton`, `setUidBlocked`, `setUidFollowing`                                           |
| Comment UI             | `renderCommentBlockButtons`, `renderBlockAllCommentersButton`, `blockAllCommenters`                       |

When modifying filters, keep the safety guards and direct-video protections in mind. Most regressions on Bilibili pages come from selecting too large a target or matching a container that includes multiple unrelated video links.
