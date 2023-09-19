import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const ICON_PREFIX = "ds4-";
const ICON_SYMBOLIC = "-symbolic";
const DEVICE_PREFIX_DUALSHOCK = "sony_controller_battery_";
const DEVICE_PREFIX_DUALSENSE = "ps-controller-battery-";

const POWER_DIR_PATH = "/sys/class/power_supply";

const debug = (msg) => {
    msg = "ds4ext: " + msg;
    console.log(msg);
}

const readFile = (devName, fileName) => {
    const filePath = GLib.build_filenamev([POWER_DIR_PATH, devName, fileName]);
    return Shell.get_file_contents_utf8_sync(filePath);
}

const readNumFile = (devName, fileName) => {
    const val = readFile(devName, fileName);
    if (val) {
        return parseInt(val);
    }

    return 0;
}

const getLedRGBA = (devName) => {
    const ledDirPath = GLib.build_filenamev([POWER_DIR_PATH, devName, "device", "leds"]);
    const ledDir = Gio.File.new_for_path(ledDirPath);
    let fileEnum;
    try {
        fileEnum = ledDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    } catch (e) {
        fileEnum = null;
    }
    if (fileEnum) {
        let info;
        const ledInfo = {};
        while ((info = fileEnum.next_file(null))) {
            if (info.get_name().endsWith("blue")) {
                ledInfo["blue"] = readNumFile(devName, "device/leds/" + info.get_name() + "/brightness");
            } else if (info.get_name().endsWith("red")) {
                ledInfo["red"] = readNumFile(devName, "device/leds/" + info.get_name() + "/brightness");
            } else if (info.get_name().endsWith("green")) {
                ledInfo["green"] = readNumFile(devName, "device/leds/" + info.get_name() + "/brightness");
            } if (info.get_name().endsWith("global")) {
                ledInfo["global"] = readNumFile(devName, "device/leds/" + info.get_name() + "/brightness");
            }
        }

        if (Object.keys(ledInfo).length === 4) {
            return "rgba(" + ledInfo.red + "," + ledInfo.green + "," + ledInfo.blue + "," + ledInfo.global + ")";
        }
    }
    return null;
}

const getDeviceInfo = (devName) => {
    const out = {};

    const state = readFile(devName, "status");
    const power = readNumFile(devName, "capacity");
    out["power"] = power ? power + "%" : "--";
    out["led"] = getLedRGBA(devName);
    if (state && state.trim() !== "Discharging") {
        debug("diss");
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
}


export default class DS4Battery extends Extension {
    enable() {
        this._devices = {};
        this._powerDir = Gio.File.new_for_path(POWER_DIR_PATH);
        this._indicator = new St.BoxLayout({name: 'ds4Box', vertical: false});
        Main.panel._rightBox.insert_child_at_index(this._indicator, 0);
        this._indicator.hide();
        this._updateDevices();
        this._event_id = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            5, 
            () => {
                this._updateDevices();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    disable() {
        this._powerDir = null;
        Main.panel._rightBox.remove_child(this._indicator);
        this._indicator = null;
        GLib.source_remove(this._event_id);
        this._event_id = null;
        this._devices = {};
    }

    _updateDevice(devName) {
        let dev = this._devices[devName];
        const devInfo = getDeviceInfo(devName);

        if (!dev) {
            const icon = new St.Icon({
                style_class: 'system-status-icon'
            });
            icon.gicon = Gio.icon_new_for_string(`${this.path}/icons/${devInfo.icon}.svg`);
            debug(`${this.path}/icons/${devInfo.icon}.svg`);

            const label = new St.Label({
                y_align: Clutter.ActorAlign.CENTER,
                text: devInfo["power"],
                style_class: "power-label"
            });

            const button = new St.Button({
                style_class: "panel-button",
                reactive: false,
                track_hover: false,
                name: 'ds4Box:' + devName
            });

            const buttonLayout = new St.BoxLayout({
                vertical: false
            });

            button.add_actor(buttonLayout);

            dev = {
                icon: icon,
                label: label,
                layout: buttonLayout,
                button: button
            };

            if (devInfo["led"]) {
                buttonLayout.style_class = "ds4-underline";
                buttonLayout.set_style("border-color: " + devInfo["led"]);
            }

            buttonLayout.add_child(dev.icon);
            buttonLayout.add_child(dev.label);

            this._indicator.add_actor(button);
            this._devices[devName] = dev;
        } else {
            dev.icon.gicon = Gio.icon_new_for_string(`${this.path}/icons/${devInfo.icon}.svg`);
            dev.label.text = devInfo["power"];

            if (devInfo["led"]) {
                dev.layout.style_class = "ds4-underline";
                dev.layout.set_style("border-color: " + devInfo["led"]);
            } else {
                dev.layout.style_class = "";
                dev.layout.set_style("");
            }
        }
    }

    _deleteDevice(devName) {
        const dev = this._devices[devName];
        if (dev) {
            this._indicator.remove_actor(dev["button"]);
            dev["button"].destroy();
            delete this._devices[devName];
        }
    }

    _updateDevices() {
        let fileEnum;
        try {
            fileEnum = this._powerDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        } catch (e) {
            fileEnum = null;
        }
        const activeDevices = Object.keys(this._devices);
        if (fileEnum != null) {
            let info;
            while ((info = fileEnum.next_file(null))) {
                const devName = info.get_name();
                if (devName.startsWith(DEVICE_PREFIX_DUALSHOCK) || devName.startsWith(DEVICE_PREFIX_DUALSENSE)) {
                    this._updateDevice(devName);
                    const idx = activeDevices.indexOf(devName);
                    if (idx > -1) {
                        activeDevices.splice(idx, 1);
                    }
                }
            }

            for (var i = 0; i < activeDevices.length; i++) {
                this._deleteDevice(activeDevices[i]);
            }
        }

        if (Object.keys(this._devices).length !== 0) {
            this._indicator.show();
        } else {
            this._indicator.hide();
        }
    }
}
