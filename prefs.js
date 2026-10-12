import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {displayName, normalize} from './utils.js';

export default class IhsgPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'General'});

        // --- Daftar emiten ---
        const listGroup = new Adw.PreferencesGroup({
            title: 'Daftar emiten',
            description: 'Top bar berganti per emiten secara bergulir; semuanya muncul di menu.',
        });
        const addGroup = new Adw.PreferencesGroup();

        const entry = new Adw.EntryRow({
            title: 'Tambah emiten (mis. BBCA, TLKM, IHSG)',
            show_apply_button: true,
        });
        addGroup.add(entry);
        entry.connect('apply', () => {
            const sym = normalize(entry.text);
            if (!sym)
                return;
            const list = settings.get_strv('symbols');
            if (!list.includes(sym)) {
                list.push(sym);
                settings.set_strv('symbols', list);
            }
            entry.text = '';
        });

        const rows = [];
        const rebuild = () => {
            rows.forEach(r => listGroup.remove(r));
            rows.length = 0;

            settings.get_strv('symbols').forEach((sym, i) => {
                const row = new Adw.ActionRow({
                    title: displayName(sym),
                    subtitle: sym,
                });

                if (i > 0) {
                    const up = new Gtk.Button({
                        icon_name: 'go-up-symbolic',
                        valign: Gtk.Align.CENTER,
                        css_classes: ['flat'],
                        tooltip_text: 'Naikkan',
                    });
                    up.connect('clicked', () => {
                        const l = settings.get_strv('symbols');
                        [l[i - 1], l[i]] = [l[i], l[i - 1]];
                        settings.set_strv('symbols', l);
                    });
                    row.add_suffix(up);
                }

                const del = new Gtk.Button({
                    icon_name: 'user-trash-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['flat'],
                    tooltip_text: 'Hapus',
                });
                del.connect('clicked', () => {
                    const l = settings.get_strv('symbols');
                    l.splice(i, 1);
                    settings.set_strv('symbols', l);
                });
                row.add_suffix(del);

                listGroup.add(row);
                rows.push(row);
            });
        };
        const symId = settings.connect('changed::symbols', rebuild);
        window.connect('close-request', () => settings.disconnect(symId));
        rebuild();

        // --- Posisi di panel ---
        const POS = ['left', 'center', 'right'];
        const posGroup = new Adw.PreferencesGroup({
            title: 'Posisi di panel',
            description: 'Offset = urutan di dalam area yang dipilih. 0 = paling kiri di area itu; naikkan untuk menggeser ke kanan.',
        });

        const posRow = new Adw.ComboRow({
            title: 'Area',
            model: Gtk.StringList.new(['Kiri', 'Tengah', 'Kanan']),
        });
        posRow.selected = Math.max(0, POS.indexOf(settings.get_string('panel-position')));
        posRow.connect('notify::selected', () =>
            settings.set_string('panel-position', POS[posRow.selected]));
        posGroup.add(posRow);

        const offsetRow = new Adw.SpinRow({
            title: 'Offset',
            adjustment: new Gtk.Adjustment({
                lower: 0, upper: 20, step_increment: 1, page_increment: 5,
            }),
        });
        posGroup.add(offsetRow);
        settings.bind('panel-offset', offsetRow, 'value', Gio.SettingsBindFlags.DEFAULT);

        // --- Umum ---
        const general = new Adw.PreferencesGroup({title: 'Umum'});

        const interval = new Adw.SpinRow({
            title: 'Interval refresh data',
            subtitle: 'Dalam detik (15–3600)',
            adjustment: new Gtk.Adjustment({
                lower: 15, upper: 3600, step_increment: 15, page_increment: 60,
            }),
        });
        general.add(interval);
        settings.bind('refresh-interval', interval, 'value', Gio.SettingsBindFlags.DEFAULT);

        const rotate = new Adw.SpinRow({
            title: 'Jeda ganti emiten di top bar',
            subtitle: 'Dalam detik (2–60)',
            adjustment: new Gtk.Adjustment({
                lower: 2, upper: 60, step_increment: 1, page_increment: 5,
            }),
        });
        general.add(rotate);
        settings.bind('rotate-interval', rotate, 'value', Gio.SettingsBindFlags.DEFAULT);

        const change = new Adw.SwitchRow({
            title: 'Tampilkan % perubahan di top bar',
        });
        general.add(change);
        settings.bind('show-change', change, 'active', Gio.SettingsBindFlags.DEFAULT);

        page.add(posGroup);
        page.add(listGroup);
        page.add(addGroup);
        page.add(general);
        window.add(page);
    }
}
