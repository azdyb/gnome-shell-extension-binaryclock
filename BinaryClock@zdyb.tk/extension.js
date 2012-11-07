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
// show the time label (11:23) in the date menu:
const TimePosition = {
    // * not at all?
    NONE: 0,
    // * above the date label ("Wednesday November 7, 2012")?
    ABOVE_DATE: 1,
    // * below the date label?
    BELOW_DATE: 2
};

////// CONFIGURE //////
// show the time label (11:23) in the date menu:
// * above the date label ("Wednesday November 7, 2012")?
// * below the date label?
// * not at all?
let timePosition = TimePosition.BELOW_DATE;

////// CODE //////

const Main = imports.ui.main;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Panel = imports.ui.panel;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Cairo = imports.cairo;
const Gio = imports.gi.Gio;


const UPDATE_INTERVAL = 1000;
// width of lines between the squares (px)
const LINE_WIDTH = 2;
// marging around the entire clock top & bottom (px)
const MARGIN = 1;
// padding square and the black centre
const PADDING = 2;

// compatibility GNOME 3.2, 3.4, 3.6
function _getDateMenu() {
    return Main.panel._dateMenu || Main.panel.statusArea.dateMenu;
}
function _getClockActor() {
    let dm = _getDateMenu();
    return dm._clockDisplay || dm._clock;
}
function insert_child_above(container, child, sibling) {
    if (container.insert_child_above) {
        container.insert_child_above(child, sibling);
    } else { // gnome 3.2
        container.add_actor(child);
        container.raise_child(child, sibling);
    }
}
function insert_child_below(container, child, sibling) {
    if (container.insert_child_below) {
        container.insert_child_below(child, sibling);
    } else { // gnome 3.2
        container.insert_child_at_index(child);
        container.lower_child(child, sibling);
    }
}

// -------------------------------
function BinaryClock() {
    this._init();
}

BinaryClock.prototype = {
    _init: function () {
        this.display_time = [-1, -1];
        //this.time_format = "%R:%S"; // Safe fallback

        this.date_menu = _getDateMenu();
        this.orig_clock = _getClockActor();
        this.binary_clock = new St.DrawingArea();

        // Box size. Should be *even* and integer but still fit vertically.
        this.bs = Math.floor((Panel.PANEL_ICON_SIZE - 2 * MARGIN - LINE_WIDTH) / 2);
        if (this.bs % 2) {
            this.bs -= 1;
        }
        let height = 2 * this.bs + LINE_WIDTH;
        this.binary_clock.set_width(6 * this.bs + 5 * LINE_WIDTH);
        this.binary_clock.set_height(height);

        this.repaint = this.binary_clock.connect("repaint",
            Lang.bind(this, this.paint_clock));
    },

    Run: function () {
        this.run = true;
        this.on_timeout();
        Mainloop.timeout_add(UPDATE_INTERVAL, Lang.bind(this, this.on_timeout));
    },

    on_timeout: function () {
        let now = new Date();
        //this.time_label.set_text(now.toLocaleFormat(this.time_format))
        let display_time = [now.getHours(), now.getMinutes()];

        if ((this.display_time[0] !== display_time[0]) ||
                (this.display_time[1] !== display_time[1])) {
            this.display_time = display_time;
            this.binary_clock.queue_repaint();
        }

        return true;
    },

    // to avoid fuzziness in cairo. If the line width is even you have to start
    // drawing on integer coordinates, otherwise on integer + 0.5 coordinates.
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
        cr.setSourceRGBA(0, 0, 0, 0);
        cr.setOperator(Cairo.Operator.CLEAR);
        // ensure no fuzziness
        let halfHeight = Math.floor(area_height / 2) + (LINE_WIDTH % 2 ? 0.5 : 0);
        cr.moveTo(0, halfHeight);
        cr.lineTo(area_width, halfHeight);
        cr.stroke();

        // Draw dots (precache some stuff)
        let dim = this.bs - 2 * LINE_WIDTH, // dimension of internal box
            halfLineWidth = LINE_WIDTH / 2,
            blockWidth = this.bs + LINE_WIDTH;
        for (let p = 0; p < this.display_time.length; ++p) {
            for (let i = 0; i < 6; ++i) {
                let startx = i * blockWidth;
                let borderx = startx + this.bs + halfLineWidth; // FOR SURE

                // draw the border
                cr.moveTo(borderx, 0);
                cr.lineTo(borderx, area_height);
                cr.stroke();

                // draw the rectangle.
                if ((this.display_time[p] & (1 << (5 - i)))) {
                    cr.rectangle(
                        startx + PADDING,
                        p * blockWidth + PADDING,
                        dim,
                        dim
                    );
                    cr.fill();
                }
            }
        }

    },

    getShowDate: function () {
        if (this.date_menu._clock.time_only !== undefined) {
            return !this.date_menu._clock.time_only;
        } else {
            return this.date_menu._clockSettings.get_boolean('show-date');
        }
    },

    toggleShowDate: function (state) {
        if (this.getShowDate() === state) {
            return;
        }
        if (this.date_menu._clock.time_only !== undefined) {
            this.date_menu._clock.time_only = !state;
        } else {
            this.date_menu._clockSettings.set_boolean('show-date', state);

        }
    },

    enable: function () {
        this.date_menu.actor.remove_actor(this.orig_clock);
        this.date_menu.actor.add_actor(this.binary_clock);
        this.date_menu.actor.add_style_class_name("binary-clock");

        this.binary_clock.queue_repaint();

        // show the time label in the date menu (or no at all)
        this._originalShowDate = this.getShowDate();
        if (timePosition !== TimePosition.NONE) {
            this.toggleShowDate(false);
            this.orig_clock.add_style_class_name('datemenu-date-label');
            let children = this.date_menu.menu.box.get_children();
            for (let i = 0; i < children.length; ++i) {
                let c = children[i];
                if (c.name === "calendarArea") {
                    let vbox = c.get_children()[0];
                    if (timePosition === TimePosition.BELOW_DATE) {
                        // note - since the box layout packs vertically downwards
                        // to get the label visually below _date we insert_child_above.
                        insert_child_above(vbox, this.orig_clock, this.date_menu._date);
                    } else {
                        insert_child_below(vbox, this.orig_clock, this.date_menu._date);
                    }
                    vbox.child_set(this.orig_clock, {x_align: St.Align.MIDDLE, x_fill: false});
                    break;
                }
            }
            this.Run();
        }
    },

    disable: function () {
        this.run = false;
        this.date_menu.actor.remove_style_class_name("binary-clock");
        this.date_menu.actor.remove_actor(this.binary_clock);

        this.toggleShowDate(this._originalShowDate);
        this.orig_clock.reparent(this.date_menu.actor);
        this.orig_clock.remove_style_class_name('datemenu-date-label');
    }
};

function init() {
    return new BinaryClock();
}
