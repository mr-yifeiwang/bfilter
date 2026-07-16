# Manual

- [Manual](#manual)
  - [Overview](#overview)
  - [Installation](#installation)
  - [Supported pages](#supported-pages)
  - [Quick start](#quick-start)
  - [Manager panel](#manager-panel)
    - [Users tab](#users-tab)
    - [Following tab](#following-tab)
    - [Videos tab](#videos-tab)
    - [Comments tab](#comments-tab)
    - [Danmakus tab](#danmakus-tab)
    - [Keywords tab](#keywords-tab)
    - [Settings tab](#settings-tab)
    - [Preview mode](#preview-mode)
  - [Page actions](#page-actions)
    - [User-space actions](#user-space-actions)
    - [Comment actions](#comment-actions)
  - [Filtering behavior](#filtering-behavior)
    - [User filters](#user-filters)
      - [Blocked users](#blocked-users)
      - [Followed users](#followed-users)
      - [Registration-time filter](#registration-time-filter)
    - [Video filters](#video-filters)
      - [Video keyword filter](#video-keyword-filter)
      - [Duration filter](#duration-filter)
      - [Views filter](#views-filter)
      - [Types filter](#types-filter)
    - [Comment filters](#comment-filters)
      - [Comment keyword filter](#comment-keyword-filter)
      - [Mentions-only comment filter](#mentions-only-comment-filter)
      - [Image comment filter](#image-comment-filter)
      - [Commenter-level filter](#commenter-level-filter)
    - [Danmaku filters](#danmaku-filters)
      - [Danmaku keyword filter](#danmaku-keyword-filter)
  - [Data format](#data-format)
  - [Persistence and synchronization](#persistence-and-synchronization)
    - [Breaking 0.25.0 user-list schema](#breaking-0250-user-list-schema)
  - [Limitations](#limitations)
  - [Troubleshooting](#troubleshooting)
  - [Implementation notes](#implementation-notes)
    - [Boot flow](#boot-flow)
    - [Scanning flow](#scanning-flow)
    - [Safety guards](#safety-guards)
    - [Injected UI and styling](#injected-ui-and-styling)
  - [Developer reference](#developer-reference)

## Overview

Bfilter is a browser userscript for Bilibili. It keeps local, browser-based user lists and keyword lists that are independent of the logged-in Bilibili account.

The script can:

- Hide videos and comments from blocked user UIDs.
- Highlight videos and comments from followed user UIDs.
- Hide videos by title keywords.
- Hide comments by text keywords.
- Optionally hide comments whose text only mentions other users.
- Optionally hide comments with attached images.
- Optionally hide comments by commenter level.
- Hide danmakus by text keywords on direct video pages.
- Optionally hide accounts that look newly registered, based on UID length.
- Optionally hide short videos, low-view videos, and selected non-standard content links such as live, manga, or course cards.
- Add quick block/follow controls to Bilibili user-space pages.
- Add per-comment author-block buttons and a bulk “Block All Commenters” button on supported comment pages.

The current script metadata in `main.user.js` identifies the script as version `0.25.0` and runs it at `document-start` on these URL families:

- `https://www.bilibili.com/*`
- `https://search.bilibili.com/*`
- `https://space.bilibili.com/*`
- `https://t.bilibili.com/*`

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

## Supported pages

Bfilter shows the manager UI on these page types:

| Page type     | URL shape                       | Main support                                                                           |
| ------------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| Bilibili home | `www.bilibili.com/`             | Video card filtering and manager panel                                                 |
| Search        | `search.bilibili.com/*`         | Video card filtering and manager panel                                                 |
| Popular       | `www.bilibili.com/v/popular...` | Video card filtering and manager panel                                                 |
| Direct video  | `www.bilibili.com/video/...`    | Recommended-card filtering, comment controls, danmaku keyword filtering, manager panel |
| User space    | `space.bilibili.com/<uid>`      | Follow/block buttons and manager panel                                                 |
| Opus          | `www.bilibili.com/opus/...`     | Comment controls and manager panel                                                     |
| T page        | `t.bilibili.com/*`              | Comment controls and manager panel                                                     |

User-space pages deliberately do not run the normal card/comment scanner. They only render profile actions and the manager panel.

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

The floating **Open Bfilter** button creates a panel with a vertical left-side tab list: **Users**, **Following**, **Videos**, **Comments**, **Danmakus**, and **Settings**. Unified keywords mode also shows a **Keywords** tab. The panel includes a global **Preview** toggle, a **Sort** button, and a **Save** button.

The Save button is enabled only when one or more textareas differ from their last loaded value. Changing checkboxes or dropdowns is saved immediately.

The manager remembers the last selected tab and opens that tab the next time the panel is created. For new users with no saved tab yet, the panel opens the **Users** tab.

Click **Sort** and confirm the warning to sort all available Manager list textareas (including the unified list when its mode is enabled) and remove duplicate, comment-only, and empty-line entries. Duplicate matching uses the entry text after removing inline comments. Inline comments stay attached to the kept original line, and the sorted lists are saved immediately.

### Users tab

Use this tab to maintain the blocked UID list.

- Each line should contain one numeric Bilibili UID.
- Duplicate UIDs are removed at runtime.
- Text after `#` is treated as a comment and ignored by the parser.
- The help text shows the number of blocked users currently loaded.

The tab also includes **Hide by registration time**. When enabled, Bfilter treats sufficiently long numeric UIDs as accounts that match the UID-length heuristic and hides their video cards or comments.

Available registration-time thresholds:

| Label    | Internal test              |
| -------- | -------------------------- |
| `> 2015` | UID has at least 8 digits  |
| `> 2017` | UID has at least 9 digits  |
| `> 2020` | UID has at least 10 digits |
| `> 2022` | UID has at least 15 digits |

The default threshold label is `> 2022`.

### Following tab

Use this tab to maintain UIDs that should be highlighted instead of hidden.

- Each line should contain one numeric UID.
- A followed UID takes priority over blocked-user and content-hide rules for matching cards/comments.
- Select a UID and click **Go** to open `https://space.bilibili.com/<uid>/upload/`. The **Go** button is only shown on this tab.
- The user-space follow button can automatically append usernames as comments, for example `12345678 # username`.

The **Add usernames by default** option (`addUsernamesToFollowedUserUids`) controls whether the user-space follow action stores the current profile username after `#`. It defaults to enabled.

### Videos tab

Use this tab to maintain title keywords for hiding videos.

- Each line is one keyword.
- Matching is case-insensitive and uses simple substring matching.
- Text after `#` is treated as a comment.
- Keywords are stored and displayed in lowercase. Case-insensitive duplicate lines are removed, retaining the first line's comment.

This tab also includes video metadata filters:

- **Hide by duration** with thresholds from `< 1 min` through `< 20 min`.
- **Hide by views** with thresholds from `< 1k` through `< 100k`.
- **Hide by type**, with selectable child types: **Live**, **Manga**, **Course**, and **Bangumi**.

Metadata filters are applied to card-like results and to recommendation areas on direct video pages. They are intentionally not applied to the primary video page owner/content area.

### Comments tab

Use this tab to maintain comment body text keywords for hiding comments. Keywords search only plain comment text, excluding links, author names, and other metadata. It shall be noted that a username appears as plain text when a commenter mentions a user who has blocked him.

- Each line is one keyword.
- Matching is case-insensitive and uses simple substring matching.
- Text after `#` is treated as a comment.
- Keywords are stored and displayed in lowercase. Case-insensitive duplicate lines are removed, retaining the first line's comment.

The tab also includes:

- **Hide by mentions only**: hides comments whose visible comment text consists only of one or more user mentions.
- **Hide by images attached**: hides comments with attached images. It does not match emoji images in comment text.
- **Hide by commenter level**: hides comments from the selected commenter level range. Its dropdown offers `≤ 1`, `≤ 2`, `≤ 3`, `≤ 4`, and `≤ 5` (default `≤ 2`).

### Danmakus tab

Use this tab to maintain danmaku text keywords.

- Each line is one keyword.
- Matching is case-insensitive and uses simple substring matching.
- Text after `#` is treated as a comment.
- Keywords are stored and displayed in lowercase. Case-insensitive duplicate lines are removed, retaining the first line's comment.

Danmaku scanning is only resolved on direct video pages. Matching danmaku rows are hidden or previewed according to the global preview setting.

### Keywords tab

The **Keywords** tab appears only when **Unified keywords mode** is enabled in Settings. Its list is independent from the Videos, Comments, and Danmakus lists. In this mode, the three separate keyword textareas remain visible but disabled, while the unified list alone filters video titles, comment text, and danmaku text. Disabling the mode hides this tab and resumes filtering from the three separate lists; lists are never merged or migrated.

### Settings tab

The **Keywords** section contains **Unified keywords mode**, which is disabled by default and saved with other settings.

The **Statistics** section appears on content-scanning pages and shows the current page's loaded videos, comments, and danmakus. It remains empty on user-space pages, where normal card/comment scanning is deliberately excluded. Each value shows the filtered count and percentage of uniquely observed items in that category (`hidden or previewed ÷ uniquely observed`). Followed and unmatched items are included in the observed total. Statistics are in memory only: they are not saved or exported.

Each statistic uses a background color based on its filtered percentage: green for `0–20%`, orange for more than `20%` through `40%`, and red for more than `40%`.

The values update as Bilibili lazy-loads content. They reset and recount after navigation, a full refresh, or a filtering/settings change that rescans the page.

Use the **Hide** / **Show** toggle beside the Statistics heading to control the **Show Statistics overlay** preference for a compact Statistics overlay beneath **Open Bfilter** outside the Manager. The left, off position hides it; the right, on position shows it. It is hidden by default, remains visible after the Manager closes, and updates with the same lazy-loaded values. Its close button also switches the preference to Hide. This display preference is saved and included in Manager imports and exports.

Use the **Migration** section in this tab to import or export Bfilter data and settings.

- **Import** opens a JSON file picker. After a file is selected, Bfilter shows a warning that the imported data will overwrite the existing data and settings. Confirming replaces all Manager lists and saved settings with the imported values.
- **Export** downloads a JSON backup containing all Manager lists and settings.

Use the **Reset** section to clear all six Manager lists and return every filter setting to its default. Bfilter shows a destructive confirmation first; canceling leaves data and settings unchanged. Resetting preserves the active Manager tab unless it disables unified mode while **Keywords** is active, in which case the panel falls back to **Users**.

### Preview mode

Preview mode changes the consequence of a content match from hiding it to marking it visibly. Previewed matches count as filtered in Settings statistics.

- Off: matching targets receive the internal `data-bfilter-hidden="true"` attribute and are hidden with CSS.
- On: matching targets receive `data-bfilter-previewed="true"` and are highlighted with a red preview background/outline.

Preview mode is useful for checking whether rules are too broad before hiding content.

## Page actions

### User-space actions

On `space.bilibili.com/<uid>` pages, Bfilter inserts two profile buttons:

- **FOLLOW** / **FOLLOWING** toggles the UID in the local followed user list.
- **BLOCK** / **BLOCKED** toggles the UID in the local blocked user list.

If the UID is followed, the block button is disabled. If **Hide by registration time** is enabled and the UID matches the registration-time heuristic, the block button may show an “Already hidden by registration time” hint even if the UID is not explicitly in the blocked user list.

### Comment actions

On direct video, opus, and T pages, Bfilter adds:

- A small **Block** / **Unblock** button next to each eligible loaded comment: the comment must have a detectable author UID and must not currently be hidden by Bfilter. These buttons block or unblock the author UID, not the comment itself.
- A **Block All Commenters** button in the reply navigation bar when comments are loaded.

The bulk action asks for confirmation, then adds all currently loaded comment author UIDs to the blocked user list. It only affects comments present in the DOM at the time of the click.

## Filtering behavior

Bfilter collects a mixed candidate set. Each candidate is classified in this priority order: comment, then danmaku, then video card. This is per-candidate classification, not three global filtering passes.

For video cards, followed UIDs are checked first. If a card belongs to a followed UID, it is highlighted and later hide checks are skipped for that card. Otherwise Bfilter looks for the first matching hide reason in this order:

1. Blocked UID.
2. Video keyword.
3. Registration-time rule.
4. Duration rule.
5. Views rule.
6. Types rule.

For comments, followed author UIDs are highlighted before hide checks. If not followed, Bfilter checks the first matching hide reason in this order:

1. Blocked author UID.
2. Comment keyword.
3. Mentions-only rule.
4. Image-attachment rule.
5. Commenter-level rule.
6. Registration-time rule.

### User filters

User filters are UID-based and can affect both video cards and comments when Bfilter can detect a Bilibili UID.

#### Blocked users

Blocked users are identified by numeric UIDs discovered from links and attributes such as:

- `space.bilibili.com/<uid>` links.
- `data-usercard-mid`.
- `data-mid`.
- `mid`.

When a card/comment contains a blocked UID, Bfilter hides or preview-marks the target unless a safety guard rejects it. The internal `data-bfilter-hidden` attribute marks the hidden target.

#### Followed users

Followed users are stored separately from blocked users. Matching cards/comments receive `data-bfilter-followed-user-uid="true"`, which gives them a green visual treatment.

On user-space pages, the block button is disabled for followed UIDs to avoid conflicting one-click actions.

#### Registration-time filter

The registration-time filter is a heuristic based on UID length. If enabled, a numeric UID with at least the selected number of digits is treated as newer than the selected era label.

This filter applies to video uploaders and comment authors.

### Video filters

Video filters apply to card-like video targets. On direct video pages, metadata filters are limited to recommendation areas so the main video owner/content area is not hidden.

#### Video keyword filter

Video keyword filtering concatenates detected title text and `title` attributes from title-like elements inside a card, then hides or previews the card when that text includes any configured video keyword.

Title sources include selectors such as `.bili-video-card__info--tit`, `.video-title`, `.title-text`, video links with `title` attributes, and nested title elements inside video links, such as direct-video recommendation cards.

#### Duration filter

When enabled, Bfilter parses duration strings such as `03:45` or `01:02:30` from duration-like elements. A video is hidden or previewed when the parsed duration is greater than zero and less than the selected threshold.

Available thresholds:

- `< 1 min` (default)
- `< 3 min`
- `< 5 min`
- `< 10 min`
- `< 20 min`

#### Views filter

When enabled, Bfilter reads the dedicated first view-stat item on known Bilibili cards before falling back to generic stat-like elements. It recognizes plain numbers and Chinese units:

- `万` multiplies by 10,000.
- `亿` multiplies by 100,000,000.

Available thresholds:

- `< 1k` (default)
- `< 5k`
- `< 10k`
- `< 50k`
- `< 100k`

#### Types filter

When enabled, Bfilter can hide card-like links to selected Bilibili content families:

| Type    | Link selector           |
| ------- | ----------------------- |
| Live    | `live.bilibili.com/`    |
| Manga   | `manga.bilibili.com/`   |
| Course  | `bilibili.com/cheese/`  |
| Bangumi | `bilibili.com/bangumi/` |

The child type selector is disabled until **Hide by type** is enabled.

### Comment filters

Comment filters apply to detected comment items on supported comment pages.

#### Comment keyword filter

Comment keyword filtering checks detected comment text, then hides or previews the matching comment item when it includes any configured comment keyword.

#### Mentions-only comment filter

When enabled, Bfilter checks the detected comment body for user mention links. A comment is hidden or previewed when it contains one or more user mentions and no remaining non-whitespace text after those mentions are ignored.

Comments with any additional text are not matched by this filter.

#### Image comment filter

When enabled, Bfilter hides or previews comments that contain an attached image in the comment item's image exhibition area. Emoji images embedded in comment text do not match this filter.

#### Commenter-level filter

When enabled, Bfilter checks the commenter's level badge in the comment's own `.user-info` or `.sub-user-info` area. It accepts only direct badge spans whose trimmed text is exactly `LV0` through `LV6`, so levels from nested replies do not affect their parent comment.

- `≤ 1` hides level 0 and level 1 commenters.
- `≤ 2` through `≤ 5` hide commenters at or below the selected level.
- The default selection is `≤ 2`.

### Danmaku filters

Danmaku filters apply to detected player danmaku rows on direct video pages.

#### Danmaku keyword filter

On direct video pages, Bfilter resolves danmaku rows from known player selectors and checks their text content. Matching rows are hidden or previewed.

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
- Keyword entries are not trimmed after comment stripping beyond the parser's normal comment-strip trim, and matching is substring matching.
- Keyword matching supports emoji text. Search text and keywords are NFC-normalized, and emoji/text variation selectors (`U+FE0E` and `U+FE0F`) are ignored so common forms such as `❤` and `❤️` match each other. Emoji code points, skin-tone modifiers, and zero-width-joiner sequences are otherwise unchanged.
- Saved keyword text uses the same normalization and is displayed in its normalized lowercase form. Removing a variation selector can therefore change an emoji's presentation in the list. Text after `#` is a comment and retains its original casing and characters.

Import/export stores all Manager lists, including `lists.blockedUserUids`, `lists.followedUserUids`, the three separate keyword lists, and `lists.unifiedKeywords` for the unified list. Older imports without the unified fields import an empty unified list with unified mode disabled.

## Persistence and synchronization

Bfilter persists these values:

Storage uses the canonical filter identifiers below.

| Value                               | Storage key                                          |
| ----------------------------------- | ---------------------------------------------------- |
| Blocked user list                   | `bfilter:blocked-user-uids`                          |
| Followed user list                  | `bfilter:followed-user-uids`                         |
| Video keyword list                  | `bfilter:hide-videos-by-keyword`                     |
| Comment keyword list                | `bfilter:hide-comments-by-keyword`                   |
| Danmaku keyword list                | `bfilter:hide-danmakus-by-keyword`                   |
| Unified keyword list                | `bfilter:unified-keywords`                           |
| Unified keywords mode               | `bfilter:unified-keywords-mode`                      |
| Hide by registration time           | `bfilter:hide-users-by-registration-time`            |
| Registration-time threshold         | `bfilter:hide-users-by-registration-time-threshold`  |
| Hide by mentions only               | `bfilter:hide-comments-by-mentions-only`             |
| Hide by images attached             | `bfilter:hide-comments-by-images-attached`           |
| Hide by commenter level             | `bfilter:hide-comments-by-commenter-level`           |
| Commenter-level threshold           | `bfilter:hide-comments-by-commenter-level-threshold` |
| Preview mode                        | `bfilter:preview-mode`                               |
| Hide by duration                    | `bfilter:hide-videos-by-duration`                    |
| Duration threshold                  | `bfilter:hide-videos-by-duration-threshold`          |
| Hide by views                       | `bfilter:hide-videos-by-views`                       |
| Views threshold                     | `bfilter:hide-videos-by-views-threshold`             |
| Hide by type                        | `bfilter:hide-videos-by-type`                        |
| Hide live videos                    | `bfilter:hide-videos-by-type-live`                   |
| Hide manga videos                   | `bfilter:hide-videos-by-type-manga`                  |
| Hide course videos                  | `bfilter:hide-videos-by-type-course`                 |
| Hide bangumi videos                 | `bfilter:hide-videos-by-type-bangumi`                |
| Add usernames to followed user UIDs | `bfilter:add-usernames-to-followed-user-uids`        |
| Show statistics overlay             | `bfilter:show-statistics-overlay`                    |
| Active manager tab                  | `bfilter:active-manager-tab`                         |

When `GM_addValueChangeListener` is available, Bfilter listens for remote changes to filter lists and settings and refreshes runtime state across userscript contexts. Otherwise, it listens for the browser `storage` event as a fallback. The active manager tab is not synchronized.

After a synchronized list or setting change, Bfilter refreshes consequences on the page, updates the manager panel, and rerenders relevant page buttons. The saved active tab is read only when a manager panel is created; saving it does not force an already-created panel in another context to switch tabs.

### Breaking 0.25.0 user-list schema

Version `0.25.0` renames the blocked/followed user-list schema. Export or otherwise back up your data before updating.

- Old `bfilter:hide-users-by-uid` and `bfilter:follow-users-by-uid` storage is ignored; it is not read or migrated.
- Old exports use `lists.hideUsersByUid` and `lists.followUsersByUid`. When imported by `0.25.0`, the renamed blocked/followed lists are empty, while compatible keyword lists and settings may still import.
- Old and new versions use different list storage keys, so blocked/followed list changes do not synchronize across versions.
- Old saved manager-tab values `hide-users-by-uid` and `follow-users-by-uid` are invalid under the new schema and fall back to the default **Users** tab when a panel is created.

## Limitations

- Bilibili DOM changes can break selectors or reduce detection quality.
- Keyword matching is simple substring matching, not regex or fuzzy matching.
- Keyword matching is case-insensitive.
- Registration-time detection is heuristic and based only on UID length.
- View and duration extraction depend on visible card metadata.
- Some pages do not expose specific types of metadata, so relevant filters are unavailable on those pages.
- Bulk author blocking only includes currently loaded comments.
- Userscript manager storage behavior can vary by browser and manager.

## Troubleshooting

| Symptom                                                          | Checks                                                                                                               |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Open Bfilter** does not appear                                 | Confirm the page is in the supported list, refresh the page, and check that the userscript is enabled.               |
| A card that should be hidden is still visible                    | Turn on Preview mode to see whether it is detected; check whether the UID/title is actually present in the card DOM. |
| Too much content is hidden                                       | Disable broad metadata filters first, then review video keywords and registration-time thresholds.                   |
| A direct video page hides recommendations but not the main video | This is intentional; the main video owner area is protected.                                                         |
| Comment buttons do not appear                                    | Load comments first and confirm the page is a direct video, opus, or T page.                                         |
| Changes in another tab do not appear                             | Refresh the page if the userscript manager does not support `GM_addValueChangeListener` reliably.                    |

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

It then resolves each candidate to a comment, danmaku, or video card and applies the first relevant consequence. Candidates in known Bilibili card-internal info branches resolve to their enclosing card so sibling metadata is evaluated together. Resolved items are counted once per category for the current-page Settings statistics; an item first seen before its lazy-loaded metadata matches can later be counted as filtered once the consequence is applied.

### Safety guards

Bfilter avoids hiding overly broad or unsafe targets. A target is not hidden when it is:

- `html`, `body`, `head`, `document.documentElement`, or `document.body`.
- Larger than 75% of the viewport area.
- A container with multiple distinct video links, except recognized ranking items.
- A protected search user-video card.
- The primary uploader area on a direct video page when the uploader UID matches the page owner.

For direct video pages, metadata filters are limited to recommendation areas to avoid hiding the main video area.

### Injected UI and styling

Bfilter injects one `<style>` element with ID `bfilter-style`. The style element is injected idempotently: if the element already exists, no duplicate is added. Because the script runs at `document-start`, injection first tries `document.head` or `document.documentElement` and retries once on `DOMContentLoaded` if no parent is available yet.

Important data attributes:

| Attribute                               | Meaning                                                              |
| --------------------------------------- | -------------------------------------------------------------------- |
| `data-bfilter-hidden="true"`            | Internal attribute indicating the target is hidden.                  |
| `data-bfilter-previewed="true"`         | Target is preview-highlighted.                                       |
| `data-bfilter-followed-user-uid="true"` | Target is followed-user highlighted.                                 |
| `data-bfilter-hidden-uid`               | Internal attribute storing the associated hidden UID when available. |

The CSS text is built by section helpers near `addStyle`: variables, visibility/marking rules, floating/profile buttons, manager panel, and comment buttons. `addStyle` itself only creates the style element, assigns `STYLE_ID`, fills it with `getStyleText()`, and appends it safely.

The injected CSS hides matching targets with `display: none !important`, marks previewed targets with a red background/outline, marks followed targets with a green background/outline, styles the Statistics overlay and shared toggle track, and lays out the manager panel with vertical tabs beside the active editor. Manager tab panels use a consistent minimum height so the panel does not shrink or grow when switching tabs.

## Developer reference

Key code areas in `main.user.js`:

| Area                   | Representative functions                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Startup and navigation | `boot`, `start`, `refreshChromeAndScan`, `patchHistory`                                                                                    |
| Scan scheduling        | `scheduleScan`, `scan`, `collectCandidates`                                                                                                |
| Candidate resolution   | `resolveCommentItem`, `resolveDanmaku`, `resolveVideoCard`                                                                                 |
| Rule evaluation        | `evaluateCard`, `evaluateComment`, `evaluateDanmaku`                                                                                       |
| UID extraction         | `getUploaderUidsInside`, `getCommentAuthorUidsInside`, `addUidFromHref`, `normalizeUid`                                                    |
| Metadata parsing       | `parseDurationSeconds`, `parseViewCount`, `getVideoDurationSeconds`, `getVideoViewCount`                                                   |
| Consequences           | `applyConsequence`, `applyFollowedUserUids`, `clearConsequence`, `clearConsequencesForUid`, `refreshConsequences`                          |
| Statistics             | `renderStatisticsOverlay`, `refreshStatisticsDisplays`, `refreshStatisticsOverlayToggle`                                                   |
| Storage                | `readSaved...`, `save...`, `setupStorageSync`, `sync...`                                                                                   |
| Styling                | `getStyleText`, `getStyleVariables`, `getStyleVisibility`, `getStyleButtons`, `getStyleManagerPanel`, `getStyleCommentButtons`, `addStyle` |
| Manager UI             | `renderBfilterManager`, `ensureBfilterManagerPanel`, `refreshBfilterManagerPanel`, `saveManagerTextareas`                                  |
| User-space UI          | `renderUserPageActionButtons`, `setUidBlocked`, `setUidFollowedUserUids`                                                                   |
| Comment UI             | `renderCommentBlockButtons`, `renderBlockAllCommentersButton`, `blockAllCommenters`                                                        |

When modifying filters, keep the safety guards and direct-video protections in mind. Most regressions on Bilibili pages come from selecting too large a target or matching a container that includes multiple unrelated video links.
