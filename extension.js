const St = imports.gi.St;
const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Clutter = imports.gi.Clutter;

function DS4Battery() {
    this._init.apply(this, arguments);
}

DS4Battery.prototype = {
    __proto__: PanelMenu.Button.prototype,

    _init: function(){
        PanelMenu.Button.prototype._init.call(this, 0, 'ds4battery');

        // Set Logo
        var theme = imports.gi.Gtk.IconTheme.get_default();
        let icon_dir = Extension.dir.get_child('icons');
        theme.append_search_path(icon_dir.get_path());
        this._logo = new St.Icon({ icon_name: 'ds4', style_class: 'system-status-icon'});

        this.lang = {
            'ds4' : 'Dual Shock 4 power'
        };
        this.statusLabel = new St.Label({
            y_align: Clutter.ActorAlign.CENTER,
            text: "--",
            style_class: "power-label"
        });

        this._destroy();

        let box = new St.BoxLayout({ name: 'ds4Box' });
        this.actor.add_actor(box);
        box.add_actor(this._logo);
        box.add_actor(this.statusLabel);

        this.upowerPath = this._detectUpower();
        this.devicePath = this._detectDevice();
        this.command=["xdg-open", "http://slie.ru/"];
        if(!this.sensorsPath) {
            this.title='Warning';
            this.content='Please install UPower';
        } 

        this._updatePower();
        event = GLib.timeout_add_seconds(0, 15, Lang.bind(this, function () {
            this._updatePower();
            return true;
        }));
    },

    _destroy: function() {
        this.menu.box.get_children().forEach(function(c) {
            c.destroy();
        }
    }

    _detectUpower: function() {
        // detect upower
        let ret = GLib.find_program_in_path("upower");
        return ret; // path to upower
    },

    _detectDevice: function() {        
        if (this.upowerPath) {
            let upowerOutput = GLib.spawn_command_line_sync(this.upowerPath + " -e|grep sony_controller_battery");
            if (upowerOutput) {
                return upowerOutput[0];
            }
        } 
        return false;
    },

    _updatePower: function() {
        let items = new Array();
        let powerInfo = null;
        if (this.upowerPath) {
            if (!this.devicePath) {
                this._detectDevice();
            }

            if (this.devicePath) {
                let upowerOutput = GLib.spawn_command_line_sync(this.sensorsPath + " -i " + this.devicePath + " | grep percentage");
                if (upowerOutput) {
                    this._destroy();
                    this.title = upowerOutput.replace(/[\D]+/, "");
                }
            }
        }
        
        this._destroy();
        
        let section = new PopupMenu.PopupMenuSection("");
        let item = new PopupMenu.PopupMenuItem("", { reactive: false });
        item.actor.add_child(new St.Label({
                    text: "test",
                    style_class: "sm-label"
        }));
        section.addMenuItem(item);
        this.menu.addMenuItem(section);
    },

    _getContent: function(c){
        return c.toString();
    },

}

// for debugging
function debug(a){
    global.log(a);
    Util.spawn(['echo',a]);
}

function init() {
// do nothing
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
