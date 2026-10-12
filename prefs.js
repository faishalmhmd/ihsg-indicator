import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {displayName, normalize} from './utils.js';

export default class IhsgPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'General'});

        // --- Symbols ---
        const listGroup = new Adw.PreferencesGroup({
            title: 'Symbols',
            description: 'The top bar rotates through symbols; all symbols are listed in the menu.',
        });
        const addGroup = new Adw.PreferencesGroup();

        const entry = new Adw.EntryRow({
            title: 'Add symbol (e.g. BBCA, TLKM, IHSG)',
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
                        tooltip_text: 'Move up',
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
                    tooltip_text: 'Remove',
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

        // --- Panel position ---
        const POS = ['left', 'center', 'right'];
        const posGroup = new Adw.PreferencesGroup({
            title: 'Panel position',
            description: 'Offset sets the order within the selected area. 0 is the leftmost position; increase it to move right.',
        });

        const posRow = new Adw.ComboRow({
            title: 'Area',
            model: Gtk.StringList.new(['Left', 'Center', 'Right']),
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

        // --- General ---
        const general = new Adw.PreferencesGroup({title: 'General'});

        const interval = new Adw.SpinRow({
            title: 'Data refresh interval',
            subtitle: 'In seconds (15–3600)',
            adjustment: new Gtk.Adjustment({
                lower: 15, upper: 3600, step_increment: 15, page_increment: 60,
            }),
        });
        general.add(interval);
        settings.bind('refresh-interval', interval, 'value', Gio.SettingsBindFlags.DEFAULT);

        const rotate = new Adw.SpinRow({
            title: 'Symbol rotation interval',
            subtitle: 'In seconds (2–60)',
            adjustment: new Gtk.Adjustment({
                lower: 2, upper: 60, step_increment: 1, page_increment: 5,
            }),
        });
        general.add(rotate);
        settings.bind('rotate-interval', rotate, 'value', Gio.SettingsBindFlags.DEFAULT);

        const colors = new Adw.PreferencesGroup({
            title: 'Change colors',
            description: 'Choose the colors used for rising and falling values.',
        });
        const colorSignalIds = [];
        const addColorRow = (title, key) => {
            const row = new Adw.ActionRow({title});
            const colorButton = new Gtk.ColorDialogButton({
                dialog: new Gtk.ColorDialog(),
                valign: Gtk.Align.CENTER,
            });
            let applyingSetting = false;
            const updateButton = () => {
                const rgba = new Gdk.RGBA();
                if (rgba.parse(settings.get_string(key))) {
                    applyingSetting = true;
                    colorButton.rgba = rgba;
                    applyingSetting = false;
                }
            };
            updateButton();
            colorButton.connect('notify::rgba', () => {
                if (!applyingSetting)
                    settings.set_string(key, colorButton.rgba.to_string());
            });
            colorSignalIds.push(settings.connect(`changed::${key}`, updateButton));
            row.add_suffix(colorButton);
            colors.add(row);
        };
        addColorRow('Rising value color', 'up-color');
        addColorRow('Falling value color', 'down-color');
        window.connect('close-request', () =>
            colorSignalIds.forEach(id => settings.disconnect(id)));

        page.add(posGroup);
        page.add(listGroup);
        page.add(addGroup);
        page.add(general);
        page.add(colors);
        window.add(page);
    }
}
