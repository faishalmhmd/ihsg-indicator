import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Soup from 'gi://Soup?version=3.0';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {displayName, digitsFor, fmt, timeWIB} from './utils.js';

Gio._promisify(Soup.Session.prototype, 'send_and_read_async');

const BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)';

const COLOR_UP = '#26a269';
const COLOR_DOWN = '#e01b24';
const CHG_STYLE = 'margin-left: 12px; min-width: 72px; text-align: right;';
const SLIDE_MS = 300;

const colorOf = diff => (diff > 0 ? COLOR_UP : diff < 0 ? COLOR_DOWN : null);
const arrowOf = diff => (diff > 0 ? '▲' : diff < 0 ? '▼' : '•');

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init(ext) {
        super._init(0.0, ext.metadata.name, false);

        this._settings = ext.getSettings();
        this._session = new Soup.Session({timeout: 15});
        this._cancellable = new Gio.Cancellable();
        this._refreshId = 0;
        this._rotateId = 0;
        this._quotes = new Map();   // symbol -> {price, prev, time, stale?, error?}
        this._rows = new Map();     // symbol -> {price, chg}
        this._fetchedAt = null;
        this._error = null;
        this._idx = 0;              // emiten yang sedang tampil di top bar
        this._active = 0;           // slide yang sedang tampil (0/1)
        this._destroyed = false;

        // Top bar: dua slide yang bergantian (scroll vertikal)
        this._clip = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            clip_to_allocation: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
        });
        this._slides = [this._makeSlide(), this._makeSlide()];
        this._slides.forEach(s => this._clip.add_child(s.actor));
        this._slides[0].actor.visible = true;
        this.add_child(this._clip);

        // Menu: semua emiten
        this._list = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._list);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._info = new PopupMenu.PopupMenuItem('—', {reactive: false});
        this.menu.addMenuItem(this._info);

        const refresh = new PopupMenu.PopupMenuItem('Refresh sekarang');
        refresh.connect('activate', () => this._refresh());
        this.menu.addMenuItem(refresh);

        const prefs = new PopupMenu.PopupMenuItem('Preferences');
        prefs.connect('activate', () => ext.openPreferences());
        this.menu.addMenuItem(prefs);

        this._signals = [
            this._settings.connect('changed::symbols', () => {
                this._idx = 0;
                this._buildRows();
                this._render();
                this._refresh();
            }),
            this._settings.connect('changed::refresh-interval', () => this._scheduleRefresh()),
            this._settings.connect('changed::rotate-interval', () => this._scheduleRotate()),
            this._settings.connect('changed::show-change', () => this._render()),
        ];

        this._buildRows();
        this._render();
        this._refresh();
        this._scheduleRefresh();
        this._scheduleRotate();
    }

    // ---------- top bar slides ----------

    _makeSlide() {
        const actor = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            visible: false,
        });
        const name = new St.Label({
            y_align: Clutter.ActorAlign.CENTER,
            style: 'margin-right: 6px;',
        });
        const value = new St.Label({y_align: Clutter.ActorAlign.CENTER});
        actor.add_child(name);
        actor.add_child(value);
        return {actor, name, value};
    }

    _fillSlide(slide, sym) {
        if (!sym) {
            slide.name.text = 'IHSG';
            slide.value.text = '—';
            slide.value.set_style(null);
            return;
        }

        slide.name.text = displayName(sym);
        const q = this._quotes.get(sym);

        if (!q) {
            slide.value.text = '…';
            slide.value.set_style(null);
        } else if (q.error) {
            slide.value.text = 'n/a';
            slide.value.set_style(null);
        } else {
            const diff = q.price - q.prev;
            const pct = q.prev ? (diff / q.prev) * 100 : 0;
            let text = `${fmt(q.price, digitsFor(sym))} ${arrowOf(diff)}`;
            if (this._settings.get_boolean('show-change'))
                text += `${fmt(Math.abs(pct), 2)}%`;
            if (q.stale)
                text += ' !';
            slide.value.text = text;
            const c = colorOf(diff);
            slide.value.set_style(c ? `color: ${c};` : null);
        }
    }

    _currentSymbol() {
        const syms = this._symbols();
        return syms.length ? syms[this._idx % syms.length] : null;
    }

    _rotate() {
        const syms = this._symbols();
        if (syms.length < 2 || this._destroyed)
            return;

        const cur = this._slides[this._active];
        const nxt = this._slides[1 - this._active];
        this._idx = (this._idx + 1) % syms.length;
        this._fillSlide(nxt, syms[this._idx]);

        const h = this._clip.height || 30;
        cur.actor.remove_all_transitions();
        nxt.actor.remove_all_transitions();

        // slide baru masuk dari bawah, yang lama keluar ke atas
        nxt.actor.set({visible: true, translation_y: h, opacity: 0});
        const mode = Clutter.AnimationMode.EASE_OUT_QUAD;
        cur.actor.ease({
            translation_y: -h,
            opacity: 0,
            duration: SLIDE_MS,
            mode,
            onComplete: () => {
                if (!this._destroyed)
                    cur.actor.visible = false;
            },
        });
        nxt.actor.ease({
            translation_y: 0,
            opacity: 255,
            duration: SLIDE_MS,
            mode,
        });

        this._active = 1 - this._active;
    }

    // ---------- menu rows ----------

    _symbols() {
        return this._settings.get_strv('symbols');
    }

    _buildRows() {
        this._list.removeAll();
        this._rows.clear();

        for (const sym of this._symbols()) {
            const item = new PopupMenu.PopupBaseMenuItem({reactive: false});
            const name = new St.Label({text: displayName(sym), x_expand: true});
            const price = new St.Label({text: '…', style: 'margin-left: 16px;'});
            const chg = new St.Label({text: '', style: CHG_STYLE});
            item.add_child(name);
            item.add_child(price);
            item.add_child(chg);
            this._list.addMenuItem(item);
            this._rows.set(sym, {price, chg});
        }
    }

    // ---------- timers ----------

    _scheduleRefresh() {
        if (this._refreshId)
            GLib.source_remove(this._refreshId);
        const secs = this._settings.get_uint('refresh-interval');
        this._refreshId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, secs, () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _scheduleRotate() {
        if (this._rotateId)
            GLib.source_remove(this._rotateId);
        const secs = this._settings.get_uint('rotate-interval');
        this._rotateId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, secs, () => {
            this._rotate();
            return GLib.SOURCE_CONTINUE;
        });
    }

    // ---------- data ----------

    async _fetchOne(sym) {
        const url = `${BASE}${encodeURIComponent(sym)}?interval=1d&range=1d`;
        const msg = Soup.Message.new('GET', url);
        msg.request_headers.append('User-Agent', UA);

        const bytes = await this._session.send_and_read_async(
            msg, GLib.PRIORITY_DEFAULT, this._cancellable);

        if (msg.status_code !== Soup.Status.OK)
            throw new Error(`${sym}: HTTP ${msg.status_code}`);

        const json = JSON.parse(new TextDecoder().decode(bytes.get_data()));
        const result = json.chart?.result?.[0];
        if (!result)
            throw new Error(`${sym}: ${json.chart?.error?.description ?? 'tidak ditemukan'}`);

        const m = result.meta;
        return {
            price: m.regularMarketPrice,
            prev: m.chartPreviousClose ?? m.previousClose,
            time: m.regularMarketTime,
        };
    }

    async _refresh() {
        const syms = this._symbols();
        for (const k of [...this._quotes.keys()]) {
            if (!syms.includes(k))
                this._quotes.delete(k);
        }

        const results = await Promise.allSettled(syms.map(s => this._fetchOne(s)));
        if (this._destroyed)
            return;

        this._error = null;
        results.forEach((r, i) => {
            const sym = syms[i];
            if (r.status === 'fulfilled') {
                this._quotes.set(sym, r.value);
                return;
            }
            this._error = r.reason?.message ?? String(r.reason);
            console.error(`[ihsg-indicator] ${this._error}`);
            const old = this._quotes.get(sym);
            this._quotes.set(sym, old && !old.error ? {...old, stale: true} : {error: true});
        });

        this._fetchedAt = new Date();
        this._render();
    }

    _render() {
        // Baris menu
        for (const sym of this._symbols()) {
            const row = this._rows.get(sym);
            const q = this._quotes.get(sym);
            if (!row || !q)
                continue;

            if (q.error) {
                row.price.text = 'n/a';
                row.chg.text = '';
                continue;
            }

            const diff = q.price - q.prev;
            const pct = q.prev ? (diff / q.prev) * 100 : 0;
            row.price.text = fmt(q.price, digitsFor(sym)) + (q.stale ? ' !' : '');
            row.chg.text = `${arrowOf(diff)} ${fmt(Math.abs(pct), 2)}%`;
            const c = colorOf(diff);
            row.chg.set_style(c ? `${CHG_STYLE} color: ${c};` : CHG_STYLE);
        }

        // Slide yang sedang tampil di top bar (tanpa animasi)
        this._fillSlide(this._slides[this._active], this._currentSymbol());

        // Info: waktu kuote dari Yahoo vs waktu fetch (untuk lihat delay)
        const times = [...this._quotes.values()].filter(q => q.time).map(q => q.time);
        const parts = [];
        if (times.length)
            parts.push(`Kuote ${timeWIB(Math.max(...times))} WIB`);
        if (this._fetchedAt)
            parts.push(`fetch ${this._fetchedAt.toLocaleTimeString('en-GB')}`);
        this._info.label.text = this._error
            ? `Gagal: ${this._error}`
            : parts.join(' · ') || '—';
    }

    destroy() {
        this._destroyed = true;
        if (this._refreshId)
            GLib.source_remove(this._refreshId);
        if (this._rotateId)
            GLib.source_remove(this._rotateId);
        this._refreshId = this._rotateId = 0;
        this._slides.forEach(s => s.actor.remove_all_transitions());
        this._cancellable.cancel();
        this._session.abort();
        this._signals.forEach(id => this._settings.disconnect(id));
        this._signals = [];
        this._settings = null;
        super.destroy();
    }
});

export default class IhsgExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._place();
        this._signals = ['panel-position', 'panel-offset'].map(key =>
            this._settings.connect(`changed::${key}`, () => this._place()));
    }

    // (Re)pasang indikator sesuai posisi + offset di settings
    _place() {
        this._indicator?.destroy();
        this._indicator = new Indicator(this);
        Main.panel.addToStatusArea(
            this.uuid,
            this._indicator,
            this._settings.get_uint('panel-offset'),
            this._settings.get_string('panel-position'));
    }

    disable() {
        this._signals?.forEach(id => this._settings.disconnect(id));
        this._signals = null;
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }
}
