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
 
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const PanelMenu = imports.ui.panelMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter; 


const UPDATE_INTERVAL = 500;
const LINE_WIDTH = 2;
const MARGIN = 1;

function BinaryClock() {
    this._init();
}

BinaryClock.prototype = {
    _init: function() {
        let now = new Date();
        this.display_time = [now.getHours(), now.getMinutes()];
        
        let date_menu = Main.panel._dateMenu;
        this._clock = date_menu._clock;
        this.binary_clock = new St.DrawingArea();
        this.date = new St.Label({ style_class: "datemenu-date-label", text: this._clock.get_text() });
        
        this.bs = Math.floor(Main.panel.button.height/2)-2*MARGIN;  // Box size
        
        this.binary_clock.set_width(MARGIN*2 + (this.bs + MARGIN + LINE_WIDTH)*6);
        this.binary_clock.set_height(Main.panel.button.height);
        date_menu.actor.add_actor(this.binary_clock);
        
        this.binary_clock.connect("repaint", Lang.bind(this, this.paint_clock));
        this.binary_clock.queue_repaint();
        
        let children = date_menu.menu.box.get_children();
        for each(let c in children) {
            if(c.name == "calendarArea") {
                c.get_children()[0].insert_actor(this.date, 0);
                break;
            }
        }
    },
    
    Run: function() {
        Mainloop.timeout_add(UPDATE_INTERVAL, Lang.bind(this, this.on_timeout));  
    },
    
    on_timeout: function() {
        this.date.set_text(this._clock.get_text());
        
        let now = new Date();
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
        
        Clutter.cairo_set_source_color(cr, theme_node.get_foreground_color());
        for (let p in cr) global.log(p);
        cr.setLineWidth(LINE_WIDTH);
                
        for (let p in this.display_time) {
            for (let i=0; i<6; ++i) {
                cr.rectangle(MARGIN + LINE_WIDTH/2 + (this.bs + MARGIN + LINE_WIDTH)*i, LINE_WIDTH/2 + (this.bs + MARGIN + LINE_WIDTH)*p, this.bs, this.bs);
                cr.stroke();
                if (!(this.display_time[p] & (1 << (5-i)))) {
                    cr.rectangle(MARGIN + LINE_WIDTH/2 + (this.bs + MARGIN + LINE_WIDTH)*i, + LINE_WIDTH/2 + (this.bs + MARGIN + LINE_WIDTH)*p, this.bs, this.bs);
                    cr.fill();
                }
            }
        }
    }
}

function main() {
   (new BinaryClock()).Run();
}
