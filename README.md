# Bilibili Blocklist

Bilibili's built-in blocklist is account-bounded and sometimes limited. This script stores your own in-browser blocklist and hides matching video cards and comments on supported pages. It can filter out the videos and comments:

- Posted by specific users
- Containing specific keywords
- Posted by accounts created after 2015, 2017, 2020, or 2022
- (_videos_) Shorter than the selected short-video threshold (< 1 min, < 3 min, < 5 min, < 10 min, < 20 min)
- (_videos_) Viewed by fewer than the selected unpopular-video threshold (< 1K, < 5K, < 10K, < 50K, < 100K views)

## Installation

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/).
1. Install the script using one of these options:
   - [Quick install](https://github.com/mr-yifeiwang/bilibili-blocklist/raw/refs/heads/master/main.user.js) the script from GitHub.
   - Copy `main.user.js` into a new Tampermonkey script manually.
1. Open or refresh [bilibili.com](https://www.bilibili.com/) after installation.
