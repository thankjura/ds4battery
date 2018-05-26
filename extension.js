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
const DEVICE_PREFIX = "sony_controller_battery_";

const DS4Battery = new Lang.Class({
    Name: "DualShock 4 Power",
    Extends: PanelMenu.Button,

    _devices: {},

    _readFile: function(deviceId, fileName) {
        let filePath = GLib.build_filenamev([this._powerDir.get_path(), DEVICE_PREFIX + deviceId, fileName]);
        let file = Gio.File.new_for_path(filePath);
        let out = file.load_contents(null);
        let value = out[1];
        if (value) {
            return value.toString().replace("\n", "");
        }

        return "";
    },

    _getDeviceInfo: function(deviceId) {
        let out = {};

        let status = this._readFile(deviceId, "status");
        let power = this._readFile(deviceId, "capacity");
        out["power"] = power ? power + "%" : "--";
        if (status !== "Discharging") {
            out["icon"] = ICON_PREFIX + "charging" + ICON_SYMBOLIC;
        } else {
            if (power < 10) {
                out["icon"] = ICON_PREFIX + "00" + ICON_SYMBOLIC;
            } else if (power < 20) {
                out["icon"] = ICON_PREFIX + "10" + ICON_SYMBOLIC;
            } else if (power < 30) {
                out["icon"] = ICON_PREFIX + "20" + ICON_SYMBOLIC;
            } else if (power < 40) {
                out["icon"] = ICON_PREFIX + "30" + ICON_SYMBOLIC;
            } else if (power < 50) {
                out["icon"] = ICON_PREFIX + "40" + ICON_SYMBOLIC;
            } else if (power < 60) {
                out["icon"] = ICON_PREFIX + "50" + ICON_SYMBOLIC;
            } else if (power < 70) {
                out["icon"] = ICON_PREFIX + "60" + ICON_SYMBOLIC;
            } else if (power < 80) {
                out["icon"] = ICON_PREFIX + "70" + ICON_SYMBOLIC;
            } else if (power < 90) {
                out["icon"] = ICON_PREFIX + "80" + ICON_SYMBOLIC;
            } else if (power < 100) {
                out["icon"] = ICON_PREFIX + "90" + ICON_SYMBOLIC;
            } else {
                out["icon"] = ICON_PREFIX + "default" + ICON_SYMBOLIC;
            }
        }

        return out;
    },

    _setBox: function(deviceId) {
        var box = this._devices[deviceId];
        let devInfo = this._getDeviceInfo(deviceId);

        if (!box) {
            let icon = new St.Icon({
                icon_name: devInfo["icon"],
                style_class: 'system-status-icon'
            });

            let label = new St.Label({
                y_align: Clutter.ActorAlign.CENTER,
                text: devInfo["power"],
                style_class: "power-label"
            });
            box = {
                icon: icon,
                label: label
            };
            var layout = new St.BoxLayout({ name: 'ds4Box:' + deviceId , vertical: false });
            layout.add_actor(box.icon);
            layout.add_actor(box.label);
            box["layout"] = layout;
            this.actor.add_actor(layout);
            this._devices[deviceId] = box;
        } else {
            box.icon.icon_name = devInfo["icon"];
            box.label.text = devInfo["power"];
        }
        return box;
    },

    _delBox: function(deviceId) {
        var box = this._devices[deviceId];
        if (box) {
            box["layout"].destroy();
            delete this._devices[deviceId];
        }
    },

    _init: function() {
        PanelMenu.Button.prototype._init.call(this, 0, 'ds4battery');

        this._powerDir = Gio.File.new_for_path("/sys/class/power_supply");

        this._updateBoxes();
        event = GLib.timeout_add_seconds(0, 5, Lang.bind(this, function() {
            this._updateBoxes();
            return true;
        }));
    },

    _destroy: function() {
        this.menu.box.get_children().forEach(function(c) {
            c.destroy();
        });
    },

    _updateBoxes: function() {
        let fileEnum;
        try {
            fileEnum = this._powerDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        } catch (e) {
            fileEnum = null;
        }
        let activeDevices = Object.keys(this._devices);
        if (fileEnum != null) {
            let info;
            while ((info = fileEnum.next_file(null))) {
                if (info.get_name().startsWith(DEVICE_PREFIX)) {
                    let deviceId = info.get_name().split(DEVICE_PREFIX)[1];
                    this._setBox(deviceId);
                    let idx = activeDevices.indexOf(deviceId);
                    if (idx > -1) {
                        activeDevices.splice(idx, 1);
                    }
                }
            }

            for (var i = 0; i < activeDevices.length; i++) {
                this._delBox(activeDevices[i]);
            }

            if (Object.keys(this._devices).length !== 0) {
                this.actor.show();
                return;
            }
        }

        
        this.actor.hide();
    },
});

// for debugging
function debug(a) {
    a = "ds4ext: " + a;
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
