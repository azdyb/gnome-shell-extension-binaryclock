/*
 * Copyright 2011 Aleksander Zdyb
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
 
const Main = imports.ui.main;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Panel = imports.ui.panel;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Cairo = imports.cairo;
const Gio = imports.gi.Gio;


const ERROR_LABEL = "---";
const UPDATE_INTERVAL = 500;
const LINE_WIDTH = 2;
const MARGIN = 1;


// in org.gnome.desktop.interface
const CLOCK_FORMAT_KEY        = 'clock-format';
// in org.gnome.shell.clock
const CLOCK_SHOW_SECONDS_KEY  = 'show-seconds';


function BinaryClock() {
    this._init();
}

BinaryClock.prototype = {
    _init: function() {
        this.display_time = [-1, -1];
        this.time_format = "%R:%S"; // Safe fallback
        
        this.date_menu = Main.panel._dateMenu;
        this.orig_clock = this.date_menu._clock;
        this.binary_clock = new St.DrawingArea();
        this.time_label = new St.Label({ style_class: "datemenu-date-label", text: ERROR_LABEL});
        
        this.bs = Math.floor(Panel.PANEL_ICON_SIZE - 2*MARGIN - LINE_WIDTH)/2;  // Box size
        this.binary_clock.set_width(6*this.bs + 5*LINE_WIDTH);
        this.binary_clock.set_height(Panel.PANEL_ICON_SIZE-2*MARGIN);
        
        
        this.desktop_settings = new Gio.Settings({ schema: "org.gnome.desktop.interface" });
        this.clock_settings = new Gio.Settings({ schema: "org.gnome.shell.clock" });
        this.desktop_settings.connect("changed", Lang.bind(this, this.update_format));
        this.clock_settings.connect("changed", Lang.bind(this, this.update_format));
        this.update_format();
        
        this.repaint = this.binary_clock.connect("repaint", Lang.bind(this, this.paint_clock));
    },
    
    Run: function() {
        this.run = true;
        this.on_timeout();
        Mainloop.timeout_add(UPDATE_INTERVAL, Lang.bind(this, this.on_timeout));  
    },
    
    update_format: function() {
        let clock_format = this.desktop_settings.get_string(CLOCK_FORMAT_KEY);
        let show_seconds = this.clock_settings.get_boolean(CLOCK_SHOW_SECONDS_KEY);
        
        if (clock_format == "24h") this.time_format = "%R";
        else this.time_format = "%l:%M";
        
        if (show_seconds) this.time_format += ":%S";
        
        if (clock_format != "24h") this.time_format += " %p";
    },
    
    on_timeout: function() {
        let now = new Date();
        this.time_label.set_text(now.toLocaleFormat(this.time_format))
        let display_time = [now.getHours(), now.getMinutes()];
        
        if ((this.display_time[0] != display_time[0]) || (this.display_time[1] != display_time[1])) {
            this.display_time = display_time;
            this.binary_clock.queue_repaint();
        }
        
        return true;
    },
    
    paint_clock: function (area) {
        let cr = area.get_context();
        let theme_node = this.binary_clock.get_theme_node();
        
        let area_height = area.get_height();
        let area_width = area.get_width();
        
        // Draw background
        Clutter.cairo_set_source_color(cr, theme_node.get_foreground_color());
        cr.setLineWidth(LINE_WIDTH);
        cr.rectangle(0, 0, area_width, area_height);
        cr.fill();
        
        // Draw grid
        cr.setOperator(Cairo.Operator.CLEAR);
        cr.moveTo(0, area_height/2);
        cr.lineTo(area_width, area_height/2);
        cr.stroke();
        
        // Draw dots
        for (let p in this.display_time) {
            for (let i=0; i<6; ++i) {
                cr.moveTo((i+1)*(this.bs + LINE_WIDTH/2) + i*(LINE_WIDTH/2), 0);
                cr.lineTo((i+1)*(this.bs + LINE_WIDTH/2) + i*(LINE_WIDTH/2), area_height)
                cr.stroke();    
                if ((this.display_time[p] & (1 << (5-i)))) {
                    cr.rectangle(LINE_WIDTH + (this.bs + LINE_WIDTH)*i, LINE_WIDTH + (this.bs + LINE_WIDTH)*p, this.bs-2*LINE_WIDTH, this.bs-2*LINE_WIDTH);
                    cr.fill();
                }
            }
        }
        
    },
    
    enable: function() {
        this.date_menu.actor.remove_actor(this.orig_clock);
        this.date_menu.actor.add_actor(this.binary_clock);
        this.date_menu.actor.add_style_class_name("binary-clock");
        
        this.binary_clock.queue_repaint();
        
        let children = this.date_menu.menu.box.get_children();
        for each(let c in children) {
            if(c.name == "calendarArea") {
                c.get_children()[0].insert_actor(this.time_label, 0);
                break;
            }
        }
        this.Run();
    },
    
    disable: function() {
        this.run = false;
        this.date_menu.actor.remove_style_class_name("binary-clock");
        this.date_menu.actor.remove_actor(this.binary_clock);
        this.date_menu.actor.add_actor(this.orig_clock);
        
        let children = this.date_menu.menu.box.get_children();
        for each(let c in children) {
            if(c.name == "calendarArea") {
                c.get_children()[0].remove_actor(this.time_label);
                break;
            }
        }
    }
}

function init() {
    return new BinaryClock();
}
