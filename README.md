# IHSG Indicator

A GNOME Shell extension (48+) that displays the IHSG and selected stocks in the top bar.

- Top bar: symbols rotate with a vertical scroll animation and show the daily change as a percentage (▲/▼), using configurable rising and falling colors.
- Position: choose the left, center, or right panel area and set its offset in Preferences.
- Menu: view all symbols with their prices and percentage changes, quote time (WIB), and manual refresh.
- Preferences: add, remove, and reorder symbols (enter `BBCA` → `BBCA.JK`), set refresh intervals, and choose change colors.

Data comes from the unofficial Yahoo Finance chart endpoint and does not require an API key. IDX quotes on Yahoo
are generally delayed rather than real-time. Check "Quote HH:MM:SS WIB" in the menu to see the quote time.

## Install

```bash
make install        # pack + install, then log out and back in (Wayland)
gnome-extensions enable ihsg-indicator@faishalmhmd.dev
```

Development: `make dev` (symlink to `~/.local/share/gnome-shell/extensions/`).
Logs: `journalctl -f -o cat /usr/bin/gnome-shell`
