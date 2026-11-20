# Bfilter

Bfilter is a userscript that filters videos and comments on Bilibili's Home, Search, Ranking, and Video pages.

| Target           | Filters                                     |
| ---------------- | ------------------------------------------- |
| Users & contents | UID, registration time                      |
| Videos           | duration, views, types (e.g. Live, Bangumi) |

## Limitations

- **Metadata availability:** Filters require metadata exposed by Bilibili. If it is unavailable, the affected filters cannot work. For example, the Duration filter cannot work on the Ranking page because video duration is not exposed there.
- **Bfilter `1.x` settings:** Settings from Bfilter `1.x` are not supported and migrated automatically.

## Installation

1. Install a userscript manager (e.g. [Tampermonkey](https://www.tampermonkey.net/)).
2. [Click here](https://github.com/mr-yifeiwang/bfilter/raw/refs/heads/master/main.user.js) to install the script from GitHub.
