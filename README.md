# Bilibili Blocklist

Bilibili's built-in blocklist is account-bounded and sometimes limited. This script stores your own in-browser blocklist and hides matching videos, comments, and danmakus on supported pages.

| Filters       | Users | Videos | Danmakus |
| ------------- | ----- | ------ | -------- |
| User UID      | ✓     | ✓      |          |
| Creation time | ✓     |        |          |
| Keyword       |       | ✓      | ✓        |
| Duration      |       | ✓      |          |
| Views         |       | ✓      |          |

It also supports the following experimental features:

- Blocking all commenters under a video or a post
- Following users and highlighting their videos and posts

## Installation

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/).
1. Install the script using one of these options:
   - [Quick install](https://github.com/mr-yifeiwang/bilibili-blocklist/raw/refs/heads/master/main.user.js) the script from GitHub.
   - Copy `main.user.js` into a new Tampermonkey script manually.
1. Open or refresh [bilibili.com](https://www.bilibili.com/) after installation.
