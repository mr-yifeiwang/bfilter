# Bilibili Blocklist

Bilibili's built-in blocklist is account-bounded and sometimes limited. This script stores your own in-browser blocklist and hides matching video cards and comments on supported pages. It can filter out the videos and/or comments:

- Posted by specific users
- Posted by new users, whose created accounts after 2015, 2017, 2020, or 2022
- Containing specific keywords
- (_videos_) Shorter than 1, 3, 5, 10, or 20 minutes
- (_videos_) Having views fewer than 1k, 5k, 10k, 50k, or 100k views

It also supports the following experimental features:

- Blocking all commenters under a video or a post

## Installation

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/).
1. Install the script using one of these options:
   - [Quick install](https://github.com/mr-yifeiwang/bilibili-blocklist/raw/refs/heads/master/main.user.js) the script from GitHub.
   - Copy `main.user.js` into a new Tampermonkey script manually.
1. Open or refresh [bilibili.com](https://www.bilibili.com/) after installation.
