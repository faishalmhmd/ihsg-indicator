# IHSG Indicator

Extension GNOME Shell (48+) yang menampilkan IHSG dan daftar emiten pilihan di top bar.

- Top bar: emiten bergantian dengan animasi scroll vertikal (harga + ▲/▼ + %), hijau/merah sesuai perubahan harian.
- Posisi: area kiri/tengah/kanan panel + offset (urutan di area itu), bisa diubah di Preferences.
- Menu: semua emiten + harga + % perubahan, waktu kuote (WIB), refresh manual.
- Preferences: tambah/hapus/urutkan emiten (ketik `BBCA` → `BBCA.JK`), interval refresh.

Data dari endpoint chart Yahoo Finance (tidak resmi, tanpa API key). Kuote bursa IDX di Yahoo
umumnya tertunda, bukan realtime. Lihat "Kuote HH:MM:SS WIB" di menu untuk cek delay-nya.

## Install

```bash
make install        # pack + install, lalu logout/login (Wayland)
gnome-extensions enable ihsg-indicator@faishalmhmd.dev
```

Development: `make dev` (symlink ke `~/.local/share/gnome-shell/extensions/`).
Log: `journalctl -f -o cat /usr/bin/gnome-shell`
