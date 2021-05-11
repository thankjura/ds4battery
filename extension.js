const St = imports.gi.St;
const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const ByteArray = imports.byteArray;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Util = imports.misc.util;

const ICON_PREFIX = "ds4-";
const ICON_SYMBOLIC = "-symbolic";
const DEVICE_PREFIX_DUALSHOCK = "sony_controller_battery_";
const DEVICE_PREFIX_DUALSENSE = "ps-controller-battery-";

const POWER_DIR_PATH = "/sys/class/power_supply";

let indicator;
let devices = {};
let powerDir;
let event;

function readFile(devName, fileName) {
    let filePath = GLib.build_filenamev([POWER_DIR_PATH, devName, fileName]);
    let file = Gio.File.new_for_path(filePath);
    debug(file);
    let out = file.load_contents(null);
    let value = out[1];
    if (value) {
        return ByteArray.toString(value).replace("\n", "");
    }

    return "";
}

function getLedRGBA(devName) {
    let ledDirPath = GLib.build_filenamev([POWER_DIR_PATH, devName, "device", "leds"]);
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
                ledInfo["blue"] = readFile(devName, "device/leds/" + info.get_name() + "/brightness");
            } else if (info.get_name().endsWith("red")) {
                ledInfo["red"] = readFile(devName, "device/leds/" + info.get_name() + "/brightness");
            } else if (info.get_name().endsWith("green")) {
                ledInfo["green"] = readFile(devName, "device/leds/" + info.get_name() + "/brightness");
            } if (info.get_name().endsWith("global")) {
                ledInfo["global"] = readFile(devName, "device/leds/" + info.get_name() + "/brightness");
            }
        }

        if (Object.keys(ledInfo).length === 4) {
            return "rgba(" + ledInfo.red + "," + ledInfo.green + "," + ledInfo.blue + "," + ledInfo.global + ")";
        }
    }
    return null;
}

function parseDeviceId(devName) {
    for (const prefix of [DEVICE_PREFIX_DUALSENSE, DEVICE_PREFIX_DUALSHOCK]) {
        if (devName.startsWith(prefix)) {
            return devName.substr(prefix.length);
        }
    }
    // should not happen since we only handle devices whose name start with the above prefixes
    throw "Cannot parse deviceId: " + devName;
}

function getDeviceInfo(devName) {
    let out = {};

    let status = readFile(devName, "status");
    let power = readFile(devName, "capacity");
    out["power"] = power ? power + "%" : "--";
    out["led"] = getLedRGBA(devName);
    out["deviceId"] = parseDeviceId(devName);
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

function disconnectDevice(devId) {
    let command = ['bluetoothctl', 'disconnect', devId];
    Util.spawn(command);
}

function updateDevice(devName) {
    let dev = devices[devName];
    let devInfo = getDeviceInfo(devName);

    if (!dev) {
        let icon = new St.Icon({
            style_class: 'system-status-icon'
        });
        icon.gicon = Gio.icon_new_for_string(`${Me.path}/icons/${devInfo.icon}.svg`);

        let label = new St.Label({
            y_align: Clutter.ActorAlign.CENTER,
            text: devInfo["power"],
            style_class: "power-label"
        });

        let button = new St.Button({
            style_class: "panel-button",
            reactive: true,
            track_hover: false,
            name: 'ds4Box:' + devName
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

        button.connect("clicked", () => disconnectDevice(devInfo["deviceId"]));
        indicator.add_actor(button);
        devices[devName] = dev;
    } else {
        dev.icon.gicon = Gio.icon_new_for_string(`${Me.path}/icons/${devInfo.icon}.svg`);
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

function deleteDevice(devName) {
    var dev = devices[devName];
    if (dev) {
        indicator.remove_actor(dev["button"]);
        dev["button"].destroy();
        delete devices[devName];
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
            let devName = info.get_name();
            if (devName.startsWith(DEVICE_PREFIX_DUALSHOCK) || devName.startsWith(DEVICE_PREFIX_DUALSENSE)) {
                updateDevice(devName);
                let idx = activeDevices.indexOf(devName);
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
