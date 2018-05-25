const St = imports.gi.St;
const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;

const ICON_PREFIX = "ds4-";
const ICON_SYMBOLIC = "-symbolic";

const DS4Battery = new Lang.Class({
    Name: "DualShock 4 Power",
    Extends: PanelMenu.Button,

    _init: function() {
        PanelMenu.Button.prototype._init.call(this, 0, 'ds4battery');

        this._icon = new St.Icon({
            icon_name: ICON_PREFIX + "default" + ICON_SYMBOLIC,
            style_class: 'system-status-icon',

        });

        this.statusLabel = new St.Label({
            y_align: Clutter.ActorAlign.CENTER,
            text: "--",
            style_class: "power-label"
        });

        this._destroy();

        let box = new St.BoxLayout({ name: 'ds4Box' , vertical: false });
        box.add_actor(this._icon);
		box.add_actor(this.statusLabel);
		this.actor.add_actor(box);

        if(!this.sensorsPath) {
            this.title='Warning';
            this.content='Please install UPower';
        } 

        this._updateStatus();
        event = GLib.timeout_add_seconds(0, 5, Lang.bind(this, function () {
            this._updateStatus();
            return true;
        }));
    },

    _destroy: function() {
        this.menu.box.get_children().forEach(function(c) {
            c.destroy();
        });
    },

    _updateStatus: function() {        
        let powerDir = Gio.File.new_for_path("/sys/class/power_supply");

        let fileEnum;
        try {
            fileEnum = powerDir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
        } catch (e) {
            fileEnum = null;
        }

        if (fileEnum != null) {
            let info;
            while ((info = fileEnum.next_file(null))) {
                if (info.get_name().startsWith("sony_controller_battery_")) {
                    let powerPath = GLib.build_filenamev([powerDir.get_path(), info.get_name(), "capacity"]);
                    let statusPath = GLib.build_filenamev([powerDir.get_path(), info.get_name(), "status"]);
                    let powerFile = Gio.File.new_for_path(powerPath);
                    let statusFile = Gio.File.new_for_path(statusPath);
                    let powerValue = GLib.spawn_command_line_sync("cat " + powerFile.get_path());
                    let statusValue = GLib.spawn_command_line_sync("cat " + statusFile.get_path());
                    let power = powerValue[1].toString().replace("\n", "");
                    
                    this.statusLabel.set_text(power + "%");
                    
                    if (statusValue[1].toString().indexOf("Charging") > -1) {
                        this._icon.icon_name = ICON_PREFIX + "charging" + ICON_SYMBOLIC;
                    } else {
                        if (power < 10) {
                            this._icon.icon_name = ICON_PREFIX + "00" + ICON_SYMBOLIC;
                        } else if (power < 20) {
                            this._icon.icon_name = ICON_PREFIX + "10" + ICON_SYMBOLIC;
                        } else if (power < 30) {
                            this._icon.icon_name = ICON_PREFIX + "20" + ICON_SYMBOLIC;
                        } else if (power < 40) {
                            this._icon.icon_name = ICON_PREFIX + "30" + ICON_SYMBOLIC;
                        } else if (power < 50) {
                            this._icon.icon_name = ICON_PREFIX + "40" + ICON_SYMBOLIC;
                        } else if (power < 60) {
                            this._icon.icon_name = ICON_PREFIX + "50" + ICON_SYMBOLIC;
                        } else if (power < 70) {
                            this._icon.icon_name = ICON_PREFIX + "60" + ICON_SYMBOLIC;
                        } else if (power < 80) {
                            this._icon.icon_name = ICON_PREFIX + "70" + ICON_SYMBOLIC;
                        } else if (power < 90) {
                            this._icon.icon_name = ICON_PREFIX + "80" + ICON_SYMBOLIC;
                        } else if (power < 100) {
                            this._icon.icon_name = ICON_PREFIX + "90" + ICON_SYMBOLIC;
                        } else {
                            this._icon.icon_name = ICON_PREFIX + "default" + ICON_SYMBOLIC;
                        }
                    }
                    
                    this.actor.show();
                    return;
                }
            }
        }

        
        this.actor.hide();
    },
});

// for debugging
function debug(a) {
    a = "ds4: " + a;
    global.log(a);
}

function init(extensionMeta) {
    let theme = imports.gi.Gtk.IconTheme.get_default();
    theme.append_search_path(extensionMeta.path + "/icons");
}

let indicator;
let event=null;

function enable() {
    indicator = new DS4Battery();
    Main.panel.addToStatusArea('ds4battery', indicator);
}

function disable() {
    indicator.destroy();
    Mainloop.source_remove(event);
    indicator = null;
}
