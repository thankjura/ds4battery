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

//const POWER_DIR_PATH = "/sys/class/power_supply";
const POWER_DIR_PATH = "/tmp/power_test";

let indicator;
let devices = {};
let powerDir;
let event;

function readFile(deviceId, fileName) {
    let filePath = GLib.build_filenamev([POWER_DIR_PATH, DEVICE_PREFIX + deviceId, fileName]);
    let file = Gio.File.new_for_path(filePath);
    let out = file.load_contents(null);
    let value = out[1];
    if (value) {
        return value.toString().replace("\n", "");
    }

    return "";
}

function getLedRGBA(deviceId) {
    let ledDirPath = GLib.build_filenamev([POWER_DIR_PATH, DEVICE_PREFIX + deviceId, "device", "leds"]);
    let ledDir = Gio.File.new_for_path(ledDirPath);
    let fileEnum;
    try {
        fileEnum = ledDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    } catch (e) {
        fileEnum = null;
    }
    if (fileEnum) {
        let info;
        let ledInfo = {};
        while ((info = fileEnum.next_file(null))) {
            if (info.get_name().endsWith("blue")) {
                ledInfo["blue"] = readFile(deviceId, "device/leds/" + info.get_name() + "/brightness");
            } else if (info.get_name().endsWith("red")) {
                ledInfo["red"] = readFile(deviceId, "device/leds/" + info.get_name() + "/brightness");
            } else if (info.get_name().endsWith("green")) {
                ledInfo["green"] = readFile(deviceId, "device/leds/" + info.get_name() + "/brightness");
            } if (info.get_name().endsWith("global")) {
                ledInfo["global"] = readFile(deviceId, "device/leds/" + info.get_name() + "/brightness");
            }
        }

        if (Object.keys(ledInfo).length === 4) {
            return "rgba(" + ledInfo.red + "," + ledInfo.green + "," + ledInfo.blue + "," + ledInfo.global + ")";
        }
    }
    return null;
}

function getDeviceInfo(deviceId) {
    let out = {};

    let status = readFile(deviceId, "status");
    let power = readFile(deviceId, "capacity");
    out["power"] = power ? power + "%" : "--";
    out["led"] = getLedRGBA(deviceId);
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
}

function updateDevice(deviceId) {
    let dev = devices[deviceId];
    let devInfo = getDeviceInfo(deviceId);

    if (!dev) {
        let icon = new St.Icon({
            icon_name: devInfo["icon"],
            style_class: 'system-status-icon'
        });

        let label = new St.Label({
            y_align: Clutter.ActorAlign.CENTER,
            text: devInfo["power"],
            style_class: "power-label"
        });

        let button = new St.Button({
            style_class: "panel-button",
            reactive: false,
            track_hover: false,
            name: 'ds4Box:' + deviceId
        });

        let buttonLayout = new St.BoxLayout({
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

        indicator.add_actor(button);
        devices[deviceId] = dev;
    } else {
        dev.icon.icon_name = devInfo["icon"];
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

function deleteDevice(deviceId) {
    var dev = devices[deviceId];
    if (dev) {
        indicator.remove_actor(dev["button"]);
        dev["button"].destroy();
        delete devices[deviceId];
    }
}

function updateDevices() {
    let fileEnum;
    try {
        fileEnum = powerDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    } catch (e) {
        fileEnum = null;
    }
    let activeDevices = Object.keys(devices);
    if (fileEnum != null) {
        let info;
        while ((info = fileEnum.next_file(null))) {
            if (info.get_name().startsWith(DEVICE_PREFIX)) {
                let deviceId = info.get_name().split(DEVICE_PREFIX)[1];
                updateDevice(deviceId);
                let idx = activeDevices.indexOf(deviceId);
                if (idx > -1) {
                    activeDevices.splice(idx, 1);
                }
            }
        }

        for (var i = 0; i < activeDevices.length; i++) {
            deleteDevice(activeDevices[i]);
        }
    }

    if (Object.keys(devices).length !== 0) {
        indicator.show();
    } else {
        indicator.hide();
    }
}


function debug(a) {
    a = "ds4ext: " + a;
    global.log(a);
}

function init(extensionMeta) {
    let theme = imports.gi.Gtk.IconTheme.get_default();
    theme.append_search_path(extensionMeta.path + "/icons");
}

function enable() {
    powerDir = Gio.File.new_for_path(POWER_DIR_PATH);
    indicator = new St.BoxLayout({name: 'ds4Box', vertical: false});
    Main.panel._rightBox.insert_child_at_index(indicator, 0);
    indicator.hide();
    updateDevices();
    event = GLib.timeout_add_seconds(0, 5, function() {
        updateDevices();
        return true;
    });
}

function disable() {
    powerDir = null;
    Main.panel._rightBox.remove_child(indicator);
    indicator = null;
    Mainloop.source_remove(event);
    event = null;
    devices = {};
}