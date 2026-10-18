// Avoid `console` errors in browsers that lack a console.
(function() {
    var method;
    var noop = function () {};
    var methods = [
        'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
        'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
        'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
        'timeline', 'timelineEnd', 'timeStamp', 'trace', 'warn'
    ];
    var length = methods.length;
    var console = (window.console = window.console || {});

    while (length--) {
        method = methods[length];

        // Only stub undefined methods.
        if (!console[method]) {
            console[method] = noop;
        }
    }
}());

// Place any jQuery/helper plugins in here.




/**
 * TimeCircles.js
 * Basic structure: TC_Class is the public class that is returned upon being called
 * 
 * So, if you do
 *      var tc = $(".timer").TimeCircles();
 *      
 * tc will contain an instance of the public TimeCircles class. It is important to
 * note that TimeCircles is not chained in the conventional way, check the
 * documentation for more info on how TimeCircles can be chained.
 * 
 * After being called/created, the public TimerCircles class will then- for each element
 * within it's collection, either fetch or create an instance of the private class.
 * Each function called upon the public class will be forwarded to each instance
 * of the private classes within the relevant element collection
 **/
(function($) {

    var useWindow = window;
    
    // From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
    if (!Object.keys) {
        Object.keys = (function() {
            'use strict';
            var hasOwnProperty = Object.prototype.hasOwnProperty,
                    hasDontEnumBug = !({toString: null}).propertyIsEnumerable('toString'),
                    dontEnums = [
                        'toString',
                        'toLocaleString',
                        'valueOf',
                        'hasOwnProperty',
                        'isPrototypeOf',
                        'propertyIsEnumerable',
                        'constructor'
                    ],
                    dontEnumsLength = dontEnums.length;

            return function(obj) {
                if (typeof obj !== 'object' && (typeof obj !== 'function' || obj === null)) {
                    throw new TypeError('Object.keys called on non-object');
                }

                var result = [], prop, i;

                for (prop in obj) {
                    if (hasOwnProperty.call(obj, prop)) {
                        result.push(prop);
                    }
                }

                if (hasDontEnumBug) {
                    for (i = 0; i < dontEnumsLength; i++) {
                        if (hasOwnProperty.call(obj, dontEnums[i])) {
                            result.push(dontEnums[i]);
                        }
                    }
                }
                return result;
            };
        }());
    }
    
    // Used to disable some features on IE8
    var limited_mode = false;
    var tick_duration = 200; // in ms
    
    var debug = (location.hash === "#debug");
    function debug_log(msg) {
        if (debug) {
            console.log(msg);
        }
    }

    var allUnits = ["Days", "Hours", "Minutes", "Seconds"];
    var nextUnits = {
        Seconds: "Minutes",
        Minutes: "Hours",
        Hours: "Days",
        Days: "Years"
    };
    var secondsIn = {
        Seconds: 1,
        Minutes: 60,
        Hours: 3600,
        Days: 86400,
        Months: 2678400,
        Years: 31536000
    };

    /**
     * Converts hex color code into object containing integer values for the r,g,b use
     * This function (hexToRgb) originates from:
     * http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
     * @param {string} hex color code
     */
    function hexToRgb(hex) {
        // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
        var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, function(m, r, g, b) {
            return r + r + g + g + b + b;
        });

        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    function isCanvasSupported() {
        var elem = document.createElement('canvas');
        return !!(elem.getContext && elem.getContext('2d'));
    }

    /**
     * Function s4() and guid() originate from:
     * http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
     */
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
    }

    /**
     * Creates a unique id
     * @returns {String}
     */
    function guid() {
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                s4() + '-' + s4() + s4() + s4();
    }

    /**
     * Array.prototype.indexOf fallback for IE8
     * @param {Mixed} mixed
     * @returns {Number}
     */
    if (!Array.prototype.indexOf) {
        Array.prototype.indexOf = function(elt /*, from*/)
        {
            var len = this.length >>> 0;

            var from = Number(arguments[1]) || 0;
            from = (from < 0)
                    ? Math.ceil(from)
                    : Math.floor(from);
            if (from < 0)
                from += len;

            for (; from < len; from++)
            {
                if (from in this &&
                        this[from] === elt)
                    return from;
            }
            return -1;
        };
    }

    function parse_date(str) {
        var match = str.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2}\s[0-9]{1,2}:[0-9]{2}:[0-9]{2}$/);
        if (match !== null && match.length > 0) {
            var parts = str.split(" ");
            var date = parts[0].split("-");
            var time = parts[1].split(":");
            return new Date(date[0], date[1] - 1, date[2], time[0], time[1], time[2]);
        }
        // Fallback for different date formats
        var d = Date.parse(str);
        if (!isNaN(d))
            return d;
        d = Date.parse(str.replace(/-/g, '/').replace('T', ' '));
        if (!isNaN(d))
            return d;
        // Cant find anything
        return new Date();
    }

    function parse_times(diff, old_diff, total_duration, units, floor) {
        var raw_time = {};
        var raw_old_time = {};
        var time = {};
        var pct = {};
        var old_pct = {};
        var old_time = {};

        var greater_unit = null;
        for(var i = 0; i < units.length; i++) {
            var unit = units[i];
            var maxUnits;

            if (greater_unit === null) {
                maxUnits = total_duration / secondsIn[unit];
            }
            else {
                maxUnits = secondsIn[greater_unit] / secondsIn[unit];
            }

            var curUnits = (diff / secondsIn[unit]);
            var oldUnits = (old_diff / secondsIn[unit]);
            
            if(floor) {
                if(curUnits > 0) curUnits = Math.floor(curUnits);
                else curUnits = Math.ceil(curUnits);
                if(oldUnits > 0) oldUnits = Math.floor(oldUnits);
                else oldUnits = Math.ceil(oldUnits);
            }
            
            if (unit !== "Days") {
                curUnits = curUnits % maxUnits;
                oldUnits = oldUnits % maxUnits;
            }

            raw_time[unit] = curUnits;
            time[unit] = Math.abs(curUnits);
            raw_old_time[unit] = oldUnits;
            old_time[unit] = Math.abs(oldUnits);
            pct[unit] = Math.abs(curUnits) / maxUnits;
            old_pct[unit] = Math.abs(oldUnits) / maxUnits;

            greater_unit = unit;
        }

        return {
            raw_time: raw_time,
            raw_old_time: raw_old_time,
            time: time,
            old_time: old_time,
            pct: pct,
            old_pct: old_pct
        };
    }

    var TC_Instance_List = {};
    function updateUsedWindow() {
        if(typeof useWindow.TC_Instance_List !== "undefined") {
            TC_Instance_List = useWindow.TC_Instance_List;
        }
        else {
            useWindow.TC_Instance_List = TC_Instance_List;
        }
        initializeAnimationFrameHandler(useWindow);
    };
    
    function initializeAnimationFrameHandler(w) {
        var vendors = ['webkit', 'moz'];
        for (var x = 0; x < vendors.length && !w.requestAnimationFrame; ++x) {
            w.requestAnimationFrame = w[vendors[x] + 'RequestAnimationFrame'];
            w.cancelAnimationFrame = w[vendors[x] + 'CancelAnimationFrame'];
        }

        if (!w.requestAnimationFrame || !w.cancelAnimationFrame) {
            w.requestAnimationFrame = function(callback, element, instance) {
                if (typeof instance === "undefined")
                    instance = {data: {last_frame: 0}};
                var currTime = new Date().getTime();
                var timeToCall = Math.max(0, 16 - (currTime - instance.data.last_frame));
                var id = w.setTimeout(function() {
                    callback(currTime + timeToCall);
                }, timeToCall);
                instance.data.last_frame = currTime + timeToCall;
                return id;
            };
            w.cancelAnimationFrame = function(id) {
                clearTimeout(id);
            };
        }
    };
    

    var TC_Instance = function(element, options) {
        this.element = element;
        this.container;
        this.listeners = null;
        this.data = {
            paused: false,
            last_frame: 0,
            animation_frame: null,
            interval_fallback: null,
            timer: false,
            total_duration: null,
            prev_time: null,
            drawn_units: [],
            text_elements: {
                Days: null,
                Hours: null,
                Minutes: null,
                Seconds: null
            },
            attributes: {
                canvas: null,
                context: null,
                item_size: null,
                line_width: null,
                radius: null,
                outer_radius: null
            },
            state: {
                fading: {
                    Days: false,
                    Hours: false,
                    Minutes: false,
                    Seconds: false
                }
            }
        };

        this.config = null;
        this.setOptions(options);
        this.initialize();
    };

    TC_Instance.prototype.clearListeners = function() {
        this.listeners = { all: [], visible: [] };
    };
    
    TC_Instance.prototype.addTime = function(seconds_to_add) {
        if(this.data.attributes.ref_date instanceof Date) {
            var d = this.data.attributes.ref_date;
            d.setSeconds(d.getSeconds() + seconds_to_add);
        }
        else if(!isNaN(this.data.attributes.ref_date)) {
            this.data.attributes.ref_date += (seconds_to_add * 1000);
        }
    };
    
    TC_Instance.prototype.initialize = function(clear_listeners) {
        // Initialize drawn units
        this.data.drawn_units = [];
        for(var i = 0; i < Object.keys(this.config.time).length; i++) {
            var unit = Object.keys(this.config.time)[i];
            if (this.config.time[unit].show) {
                this.data.drawn_units.push(unit);
            }
        }

        // Avoid stacking
        $(this.element).children('div.time_circles').remove();

        if (typeof clear_listeners === "undefined")
            clear_listeners = true;
        if (clear_listeners || this.listeners === null) {
            this.clearListeners();
        }
        this.container = $("<div>");
        this.container.addClass('time_circles');
        this.container.appendTo(this.element);
        
        // Determine the needed width and height of TimeCircles
        var height = this.element.offsetHeight;
        var width = this.element.offsetWidth;
        if (height === 0)
            height = $(this.element).height();
        if (width === 0)
            width = $(this.element).width();

        if (height === 0 && width > 0)
            height = width / this.data.drawn_units.length;
        else if (width === 0 && height > 0)
            width = height * this.data.drawn_units.length;
        
        // Create our canvas and set it to the appropriate size
        var canvasElement = document.createElement('canvas');
        canvasElement.width = width;
        canvasElement.height = height;
        
        // Add canvas elements
        this.data.attributes.canvas = $(canvasElement);
        this.data.attributes.canvas.appendTo(this.container);
        
        // Check if the browser has browser support
        var canvasSupported = isCanvasSupported();
        // If the browser doesn't have browser support, check if explorer canvas is loaded
        // (A javascript library that adds canvas support to browsers that don't have it)
        if(!canvasSupported && typeof G_vmlCanvasManager !== "undefined") {
            G_vmlCanvasManager.initElement(canvasElement);
            limited_mode = true;
            canvasSupported = true;
        }
        if(canvasSupported) {
            this.data.attributes.context = canvasElement.getContext('2d');
        }

        this.data.attributes.item_size = Math.min(width / this.data.drawn_units.length, height);
        this.data.attributes.line_width = this.data.attributes.item_size * this.config.fg_width;
        this.data.attributes.radius = ((this.data.attributes.item_size * 0.8) - this.data.attributes.line_width) / 2;
        this.data.attributes.outer_radius = this.data.attributes.radius + 0.5 * Math.max(this.data.attributes.line_width, this.data.attributes.line_width * this.config.bg_width);

        // Prepare Time Elements
        var i = 0;
        for (var key in this.data.text_elements) {
            if (!this.config.time[key].show)
                continue;

            var textElement = $("<div>");
            textElement.addClass('textDiv_' + key);
            textElement.css("top", Math.round(0.35 * this.data.attributes.item_size));
            textElement.css("left", Math.round(i++ * this.data.attributes.item_size));
            textElement.css("width", this.data.attributes.item_size);
            textElement.appendTo(this.container);

            var headerElement = $("<h4>");
            headerElement.text(this.config.time[key].text); // Options
            headerElement.css("font-size", Math.round(this.config.text_size * this.data.attributes.item_size));
            headerElement.css("line-height", Math.round(this.config.text_size * this.data.attributes.item_size) + "px");
            headerElement.appendTo(textElement);

            var numberElement = $("<span>");
            numberElement.css("font-size", Math.round(3 * this.config.text_size * this.data.attributes.item_size));
            numberElement.css("line-height", Math.round(this.config.text_size * this.data.attributes.item_size) + "px");
            numberElement.appendTo(textElement);

            this.data.text_elements[key] = numberElement;
        }

        this.start();
        if (!this.config.start) {
            this.data.paused = true;
        }
        
        // Set up interval fallback
        var _this = this;
        this.data.interval_fallback = useWindow.setInterval(function(){
            _this.update.call(_this, true);
        }, 100);
    };

    TC_Instance.prototype.update = function(nodraw) {
        if(typeof nodraw === "undefined") {
            nodraw = false;
        }
        else if(nodraw && this.data.paused) {
            return;
        }
        
        if(limited_mode) {
            //Per unit clearing doesn't work in IE8 using explorer canvas, so do it in one time. The downside is that radial fade cant be used
            this.data.attributes.context.clearRect(0, 0, this.data.attributes.canvas[0].width, this.data.attributes.canvas[0].hright);
        }
        var diff, old_diff;

        var prevDate = this.data.prev_time;
        var curDate = new Date();
        this.data.prev_time = curDate;

        if (prevDate === null)
            prevDate = curDate;

        // If not counting past zero, and time < 0, then simply draw the zero point once, and call stop
        if (!this.config.count_past_zero) {
            if (curDate > this.data.attributes.ref_date) {
                for(var i = 0; i < this.data.drawn_units.length; i++) {
                    var key = this.data.drawn_units[i];

                    // Set the text value
                    this.data.text_elements[key].text("0");
                    var x = (i * this.data.attributes.item_size) + (this.data.attributes.item_size / 2);
                    var y = this.data.attributes.item_size / 2;
                    var color = this.config.time[key].color;
                    this.drawArc(x, y, color, 0);
                }
                this.stop();
                return;
            }
        }

        // Compare current time with reference
        diff = (this.data.attributes.ref_date - curDate) / 1000;
        old_diff = (this.data.attributes.ref_date - prevDate) / 1000;

        var floor = this.config.animation !== "smooth";

        var visible_times = parse_times(diff, old_diff, this.data.total_duration, this.data.drawn_units, floor);
        var all_times = parse_times(diff, old_diff, secondsIn["Years"], allUnits, floor);

        var i = 0;
        var j = 0;
        var lastKey = null;

        var cur_shown = this.data.drawn_units.slice();
        for (var i in allUnits) {
            var key = allUnits[i];

            // Notify (all) listeners
            if (Math.floor(all_times.raw_time[key]) !== Math.floor(all_times.raw_old_time[key])) {
                this.notifyListeners(key, Math.floor(all_times.time[key]), Math.floor(diff), "all");
            }

            if (cur_shown.indexOf(key) < 0)
                continue;

            // Notify (visible) listeners
            if (Math.floor(visible_times.raw_time[key]) !== Math.floor(visible_times.raw_old_time[key])) {
                this.notifyListeners(key, Math.floor(visible_times.time[key]), Math.floor(diff), "visible");
            }
            
            if(!nodraw) {
                // Set the text value
                this.data.text_elements[key].text(Math.floor(Math.abs(visible_times.time[key])));

                var x = (j * this.data.attributes.item_size) + (this.data.attributes.item_size / 2);
                var y = this.data.attributes.item_size / 2;
                var color = this.config.time[key].color;

                if (this.config.animation === "smooth") {
                    if (lastKey !== null && !limited_mode) {
                        if (Math.floor(visible_times.time[lastKey]) > Math.floor(visible_times.old_time[lastKey])) {
                            this.radialFade(x, y, color, 1, key);
                            this.data.state.fading[key] = true;
                        }
                        else if (Math.floor(visible_times.time[lastKey]) < Math.floor(visible_times.old_time[lastKey])) {
                            this.radialFade(x, y, color, 0, key);
                            this.data.state.fading[key] = true;
                        }
                    }
                    if (!this.data.state.fading[key]) {
                        this.drawArc(x, y, color, visible_times.pct[key]);
                    }
                }
                else {
                    this.animateArc(x, y, color, visible_times.pct[key], visible_times.old_pct[key], (new Date()).getTime() + tick_duration);
                }
            }
            lastKey = key;
            j++;
        }

        // Dont request another update if we should be paused
        if(this.data.paused || nodraw) {
            return;
        }
        
        // We need this for our next frame either way
        var _this = this;
        var update = function() {
            _this.update.call(_this);
        };

        // Either call next update immediately, or in a second
        if (this.config.animation === "smooth") {
            // Smooth animation, Queue up the next frame
            this.data.animation_frame = useWindow.requestAnimationFrame(update, _this.element, _this);
        }
        else {
            // Tick animation, Don't queue until very slightly after the next second happens
            var delay = (diff % 1) * 1000;
            if (delay < 0)
                delay = 1000 + delay;
            delay += 50;

            _this.data.animation_frame = useWindow.setTimeout(function() {
                _this.data.animation_frame = useWindow.requestAnimationFrame(update, _this.element, _this);
            }, delay);
        }
    };

    TC_Instance.prototype.animateArc = function(x, y, color, target_pct, cur_pct, animation_end) {
        if (this.data.attributes.context === null)
            return;

        var diff = cur_pct - target_pct;
        if (Math.abs(diff) > 0.5) {
            if (target_pct === 0) {
                this.radialFade(x, y, color, 1);
            }
            else {
                this.radialFade(x, y, color, 0);
            }
        }
        else {
            var progress = (tick_duration - (animation_end - (new Date()).getTime())) / tick_duration;
            if (progress > 1)
                progress = 1;

            var pct = (cur_pct * (1 - progress)) + (target_pct * progress);
            this.drawArc(x, y, color, pct);

            //var show_pct =
            if (progress >= 1)
                return;
            var _this = this;
            useWindow.requestAnimationFrame(function() {
                _this.animateArc(x, y, color, target_pct, cur_pct, animation_end);
            }, this.element);
        }
    };

    TC_Instance.prototype.drawArc = function(x, y, color, pct) {
        if (this.data.attributes.context === null)
            return;

        var clear_radius = Math.max(this.data.attributes.outer_radius, this.data.attributes.item_size / 2);
        if(!limited_mode) {
            this.data.attributes.context.clearRect(
                    x - clear_radius,
                    y - clear_radius,
                    clear_radius * 2,
                    clear_radius * 2
                    );
        }
        
        if (this.config.use_background) {
            this.data.attributes.context.beginPath();
            this.data.attributes.context.arc(x, y, this.data.attributes.radius, 0, 2 * Math.PI, false);
            this.data.attributes.context.lineWidth = this.data.attributes.line_width * this.config.bg_width;

            // line color
            this.data.attributes.context.strokeStyle = this.config.circle_bg_color;
            this.data.attributes.context.stroke();
        }

        // Direction
        var startAngle, endAngle, counterClockwise;
        var defaultOffset = (-0.5 * Math.PI);
        var fullCircle = 2 * Math.PI;
        startAngle = defaultOffset + (this.config.start_angle / 360 * fullCircle);
        var offset = (2 * pct * Math.PI);

        if (this.config.direction === "Both") {
            counterClockwise = false;
            startAngle -= (offset / 2);
            endAngle = startAngle + offset;
        }
        else {
            if (this.config.direction === "Clockwise") {
                counterClockwise = false;
                endAngle = startAngle + offset;
            }
            else {
                counterClockwise = true;
                endAngle = startAngle - offset;
            }
        }

        this.data.attributes.context.beginPath();
        this.data.attributes.context.arc(x, y, this.data.attributes.radius, startAngle, endAngle, counterClockwise);
        this.data.attributes.context.lineWidth = this.data.attributes.line_width;

        // line color
        this.data.attributes.context.strokeStyle = color;
        this.data.attributes.context.stroke();
    };

    TC_Instance.prototype.radialFade = function(x, y, color, from, key) {
        // TODO: Make fade_time option
        var rgb = hexToRgb(color);
        var _this = this; // We have a few inner scopes here that will need access to our instance

        var step = 0.2 * ((from === 1) ? -1 : 1);
        var i;
        for (i = 0; from <= 1 && from >= 0; i++) {
            // Create inner scope so our variables are not changed by the time the Timeout triggers
            (function() {
                var delay = 50 * i;
                var rgba = "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", " + (Math.round(from * 10) / 10) + ")";
                useWindow.setTimeout(function() {
                    _this.drawArc(x, y, rgba, 1);
                }, delay);
            }());
            from += step;
        }
        if (typeof key !== undefined) {
            useWindow.setTimeout(function() {
                _this.data.state.fading[key] = false;
            }, 50 * i);
        }
    };

    TC_Instance.prototype.timeLeft = function() {
        if (this.data.paused && typeof this.data.timer === "number") {
            return this.data.timer;
        }
        var now = new Date();
        return ((this.data.attributes.ref_date - now) / 1000);
    };

    TC_Instance.prototype.start = function() {
        useWindow.cancelAnimationFrame(this.data.animation_frame);
        useWindow.clearTimeout(this.data.animation_frame)

        // Check if a date was passed in html attribute or jquery data
        var attr_data_date = $(this.element).data('date');
        if (typeof attr_data_date === "undefined") {
            attr_data_date = $(this.element).attr('data-date');
        }
        if (typeof attr_data_date === "string") {
            this.data.attributes.ref_date = parse_date(attr_data_date);
        }
        // Check if this is an unpause of a timer
        else if (typeof this.data.timer === "number") {
            if (this.data.paused) {
                this.data.attributes.ref_date = (new Date()).getTime() + (this.data.timer * 1000);
            }
        }
        else {
            // Try to get data-timer
            var attr_data_timer = $(this.element).data('timer');
            if (typeof attr_data_timer === "undefined") {
                attr_data_timer = $(this.element).attr('data-timer');
            }
            if (typeof attr_data_timer === "string") {
                attr_data_timer = parseFloat(attr_data_timer);
            }
            if (typeof attr_data_timer === "number") {
                this.data.timer = attr_data_timer;
                this.data.attributes.ref_date = (new Date()).getTime() + (attr_data_timer * 1000);
            }
            else {
                // data-timer and data-date were both not set
                // use config date
                this.data.attributes.ref_date = this.config.ref_date;
            }
        }

        // Start running
        this.data.paused = false;
        this.update.call(this);
    };

    TC_Instance.prototype.restart = function() {
        this.data.timer = false;
        this.start();
    };

    TC_Instance.prototype.stop = function() {
        if (typeof this.data.timer === "number") {
            this.data.timer = this.timeLeft(this);
        }
        // Stop running
        this.data.paused = true;
        useWindow.cancelAnimationFrame(this.data.animation_frame);
    };

    TC_Instance.prototype.destroy = function() {
        this.clearListeners();
        this.stop();
        useWindow.clearInterval(this.data.interval_fallback);
        this.data.interval_fallback = null;
        
        this.container.remove();
        $(this.element).removeAttr('data-tc-id');
        $(this.element).removeData('tc-id');
    };

    TC_Instance.prototype.setOptions = function(options) {
        if (this.config === null) {
            this.default_options.ref_date = new Date();
            this.config = $.extend(true, {}, this.default_options);
        }
        $.extend(true, this.config, options);

        // Use window.top if use_top_frame is true
        if(this.config.use_top_frame) {
            useWindow = window.top;
        }
        else {
            useWindow = window;
        }
        updateUsedWindow();
        
        this.data.total_duration = this.config.total_duration;
        if (typeof this.data.total_duration === "string") {
            if (typeof secondsIn[this.data.total_duration] !== "undefined") {
                // If set to Years, Months, Days, Hours or Minutes, fetch the secondsIn value for that
                this.data.total_duration = secondsIn[this.data.total_duration];
            }
            else if (this.data.total_duration === "Auto") {
                // If set to auto, total_duration is the size of 1 unit, of the unit type bigger than the largest shown
                for(var i = 0; i < Object.keys(this.config.time).length; i++) {
                    var unit = Object.keys(this.config.time)[i];
                    if (this.config.time[unit].show) {
                        this.data.total_duration = secondsIn[nextUnits[unit]];
                        break;
                    }
                }
            }
            else {
                // If it's a string, but neither of the above, user screwed up.
                this.data.total_duration = secondsIn["Years"];
                console.error("Valid values for TimeCircles config.total_duration are either numeric, or (string) Years, Months, Days, Hours, Minutes, Auto");
            }
        }
    };

    TC_Instance.prototype.addListener = function(f, context, type) {
        if (typeof f !== "function")
            return;
        if (typeof type === "undefined")
            type = "visible";
        this.listeners[type].push({func: f, scope: context});
    };

    TC_Instance.prototype.notifyListeners = function(unit, value, total, type) {
        for (var i = 0; i < this.listeners[type].length; i++) {
            var listener = this.listeners[type][i];
            listener.func.apply(listener.scope, [unit, value, total]);
        }
    };

    TC_Instance.prototype.default_options = {
        ref_date: new Date(),
        start: true,
        animation: "smooth",
        count_past_zero: true,
        circle_bg_color: "#60686F",
        use_background: true,
        fg_width: 0.1,
        bg_width: 1.2,
        text_size: 0.07,
        total_duration: "Auto",
        direction: "Clockwise",
        use_top_frame: false,
        start_angle: 0,
        time: {
            Days: {
                show: true,
                text: "Days",
                color: "#FC6"
            },
            Hours: {
                show: true,
                text: "Hours",
                color: "#9CF"
            },
            Minutes: {
                show: true,
                text: "Minutes",
                color: "#BFB"
            },
            Seconds: {
                show: true,
                text: "Seconds",
                color: "#F99"
            }
        }
    };

    // Time circle class
    var TC_Class = function(elements, options) {
        this.elements = elements;
        this.options = options;
        this.foreach();
    };

    TC_Class.prototype.getInstance = function(element) {
        var instance;

        var cur_id = $(element).data("tc-id");
        if (typeof cur_id === "undefined") {
            cur_id = guid();
            $(element).attr("data-tc-id", cur_id);
        }
        if (typeof TC_Instance_List[cur_id] === "undefined") {
            var options = this.options;
            var element_options = $(element).data('options');
            if (typeof element_options === "string") {
                element_options = JSON.parse(element_options);
            }
            if (typeof element_options === "object") {
                options = $.extend(true, {}, this.options, element_options);
            }
            instance = new TC_Instance(element, options);
            TC_Instance_List[cur_id] = instance;
        }
        else {
            instance = TC_Instance_List[cur_id];
            if (typeof this.options !== "undefined") {
                instance.setOptions(this.options);
            }
        }
        return instance;
    };

    TC_Class.prototype.addTime = function(seconds_to_add) {
        this.foreach(function(instance) {
            instance.addTime(seconds_to_add);
        });
    };
    
    TC_Class.prototype.foreach = function(callback) {
        var _this = this;
        this.elements.each(function() {
            var instance = _this.getInstance(this);
            if (typeof callback === "function") {
                callback(instance);
            }
        });
        return this;
    };

    TC_Class.prototype.start = function() {
        this.foreach(function(instance) {
            instance.start();
        });
        return this;
    };

    TC_Class.prototype.stop = function() {
        this.foreach(function(instance) {
            instance.stop();
        });
        return this;
    };

    TC_Class.prototype.restart = function() {
        this.foreach(function(instance) {
            instance.restart();
        });
        return this;
    };

    TC_Class.prototype.rebuild = function() {
        this.foreach(function(instance) {
            instance.initialize(false);
        });
        return this;
    };

    TC_Class.prototype.getTime = function() {
        return this.getInstance(this.elements[0]).timeLeft();
    };

    TC_Class.prototype.addListener = function(f, type) {
        if (typeof type === "undefined")
            type = "visible";
        var _this = this;
        this.foreach(function(instance) {
            instance.addListener(f, _this.elements, type);
        });
        return this;
    };

    TC_Class.prototype.destroy = function() {
        this.foreach(function(instance) {
            instance.destroy();
        });
        return this;
    };

    TC_Class.prototype.end = function() {
        return this.elements;
    };

    $.fn.TimeCircles = function(options) {
        return new TC_Class(this, options);
    };
}(jQuery));










/*jquery.mb.YTPlayer 01-10-2018
 _ jquery.mb.components 
 _ email: matteo@open-lab.com 
 _ Copyright (c) 2001-2018. Matteo Bicocchi (Pupunzi); 
 _ blog: http://pupunzi.open-lab.com 
 _ Open Lab s.r.l., Florence - Italy 
 */
function onYouTubeIframeAPIReady(){ytp.YTAPIReady||(ytp.YTAPIReady=!0,jQuery(document).trigger("YTAPIReady"))}function iOSversion(){if(/iP(hone|od|ad)/.test(navigator.platform)){var a=navigator.appVersion.match(/OS (\d+)_(\d+)_?(\d+)?/);return[parseInt(a[1],10),parseInt(a[2],10),parseInt(a[3]||0,10)]}}function uncamel(a){return a.replace(/([A-Z])/g,function(a){return"-"+a.toLowerCase()})}function setUnit(a,b){return"string"!=typeof a||a.match(/^[\-0-9\.]+jQuery/)?""+a+b:a}function setFilter(a,b,c){var d=uncamel(b),e=jQuery.browser.mozilla?"":jQuery.CSS.sfx;a[e+"filter"]=a[e+"filter"]||"",c=setUnit(c>jQuery.CSS.filters[b].max?jQuery.CSS.filters[b].max:c,jQuery.CSS.filters[b].unit),a[e+"filter"]+=d+"("+c+") ",delete a[b]}function isTouchSupported(){var a=nAgt.msMaxTouchPoints,b="ontouchstart"in document.createElement("div");return!(!a&&!b)}function isTouchSupported(){var a=nAgt.msMaxTouchPoints,b="ontouchstart"in document.createElement("div");return!(!a&&!b)}var ytp=ytp||{},getYTPVideoID=function(a){var b,c;return a.indexOf("youtu.be")>0||a.indexOf("youtube.com/embed")>0?(b=a.substr(a.lastIndexOf("/")+1,a.length),c=b.indexOf("?list=")>0?b.substr(b.lastIndexOf("="),b.length):null,b=c?b.substr(0,b.lastIndexOf("?")):b):a.indexOf("http")>-1?(b=a.match(/[\\?&]v=([^&#]*)/)[1],c=a.indexOf("list=")>0?a.match(/[\\?&]list=([^&#]*)/)[1]:null):(b=a.length>15?null:a,c=b?null:a),{videoID:b,playlistID:c}};!function(jQuery,ytp){jQuery.mbYTPlayer={name:"jquery.mb.YTPlayer",version:"3.2.6",build:"7274",author:"Matteo Bicocchi (pupunzi)",apiKey:"",defaults:{videoURL:null,containment:"body",ratio:"auto",fadeOnStartTime:1500,startAt:0,stopAt:0,autoPlay:!0,coverImage:!1,loop:!0,addRaster:!1,mask:!1,opacity:1,quality:"default",vol:50,mute:!1,showControls:!0,anchor:"center,center",showAnnotations:!1,cc_load_policy:!1,showYTLogo:!0,useOnMobile:!0,mobileFallbackImage:null,playOnlyIfVisible:!1,onScreenPercentage:30,stopMovieOnBlur:!0,realfullscreen:!0,optimizeDisplay:!0,abundance:.2,gaTrack:!0,remember_last_time:!1,addFilters:!1,onReady:function(a){},onError:function(a,b){}},controls:{play:"P",pause:"p",mute:"M",unmute:"A",onlyYT:"O",showSite:"R",ytLogo:"Y"},controlBar:null,locationProtocol:"https:",defaultFilters:{grayscale:{value:0,unit:"%"},hue_rotate:{value:0,unit:"deg"},invert:{value:0,unit:"%"},opacity:{value:0,unit:"%"},saturate:{value:0,unit:"%"},sepia:{value:0,unit:"%"},brightness:{value:0,unit:"%"},contrast:{value:0,unit:"%"},blur:{value:0,unit:"px"}},buildPlayer:function(options){function isIframe(){var a=!1;try{self.location.href!=top.location.href&&(a=!0)}catch(b){a=!0}return a}if(ytp.YTAPIReady||"undefined"!=typeof window.YT)setTimeout(function(){jQuery(document).trigger("YTAPIReady"),ytp.YTAPIReady=!0},100);else{jQuery("#YTAPI").remove();var tag=jQuery("<script></script>").attr({src:jQuery.mbYTPlayer.locationProtocol+"//www.youtube.com/iframe_api?v="+jQuery.mbYTPlayer.version,id:"YTAPI"});jQuery("head").prepend(tag)}return this.each(function(){var YTPlayer=this,$YTPlayer=jQuery(YTPlayer);$YTPlayer.hide(),YTPlayer.loop=0,YTPlayer.state=0,YTPlayer.filters=jQuery.extend(!0,{},jQuery.mbYTPlayer.defaultFilters),YTPlayer.filtersEnabled=!0,YTPlayer.id=YTPlayer.id||"YTP_"+(new Date).getTime(),$YTPlayer.addClass("mb_YTPlayer");var property=$YTPlayer.data("property")&&"string"==typeof $YTPlayer.data("property")?eval("("+$YTPlayer.data("property")+")"):$YTPlayer.data("property");"object"!=typeof property&&(property={}),YTPlayer.opt=jQuery.extend(!0,{},jQuery.mbYTPlayer.defaults,YTPlayer.opt,options,property),YTPlayer.opt.elementId=YTPlayer.id,0===YTPlayer.opt.vol&&(YTPlayer.opt.vol=1,YTPlayer.opt.mute=!0),YTPlayer.opt.autoPlay&&0==YTPlayer.opt.mute&&jQuery.mbBrowser.chrome&&(jQuery(document).one("mousedown.YTPstart",function(){$YTPlayer.YTPPlay()}),console.info("YTPlayer info: On Webkit browsers you can not autoplay the video if the audio is on.")),YTPlayer.opt.loop&&"boolean"==typeof YTPlayer.opt.loop&&(YTPlayer.opt.loop=9999);var fullScreenAvailable=document.fullscreenEnabled||document.webkitFullscreenEnabled||document.mozFullScreenEnabled||document.msFullscreenEnabled;YTPlayer.opt.realfullscreen=isIframe()||!fullScreenAvailable?!1:YTPlayer.opt.realfullscreen,YTPlayer.opt.showAnnotations=YTPlayer.opt.showAnnotations?"1":"3",YTPlayer.opt.cc_load_policy=YTPlayer.opt.cc_load_policy?"1":"0",YTPlayer.opt.coverImage=YTPlayer.opt.coverImage||YTPlayer.opt.backgroundImage,jQuery.mbBrowser.msie&&jQuery.mbBrowser.version<9&&(YTPlayer.opt.opacity=1),YTPlayer.opt.containment="self"===YTPlayer.opt.containment?$YTPlayer:jQuery(YTPlayer.opt.containment),YTPlayer.isRetina=window.retina||window.devicePixelRatio>1,YTPlayer.opt.ratio="auto"===YTPlayer.opt.ratio?16/9:YTPlayer.opt.ratio,YTPlayer.opt.ratio=eval(YTPlayer.opt.ratio),YTPlayer.orig_containment_background=YTPlayer.opt.containment.css("background-image"),$YTPlayer.attr("id")||$YTPlayer.attr("id","ytp_"+(new Date).getTime()),YTPlayer.playerID="iframe_"+YTPlayer.id,YTPlayer.isAlone=!1,YTPlayer.hasFocus=!0,YTPlayer.videoID=YTPlayer.opt.videoURL?getYTPVideoID(YTPlayer.opt.videoURL).videoID:$YTPlayer.attr("href")?getYTPVideoID($YTPlayer.attr("href")).videoID:!1,YTPlayer.playlistID=YTPlayer.opt.videoURL?getYTPVideoID(YTPlayer.opt.videoURL).playlistID:$YTPlayer.attr("href")?getYTPVideoID($YTPlayer.attr("href")).playlistID:!1;var start_from_last=0;if(jQuery.mbCookie.get("YTPlayer_start_from"+YTPlayer.videoID)&&(start_from_last=parseFloat(jQuery.mbCookie.get("YTPlayer_start_from"+YTPlayer.videoID))),YTPlayer.opt.remember_last_time&&start_from_last&&(YTPlayer.start_from_last=start_from_last,jQuery.mbCookie.remove("YTPlayer_start_from"+YTPlayer.videoID)),YTPlayer.isPlayer=$YTPlayer.is(YTPlayer.opt.containment),YTPlayer.isBackground=YTPlayer.opt.containment.is("body"),!YTPlayer.isBackground||!ytp.backgroundIsInited){YTPlayer.isPlayer&&$YTPlayer.show(),YTPlayer.overlay=jQuery("<div/>").css({position:"absolute",top:0,left:0,width:"100%",height:"100%"}).addClass("YTPOverlay"),YTPlayer.wrapper=jQuery("<div/>").attr("id","wrapper_"+YTPlayer.id).css({position:"absolute",zIndex:0,minWidth:"100%",minHeight:"100%",left:0,top:0,overflow:"hidden",opacity:0}).addClass("mbYTP_wrapper"),YTPlayer.isPlayer&&(YTPlayer.inlinePlayButton=jQuery("<div/>").addClass("inlinePlayButton").html(jQuery.mbYTPlayer.controls.play),$YTPlayer.append(YTPlayer.inlinePlayButton),YTPlayer.inlinePlayButton.on("click",function(a){$YTPlayer.YTPPlay(),a.stopPropagation()}),YTPlayer.opt.autoPlay&&YTPlayer.inlinePlayButton.hide(),YTPlayer.overlay.on("click",function(){$YTPlayer.YTPTogglePlay()}).css({cursor:"pointer"}));var playerBox=jQuery("<div/>").attr("id",YTPlayer.playerID).addClass("playerBox");if(playerBox.css({position:"absolute",zIndex:0,width:"100%",height:"100%",top:0,left:0,overflow:"hidden",opacity:1}),YTPlayer.wrapper.append(playerBox),playerBox.after(YTPlayer.overlay),YTPlayer.isPlayer&&(YTPlayer.inlineWrapper=jQuery("<div/>").addClass("inline-YTPlayer"),YTPlayer.inlineWrapper.css({position:"relative",maxWidth:YTPlayer.opt.containment.css("width")}),YTPlayer.opt.containment.css({position:"relative",paddingBottom:"56.25%",overflow:"hidden",height:0}),YTPlayer.opt.containment.wrap(YTPlayer.inlineWrapper)),YTPlayer.opt.containment.children().not("script, style").each(function(){"static"==jQuery(this).css("position")&&jQuery(this).css("position","relative")}),YTPlayer.isBackground?(jQuery("body").css({boxSizing:"border-box"}),YTPlayer.wrapper.css({position:"fixed",top:0,left:0,zIndex:0})):"static"==YTPlayer.opt.containment.css("position")&&(YTPlayer.opt.containment.css({position:"relative"}),$YTPlayer.show()),YTPlayer.opt.containment.prepend(YTPlayer.wrapper),YTPlayer.isBackground||YTPlayer.overlay.on("mouseenter",function(){YTPlayer.controlBar&&YTPlayer.controlBar.length&&YTPlayer.controlBar.addClass("visible")}).on("mouseleave",function(){YTPlayer.controlBar&&YTPlayer.controlBar.length&&YTPlayer.controlBar.removeClass("visible")}),jQuery.mbBrowser.mobile&&!YTPlayer.opt.useOnMobile)return YTPlayer.opt.mobileFallbackImage&&(YTPlayer.wrapper.css({backgroundImage:"url("+YTPlayer.opt.mobileFallbackImage+")",backgroundPosition:"center center",backgroundSize:"cover",backgroundRepeat:"no-repeat",opacity:1}),YTPlayer.wrapper.css({opacity:1})),$YTPlayer;jQuery.mbBrowser.mobile&&YTPlayer.opt.autoPlay&&YTPlayer.opt.useOnMobile&&jQuery("body").one("touchstart",function(){YTPlayer.player.playVideo()}),jQuery(document).one("YTAPIReady",function(){$YTPlayer.trigger("YTAPIReady_"+YTPlayer.id),ytp.YTAPIReady=!0}),YTPlayer.isOnScreen=jQuery.mbYTPlayer.isOnScreen(YTPlayer,YTPlayer.opt.onScreenPercentage),$YTPlayer.one("YTAPIReady_"+YTPlayer.id,function(){var a=this,b=jQuery(a);a.isBackground&&ytp.backgroundIsInited||a.isInit||(a.isBackground&&(ytp.backgroundIsInited=!0),a.opt.autoPlay="undefined"==typeof a.opt.autoPlay?!!a.isBackground:a.opt.autoPlay,a.opt.vol=a.opt.vol?a.opt.vol:100,jQuery.mbYTPlayer.getDataFromAPI(a),jQuery(a).on("YTPChanged",function(c){if(!a.isInit){a.isInit=!0;var d={modestbranding:1,autoplay:0,controls:0,showinfo:0,rel:0,enablejsapi:1,version:3,playerapiid:a.playerID,origin:"*",allowfullscreen:!0,wmode:"transparent",iv_load_policy:a.opt.showAnnotations,cc_load_policy:a.opt.cc_load_policy,playsinline:jQuery.mbBrowser.mobile?1:0,html5:document.createElement("video").canPlayType?1:0};new YT.Player(a.playerID,{playerVars:d,events:{onReady:function(c){a.player=c.target,a.player.loadVideoById({videoId:a.videoID.toString(),suggestedQuality:a.opt.quality}),b.trigger("YTPlayerIsReady_"+a.id)},onStateChange:function(b){if("function"==typeof b.target.getPlayerState){var c=b.target.getPlayerState();if(a.preventTrigger||a.isStarting)return void(a.preventTrigger=!1);a.state=c;var d;switch(c){case-1:d="YTPUnstarted";break;case 0:d="YTPRealEnd";break;case 1:d="YTPPlay",a.controlBar.length&&a.controlBar.find(".mb_YTPPlayPause").html(jQuery.mbYTPlayer.controls.pause),a.isPlayer&&a.inlinePlayButton.hide(),jQuery(document).off("mousedown.YTPstart");break;case 2:d="YTPPause",a.controlBar.length&&a.controlBar.find(".mb_YTPPlayPause").html(jQuery.mbYTPlayer.controls.play),a.isPlayer&&a.inlinePlayButton.show();break;case 3:a.player.setPlaybackQuality(a.opt.quality),d="YTPBuffering",a.controlBar.length&&a.controlBar.find(".mb_YTPPlayPause").html(jQuery.mbYTPlayer.controls.play);break;case 5:d="YTPCued"}var e=jQuery.Event(d);e.time=a.currentTime,jQuery(a).trigger(e)}},onPlaybackQualityChange:function(b){var c=b.target.getPlaybackQuality(),d=jQuery.Event("YTPQualityChange");d.quality=c,jQuery(a).trigger(d)},onError:function(c){switch("function"==typeof a.opt.onError&&a.opt.onError(b,c),c.data){case 2:console.error("video ID:: "+a.videoID+": The request contains an invalid parameter value. For example, this error occurs if you specify a video ID that does not have 11 characters, or if the video ID contains invalid characters, such as exclamation points or asterisks.");break;case 5:console.error("video ID:: "+a.videoID+": The requested content cannot be played in an HTML5 player or another error related to the HTML5 player has occurred.");break;case 100:console.error("video ID:: "+a.videoID+": The video requested was not found. This error occurs when a video has been removed (for any reason) or has been marked as private.");break;case 101:case 150:console.error("video ID:: "+a.videoID+": The owner of the requested video does not allow it to be played in embedded players.")}a.isList&&jQuery(a).YTPPlayNext()}}}),b.on("YTPlayerIsReady_"+a.id,function(){return a.isReady?this:(a.playerEl=a.player.getIframe(),jQuery(a.playerEl).unselectable(),b.optimizeDisplay(),jQuery(window).off("resize.YTP_"+a.id).on("resize.YTP_"+a.id,function(){b.optimizeDisplay()}),a.opt.remember_last_time&&jQuery(window).on("unload.YTP_"+a.id,function(){var b=a.player.getCurrentTime();jQuery.mbCookie.set("YTPlayer_start_from"+a.videoID,b,0)}),void b.YTPCheckForState())})}}))}),$YTPlayer.off("YTPTime.mask"),jQuery.mbYTPlayer.applyMask(YTPlayer)}})},isOnScreen:function(a,b){b=b||10;var c=a.wrapper,d=jQuery(window).scrollTop(),e=d+jQuery(window).height(),f=c.height()*b/100,g=c.offset().top+f,h=c.offset().top+(c.height()-f);return e>=h&&g>=d},getDataFromAPI:function(a){if(a.videoData=jQuery.mbStorage.get("YTPlayer_data_"+a.videoID),jQuery(a).off("YTPData.YTPlayer").on("YTPData.YTPlayer",function(){if(a.hasData&&a.isPlayer&&!a.opt.autoPlay){var b=a.opt.coverImage?"url("+a.opt.coverImage+") center center":a.orig_containment_background;console.debug("1",b),a.opt.containment.css({background:b,backgroundSize:"cover"})}}),a.videoData)setTimeout(function(){a.dataReceived=!0;var b=jQuery.Event("YTPChanged");b.time=a.currentTime,b.videoId=a.videoID,b.opt=a.opt,jQuery(a).trigger(b);var c=jQuery.Event("YTPData");c.prop={};for(var d in a.videoData)c.prop[d]=a.videoData[d];jQuery(a).trigger(c)},a.opt.fadeOnStartTime),a.hasData=!0;else if(jQuery.mbYTPlayer.apiKey)jQuery.getJSON(jQuery.mbYTPlayer.locationProtocol+"//www.googleapis.com/youtube/v3/videos?id="+a.videoID+"&key="+jQuery.mbYTPlayer.apiKey+"&part=snippet",function(b){function c(b){a.videoData={},a.videoData.id=a.videoID,a.videoData.channelTitle=b.channelTitle,a.videoData.title=b.title,a.videoData.description=b.description.length<400?b.description:b.description.substring(0,400)+" ...",a.videoData.thumb_max=b.thumbnails.maxres?b.thumbnails.maxres.url:null,a.videoData.thumb_high=b.thumbnails.high?b.thumbnails.high.url:null,a.videoData.thumb_medium=b.thumbnails.medium?b.thumbnails.medium.url:null,jQuery.mbStorage.set("YTPlayer_data_"+a.videoID,a.videoData)}a.dataReceived=!0;var d=jQuery.Event("YTPChanged");d.time=a.currentTime,d.videoId=a.videoID,jQuery(a).trigger(d),b.items[0]?(c(b.items[0].snippet),a.hasData=!0):(a.videoData={},a.hasData=!1);var e=jQuery.Event("YTPData");e.prop={};for(var f in a.videoData)e.prop[f]=a.videoData[f];jQuery(a).trigger(e)});else{if(setTimeout(function(){var b=jQuery.Event("YTPChanged");b.time=a.currentTime,b.videoId=a.videoID,jQuery(a).trigger(b)},50),!a.opt.autoPlay){var b=a.opt.coverImage?"url("+a.opt.coverImage+") center center":a.orig_containment_background;b&&a.opt.containment.css({background:b,backgroundSize:"cover"})}a.videoData=null}a.opt.ratio="auto"==a.opt.ratio?"16/9":a.opt.ratio,a.isPlayer&&!a.opt.autoPlay&&(a.loading=jQuery("<div/>").addClass("loading").html("Loading").hide(),jQuery(a).append(a.loading),a.loading.fadeIn())},removeStoredData:function(){jQuery.mbStorage.remove()},getVideoData:function(){var a=this.get(0);return a.videoData},getVideoID:function(){var a=this.get(0);return a.videoID||!1},getPlaylistID:function(){var a=this.get(0);return a.playlistID||!1},setVideoQuality:function(a){var b=this.get(0);return b.player.setPlaybackQuality(a),this},playlist:function(a,b,c){var d=this,e=d.get(0);return e.isList=!0,b&&(a=jQuery.shuffle(a)),e.videoID||(e.videos=a,e.videoCounter=1,e.videoLength=a.length,jQuery(e).data("property",a[0]),jQuery(e).YTPlayer()),"function"==typeof c&&jQuery(e).one("YTPChanged",function(){c(e)}),jQuery(e).on("YTPEnd",function(){jQuery(e).YTPPlayNext()}),this},playNext:function(){var a=this.get(0);return a.videoCounter++,a.videoCounter>a.videoLength&&(a.videoCounter=1),jQuery(a).YTPPlayIndex(a.videoCounter),this},playPrev:function(){var a=this.get(0);return a.videoCounter--,a.videoCounter<=0&&(a.videoCounter=a.videoLength),jQuery(a).YTPPlayIndex(a.videoCounter),this},playIndex:function(a){var b=this.get(0);b.checkForStartAt&&(clearInterval(b.checkForStartAt),clearInterval(b.getState)),b.videoCounter=a,b.videoCounter>=b.videoLength&&(b.videoCounter=b.videoLength);var c=b.videos[b.videoCounter-1];return jQuery(b).YTPChangeVideo(c),this},changeVideo:function(a){var b=this,c=b.get(0);c.opt.startAt=0,c.opt.stopAt=0,c.opt.mask=!1,c.opt.mute=!0,c.opt.autoPlay=!0,c.opt.addFilters=!1,c.opt.coverImage=!1,c.hasData=!1,c.hasChanged=!0,c.player.loopTime=void 0,a&&jQuery.extend(c.opt,a),console.debug("changeVideo::",c.opt),c.videoID=getYTPVideoID(c.opt.videoURL).videoID,c.opt.loop&&"boolean"==typeof c.opt.loop&&(c.opt.loop=9999),c.wrapper.css({background:"none"}),jQuery(c.playerEl).CSSAnimate({opacity:0},c.opt.fadeOnStartTime,function(){jQuery.mbYTPlayer.getDataFromAPI(c),console.debug("YTPGetPlayer::",b.YTPGetPlayer()),b.YTPGetPlayer().loadVideoById({videoId:c.videoID,suggestedQuality:c.opt.quality}),b.YTPPause(),b.optimizeDisplay(),b.YTPCheckForState()});var d=jQuery.Event("YTPChangeVideo");return d.time=c.currentTime,jQuery(c).trigger(d),jQuery.mbYTPlayer.applyMask(c),this},getPlayer:function(){var a=this.get(0);return a.isReady?a.player||null:null},playerDestroy:function(){var a=this.get(0);return a.isReady?(ytp.YTAPIReady=!0,ytp.backgroundIsInited=!1,a.isInit=!1,a.videoID=null,a.isReady=!1,a.wrapper.remove(),jQuery("#controlBar_"+a.id).remove(),clearInterval(a.checkForStartAt),clearInterval(a.getState),this):this},fullscreen:function(real){function hideMouse(){YTPlayer.overlay.css({cursor:"none"})}function RunPrefixMethod(a,b){for(var c,d,e=["webkit","moz","ms","o",""],f=0;f<e.length&&!a[c];){if(c=b,""==e[f]&&(c=c.substr(0,1).toLowerCase()+c.substr(1)),c=e[f]+c,d=typeof a[c],"undefined"!=d)return e=[e[f]],"function"==d?a[c]():a[c];f++}}function launchFullscreen(a){RunPrefixMethod(a,"RequestFullScreen")}function cancelFullscreen(){(RunPrefixMethod(document,"FullScreen")||RunPrefixMethod(document,"IsFullScreen"))&&RunPrefixMethod(document,"CancelFullScreen")}var YTPlayer=this.get(0);"undefined"==typeof real&&(real=eval(YTPlayer.opt.realfullscreen));var controls=jQuery("#controlBar_"+YTPlayer.id),fullScreenBtn=controls.find(".mb_OnlyYT"),videoWrapper=YTPlayer.isPlayer?YTPlayer.opt.containment:YTPlayer.wrapper;if(real){var fullscreenchange=jQuery.mbBrowser.mozilla?"mozfullscreenchange":jQuery.mbBrowser.webkit?"webkitfullscreenchange":"fullscreenchange";jQuery(document).off(fullscreenchange).on(fullscreenchange,function(){var a=RunPrefixMethod(document,"IsFullScreen")||RunPrefixMethod(document,"FullScreen");a?(jQuery(YTPlayer).YTPSetVideoQuality("default"),jQuery(YTPlayer).trigger("YTPFullScreenStart")):(YTPlayer.isAlone=!1,fullScreenBtn.html(jQuery.mbYTPlayer.controls.onlyYT),jQuery(YTPlayer).YTPSetVideoQuality(YTPlayer.opt.quality),videoWrapper.removeClass("YTPFullscreen"),videoWrapper.CSSAnimate({opacity:YTPlayer.opt.opacity},YTPlayer.opt.fadeOnStartTime),videoWrapper.css({zIndex:0}),YTPlayer.isBackground?jQuery("body").after(controls):YTPlayer.wrapper.before(controls),jQuery(window).resize(),jQuery(YTPlayer).trigger("YTPFullScreenEnd"))})}return YTPlayer.isAlone?(jQuery(document).off("mousemove.YTPlayer"),clearTimeout(YTPlayer.hideCursor),YTPlayer.overlay.css({cursor:"auto"}),real?cancelFullscreen():(videoWrapper.CSSAnimate({opacity:YTPlayer.opt.opacity},YTPlayer.opt.fadeOnStartTime),videoWrapper.css({zIndex:0})),fullScreenBtn.html(jQuery.mbYTPlayer.controls.onlyYT),YTPlayer.isAlone=!1):(jQuery(document).on("mousemove.YTPlayer",function(a){YTPlayer.overlay.css({cursor:"auto"}),clearTimeout(YTPlayer.hideCursor),jQuery(a.target).parents().is(".mb_YTPBar")||(YTPlayer.hideCursor=setTimeout(hideMouse,3e3))}),hideMouse(),real?(videoWrapper.css({opacity:0}),videoWrapper.addClass("YTPFullscreen"),launchFullscreen(videoWrapper.get(0)),setTimeout(function(){videoWrapper.CSSAnimate({opacity:1},2*YTPlayer.opt.fadeOnStartTime),videoWrapper.append(controls),jQuery(YTPlayer).optimizeDisplay(),YTPlayer.player.seekTo(YTPlayer.player.getCurrentTime()+.1,!0)},YTPlayer.opt.fadeOnStartTime)):videoWrapper.css({zIndex:1e4}).CSSAnimate({opacity:1},2*YTPlayer.opt.fadeOnStartTime),fullScreenBtn.html(jQuery.mbYTPlayer.controls.showSite),YTPlayer.isAlone=!0),this},toggleLoops:function(){var a=this.get(0),b=a.opt;return 1==b.loop?b.loop=0:(b.startAt?a.player.seekTo(b.startAt):a.player.playVideo(),b.loop=1),this},play:function(){var a=this.get(0);if(!a.isReady)return this;a.player.playVideo(),jQuery(a.playerEl).css({opacity:1}),a.wrapper.css({backgroundImage:"none"}),a.wrapper.CSSAnimate({opacity:a.isAlone?1:a.opt.opacity},a.opt.fadeOnStartTime);var b=jQuery("#controlBar_"+a.id),c=b.find(".mb_YTPPlayPause");return c.html(jQuery.mbYTPlayer.controls.pause),a.state=1,this},togglePlay:function(a){var b=this.get(0);return b.isReady?(1==b.state?this.YTPPause():this.YTPPlay(),"function"==typeof a&&a(b.state),this):this},stop:function(){var a=this.get(0);if(!a.isReady)return this;var b=jQuery("#controlBar_"+a.id),c=b.find(".mb_YTPPlayPause");return c.html(jQuery.mbYTPlayer.controls.play),a.player.stopVideo(),this},pause:function(){var a=this.get(0);return a.isReady?(a.player.pauseVideo(),a.state=2,this):this},seekTo:function(a){var b=this.get(0);return b.isReady?(b.player.seekTo(a,!0),this):this},setVolume:function(a){var b=this.get(0);return b.isReady?(b.opt.vol=a,b.player.setVolume(b.opt.vol),b.volumeBar&&b.volumeBar.length&&b.volumeBar.updateSliderVal(a),this):this},getVolume:function(){var a=this.get(0);return a.isReady?a.player.getVolume():this},toggleVolume:function(){var a=this.get(0);return a.isReady?(a.isMute?(jQuery.mbBrowser.mobile||this.YTPSetVolume(a.opt.vol),this.YTPUnmute()):this.YTPMute(),this):this},mute:function(){var a=this.get(0);if(!a.isReady)return this;if(a.isMute)return this;a.player.mute(),a.isMute=!0,a.player.setVolume(0),a.volumeBar&&a.volumeBar.length&&a.volumeBar.width()>10&&a.volumeBar.updateSliderVal(0);var b=jQuery("#controlBar_"+a.id),c=b.find(".mb_YTPMuteUnmute");c.html(jQuery.mbYTPlayer.controls.unmute),jQuery(a).addClass("isMuted"),a.volumeBar&&a.volumeBar.length&&a.volumeBar.addClass("muted");var d=jQuery.Event("YTPMuted");return d.time=a.currentTime,a.preventTrigger||jQuery(a).trigger(d),this},unmute:function(){var a=this.get(0);if(!a.isReady)return this;if(!a.isMute)return this;a.player.unMute(),a.isMute=!1,jQuery(a).YTPSetVolume(a.opt.vol),a.volumeBar&&a.volumeBar.length&&a.volumeBar.updateSliderVal(a.opt.vol>10?a.opt.vol:10);var b=jQuery("#controlBar_"+a.id),c=b.find(".mb_YTPMuteUnmute");c.html(jQuery.mbYTPlayer.controls.mute),jQuery(a).removeClass("isMuted"),a.volumeBar&&a.volumeBar.length&&a.volumeBar.removeClass("muted");var d=jQuery.Event("YTPUnmuted");return d.time=a.currentTime,a.preventTrigger||jQuery(a).trigger(d),this},applyFilter:function(a,b){var c=this,d=c.get(0);return d.isReady?(d.filters[a].value=b,void(d.filtersEnabled&&c.YTPEnableFilters())):this},applyFilters:function(a){var b=this,c=b.get(0);if(!c.isReady)return this;if(!c.isReady)return jQuery(c).on("YTPReady",function(){b.YTPApplyFilters(a)}),this;for(var d in a)b.YTPApplyFilter(d,a[d]);b.trigger("YTPFiltersApplied")},toggleFilter:function(a,b){var c=this,d=c.get(0);return d.isReady?(d.filters[a].value?d.filters[a].value=0:d.filters[a].value=b,d.filtersEnabled&&jQuery(d).YTPEnableFilters(),this):this},toggleFilters:function(a){var b=this,c=b.get(0);return c.isReady?(c.filtersEnabled?(jQuery(c).trigger("YTPDisableFilters"),jQuery(c).YTPDisableFilters()):(jQuery(c).YTPEnableFilters(),jQuery(c).trigger("YTPEnableFilters")),"function"==typeof a&&a(c.filtersEnabled),this):this},disableFilters:function(){var a=this,b=a.get(0);if(!b.isReady)return this;var c=jQuery(b.playerEl);return c.css("-webkit-filter",""),c.css("filter",""),b.filtersEnabled=!1,this},enableFilters:function(){var a=this,b=a.get(0);if(!b.isReady)return this;var c=jQuery(b.playerEl),d="";for(var e in b.filters)b.filters[e].value&&(d+=e.replace("_","-")+"("+b.filters[e].value+b.filters[e].unit+") ");return c.css("-webkit-filter",d),c.css("filter",d),b.filtersEnabled=!0,this},removeFilter:function(a,b){var c=this,d=c.get(0);if(!d.isReady)return this;if("function"==typeof a&&(b=a,a=null),a)c.YTPApplyFilter(a,0),"function"==typeof b&&b(a);else{for(var e in d.filters)c.YTPApplyFilter(e,0);"function"==typeof b&&b(e),d.filters=jQuery.extend(!0,{},jQuery.mbYTPlayer.defaultFilters)}var f=jQuery.Event("YTPFiltersApplied");return c.trigger(f),this},getFilters:function(){var a=this.get(0);return a.isReady?a.filters:this},addMask:function(a){var b=this.get(0);if(!b.isReady)return this;a||(a=b.actualMask);var c=jQuery("<img/>").attr("src",a).on("load",function(){b.overlay.CSSAnimate({opacity:0},b.opt.fadeOnStartTime,function(){b.hasMask=!0,c.remove(),b.overlay.css({backgroundImage:"url("+a+")",backgroundRepeat:"no-repeat",backgroundPosition:"center center",backgroundSize:"cover"}),b.overlay.CSSAnimate({opacity:1},b.opt.fadeOnStartTime)})});return this},removeMask:function(){var a=this.get(0);return a.isReady?(a.overlay.CSSAnimate({opacity:0},a.opt.fadeOnStartTime,function(){a.hasMask=!1,a.overlay.css({backgroundImage:"",backgroundRepeat:"",backgroundPosition:"",backgroundSize:""}),a.overlay.CSSAnimate({opacity:1},a.opt.fadeOnStartTime)}),this):this},applyMask:function(a){var b=jQuery(a);if(!a.isReady)return this;if(b.off("YTPTime.mask"),a.opt.mask)if("string"==typeof a.opt.mask)b.YTPAddMask(a.opt.mask),a.actualMask=a.opt.mask;else if("object"==typeof a.opt.mask){for(var c in a.opt.mask)if(a.opt.mask[c]){jQuery("<img/>").attr("src",a.opt.mask[c])}a.opt.mask[0]&&b.YTPAddMask(a.opt.mask[0]),b.on("YTPTime.mask",function(c){for(var d in a.opt.mask)c.time==d&&(a.opt.mask[d]?(b.YTPAddMask(a.opt.mask[d]),a.actualMask=a.opt.mask[d]):b.YTPRemoveMask())})}},toggleMask:function(){var a=this.get(0);if(!a.isReady)return this;var b=jQuery(a);return a.hasMask?b.YTPRemoveMask():b.YTPAddMask(),this},manageProgress:function(){var a=this.get(0),b=jQuery("#controlBar_"+a.id),c=b.find(".mb_YTPProgress"),d=b.find(".mb_YTPLoaded"),e=b.find(".mb_YTPseekbar"),f=c.outerWidth(),g=Math.floor(a.player.getCurrentTime()),h=Math.floor(a.player.getDuration()),i=g*f/h,j=0,k=100*a.player.getVideoLoadedFraction();return d.css({left:j,width:k+"%"}),e.css({left:0,width:i}),{totalTime:h,currentTime:g}},buildControls:function(YTPlayer){if(jQuery("#controlBar_"+YTPlayer.id).remove(),!YTPlayer.opt.showControls)return void(YTPlayer.controlBar=!1);if(YTPlayer.opt.showYTLogo=YTPlayer.opt.showYTLogo||YTPlayer.opt.printUrl,!jQuery("#controlBar_"+YTPlayer.id).length){YTPlayer.controlBar=jQuery("<span/>").attr("id","controlBar_"+YTPlayer.id).addClass("mb_YTPBar").css({whiteSpace:"noWrap",position:YTPlayer.isBackground?"fixed":"absolute",zIndex:YTPlayer.isBackground?1e4:1e3}).hide().on("click",function(a){a.stopPropagation()});var buttonBar=jQuery("<div/>").addClass("buttonBar"),playpause=jQuery("<span>"+jQuery.mbYTPlayer.controls.play+"</span>").addClass("mb_YTPPlayPause ytpicon").on("click",function(a){a.stopPropagation(),jQuery(YTPlayer).YTPTogglePlay()}),MuteUnmute=jQuery("<span>"+jQuery.mbYTPlayer.controls.mute+"</span>").addClass("mb_YTPMuteUnmute ytpicon").on("click",function(a){a.stopPropagation(),jQuery(YTPlayer).YTPToggleVolume()}),volumeBar=jQuery("<div/>").addClass("mb_YTPVolumeBar").css({display:"inline-block"});YTPlayer.volumeBar=volumeBar;var idx=jQuery("<span/>").addClass("mb_YTPTime"),vURL=YTPlayer.opt.videoURL?YTPlayer.opt.videoURL:"";vURL.indexOf("http")<0&&(vURL=jQuery.mbYTPlayer.locationProtocol+"//www.youtube.com/watch?v="+YTPlayer.opt.videoURL);var movieUrl=jQuery("<span/>").html(jQuery.mbYTPlayer.controls.ytLogo).addClass("mb_YTPUrl ytpicon").attr("title","view on YouTube").on("click",function(){window.open(vURL,"viewOnYT")}),onlyVideo=jQuery("<span/>").html(jQuery.mbYTPlayer.controls.onlyYT).addClass("mb_OnlyYT ytpicon").on("click",function(a){a.stopPropagation(),jQuery(YTPlayer).YTPFullscreen(YTPlayer.opt.realfullscreen)}),progressBar=jQuery("<div/>").addClass("mb_YTPProgress").css("position","absolute").on("click",function(a){a.stopPropagation(),timeBar.css({width:a.clientX-timeBar.offset().left}),YTPlayer.timeW=a.clientX-timeBar.offset().left,YTPlayer.controlBar.find(".mb_YTPLoaded").css({width:0});var b=Math.floor(YTPlayer.player.getDuration());YTPlayer["goto"]=timeBar.outerWidth()*b/progressBar.outerWidth(),YTPlayer.player.seekTo(parseFloat(YTPlayer["goto"]),!0),YTPlayer.controlBar.find(".mb_YTPLoaded").css({width:0})}),loadedBar=jQuery("<div/>").addClass("mb_YTPLoaded").css("position","absolute"),timeBar=jQuery("<div/>").addClass("mb_YTPseekbar").css("position","absolute");progressBar.append(loadedBar).append(timeBar),buttonBar.append(playpause).append(MuteUnmute).append(volumeBar).append(idx),YTPlayer.opt.showYTLogo&&buttonBar.append(movieUrl),(YTPlayer.isBackground||eval(YTPlayer.opt.realfullscreen)&&!YTPlayer.isBackground)&&buttonBar.append(onlyVideo),YTPlayer.controlBar.append(buttonBar).append(progressBar),YTPlayer.isBackground?jQuery("body").after(YTPlayer.controlBar):(YTPlayer.controlBar.addClass("inlinePlayer"),YTPlayer.wrapper.before(YTPlayer.controlBar)),volumeBar.simpleSlider({initialval:YTPlayer.opt.vol,scale:100,orientation:"h",callback:function(a){0==a.value?jQuery(YTPlayer).YTPMute():jQuery(YTPlayer).YTPUnmute(),YTPlayer.player.setVolume(a.value),YTPlayer.isMute||(YTPlayer.opt.vol=a.value)}})}},checkForState:function(){var YTPlayer=this.get(0),$YTPlayer=jQuery(YTPlayer);clearInterval(YTPlayer.getState);var interval=100;return jQuery.contains(document,YTPlayer)?(jQuery.mbYTPlayer.checkForStart(YTPlayer),void(YTPlayer.getState=setInterval(function(){var $YTPlayer=jQuery(YTPlayer);if(YTPlayer.isReady){var prog=jQuery(YTPlayer).YTPManageProgress(),stopAt=YTPlayer.opt.stopAt>YTPlayer.opt.startAt?YTPlayer.opt.stopAt:0;if(stopAt=stopAt<YTPlayer.player.getDuration()?stopAt:0,YTPlayer.currentTime!=prog.currentTime){var YTPEvent=jQuery.Event("YTPTime");YTPEvent.time=YTPlayer.currentTime,jQuery(YTPlayer).trigger(YTPEvent)}if(YTPlayer.currentTime=prog.currentTime,YTPlayer.totalTime=YTPlayer.player.getDuration(),0==YTPlayer.player.getVolume()?$YTPlayer.addClass("isMuted"):$YTPlayer.removeClass("isMuted"),YTPlayer.opt.showControls&&(prog.totalTime?YTPlayer.controlBar.find(".mb_YTPTime").html(jQuery.mbYTPlayer.formatTime(prog.currentTime)+" / "+jQuery.mbYTPlayer.formatTime(prog.totalTime)):YTPlayer.controlBar.find(".mb_YTPTime").html("-- : -- / -- : --")),eval(YTPlayer.opt.stopMovieOnBlur)&&(document.hasFocus()?document.hasFocus()&&!YTPlayer.hasFocus&&-1!=YTPlayer.state&&0!=YTPlayer.state&&(YTPlayer.hasFocus=!0,YTPlayer.preventTrigger=!0,YTPlayer.preventTrigger=!0,$YTPlayer.YTPPlay()):1==YTPlayer.state&&(YTPlayer.hasFocus=!1,YTPlayer.preventTrigger=!0,$YTPlayer.YTPPause())),YTPlayer.opt.playOnlyIfVisible){var isOnScreen=jQuery.mbYTPlayer.isOnScreen(YTPlayer,YTPlayer.opt.onScreenPercentage);isOnScreen||1!=YTPlayer.state?isOnScreen&&!YTPlayer.isOnScreen&&(YTPlayer.isOnScreen=!0,YTPlayer.player.playVideo()):(YTPlayer.isOnScreen=!1,$YTPlayer.YTPPause())}if(YTPlayer.controlBar.length&&YTPlayer.controlBar.outerWidth()<=400&&!YTPlayer.isCompact?(YTPlayer.controlBar.addClass("compact"),YTPlayer.isCompact=!0,!YTPlayer.isMute&&YTPlayer.volumeBar&&YTPlayer.volumeBar.updateSliderVal(YTPlayer.opt.vol)):YTPlayer.controlBar.length&&YTPlayer.controlBar.outerWidth()>400&&YTPlayer.isCompact&&(YTPlayer.controlBar.removeClass("compact"),YTPlayer.isCompact=!1,!YTPlayer.isMute&&YTPlayer.volumeBar&&YTPlayer.volumeBar.updateSliderVal(YTPlayer.opt.vol)),YTPlayer.player.getPlayerState()>0&&(parseFloat(YTPlayer.player.getDuration()-.5)<YTPlayer.player.getCurrentTime()||stopAt>0&&parseFloat(YTPlayer.player.getCurrentTime())>stopAt)){if(YTPlayer.isEnded)return;if(YTPlayer.isEnded=!0,setTimeout(function(){YTPlayer.isEnded=!1},1e3),YTPlayer.isList){if(!YTPlayer.opt.loop||YTPlayer.opt.loop>0&&YTPlayer.player.loopTime===YTPlayer.opt.loop-1){YTPlayer.player.loopTime=void 0,clearInterval(YTPlayer.getState);var YTPEnd=jQuery.Event("YTPEnd");return YTPEnd.time=YTPlayer.currentTime,void jQuery(YTPlayer).trigger(YTPEnd)}}else if(!YTPlayer.opt.loop||YTPlayer.opt.loop>0&&YTPlayer.player.loopTime===YTPlayer.opt.loop-1){YTPlayer.player.loopTime=void 0,YTPlayer.state=2;var bgndURL=YTPlayer.opt.coverImage?"url("+YTPlayer.opt.coverImage+") center center":YTPlayer.orig_containment_background;return YTPlayer.opt.containment.css({background:bgndURL,backgroundSize:"cover"}),jQuery(YTPlayer).YTPPause(),void YTPlayer.wrapper.CSSAnimate({opacity:0},YTPlayer.opt.fadeOnStartTime,function(){YTPlayer.controlBar.length&&YTPlayer.controlBar.find(".mb_YTPPlayPause").html(jQuery.mbYTPlayer.controls.play);
var a=jQuery.Event("YTPEnd");a.time=YTPlayer.currentTime,jQuery(YTPlayer).trigger(a),YTPlayer.player.seekTo(YTPlayer.opt.startAt,!0);var b=YTPlayer.opt.coverImage?"url("+YTPlayer.opt.coverImage+") center center":YTPlayer.orig_containment_background;YTPlayer.opt.containment.css({background:b,backgroundSize:"cover"})})}YTPlayer.player.loopTime=YTPlayer.player.loopTime?++YTPlayer.player.loopTime:1,YTPlayer.opt.startAt=YTPlayer.opt.startAt||1,YTPlayer.preventTrigger=!0,YTPlayer.state=2,YTPlayer.player.pauseVideo(),YTPlayer.player.seekTo(YTPlayer.opt.startAt,!0),YTPlayer.player.playVideo()}}},interval))):($YTPlayer.YTPPlayerDestroy(),clearInterval(YTPlayer.getState),void clearInterval(YTPlayer.checkForStartAt))},checkForStart:function(YTPlayer){var $YTPlayer=jQuery(YTPlayer);if(!jQuery.contains(document,YTPlayer))return void $YTPlayer.YTPPlayerDestroy();if(jQuery.mbYTPlayer.buildControls(YTPlayer),YTPlayer.overlay)if(YTPlayer.opt.addRaster){var classN="dot"==YTPlayer.opt.addRaster?"raster-dot":"raster";YTPlayer.overlay.addClass(YTPlayer.isRetina?classN+" retina":classN)}else YTPlayer.overlay.removeClass(function(a,b){var c=b.split(" "),d=[];return jQuery.each(c,function(a,b){/raster.*/.test(b)&&d.push(b)}),d.push("retina"),d.join(" ")});YTPlayer.preventTrigger=!0,YTPlayer.state=2,$YTPlayer.YTPPause(),$YTPlayer.YTPMute(),YTPlayer.preventTrigger=!0,YTPlayer.player.playVideo(),YTPlayer.isStarting=!0;var startAt=YTPlayer.start_from_last?YTPlayer.start_from_last:YTPlayer.opt.startAt?YTPlayer.opt.startAt:1;return YTPlayer.checkForStartAt=setInterval(function(){YTPlayer.player.seekTo(startAt,!0);var canPlayVideo=YTPlayer.player.getVideoLoadedFraction()>=startAt/YTPlayer.player.getDuration();if(YTPlayer.player.getDuration()>0&&YTPlayer.player.getCurrentTime()>=startAt&&canPlayVideo){YTPlayer.start_from_last=null,clearInterval(YTPlayer.checkForStartAt),"function"==typeof YTPlayer.opt.onReady&&YTPlayer.opt.onReady(YTPlayer),YTPlayer.isReady=!0,$YTPlayer.YTPRemoveFilter(),YTPlayer.opt.addFilters?$YTPlayer.YTPApplyFilters(YTPlayer.opt.addFilters):$YTPlayer.YTPApplyFilters({}),$YTPlayer.YTPEnableFilters();var YTPready=jQuery.Event("YTPReady");if(YTPready.time=YTPlayer.currentTime,jQuery(YTPlayer).trigger(YTPready),YTPlayer.state=2,jQuery(YTPlayer).YTPPause(),YTPlayer.opt.mute||jQuery(YTPlayer).YTPUnmute(),"undefined"!=typeof _gaq&&eval(YTPlayer.opt.gaTrack)?_gaq.push(["_trackEvent","YTPlayer","Play",YTPlayer.hasData?YTPlayer.videoData.title:YTPlayer.videoID.toString()]):"undefined"!=typeof ga&&eval(YTPlayer.opt.gaTrack)&&ga("send","event","YTPlayer","play",YTPlayer.hasData?YTPlayer.videoData.title:YTPlayer.videoID.toString()),YTPlayer.opt.autoPlay){var YTPStart=jQuery.Event("YTPStart");YTPStart.time=YTPlayer.currentTime,jQuery(YTPlayer).trigger(YTPStart),YTPlayer.isStarting=!1,"mac"==jQuery.mbBrowser.os.name&&jQuery.mbBrowser.safari?setTimeout(function(){$YTPlayer.YTPPlay()},10):$YTPlayer.YTPPlay()}else YTPlayer.player.pauseVideo(),setTimeout(function(){YTPlayer.start_from_last&&YTPlayer.player.seekTo(startAt,!0),YTPlayer.isPlayer||(YTPlayer.opt.coverImage?(YTPlayer.wrapper.css({opacity:0}),setTimeout(function(){var a=YTPlayer.opt.coverImage?"url("+YTPlayer.opt.coverImage+") center center":YTPlayer.orig_containment_background;YTPlayer.wrapper.css({background:a,backgroundSize:"cover",backgroundRepeat:"no-repeat"})},YTPlayer.opt.fadeOnStartTime)):(jQuery(YTPlayer.playerEl).CSSAnimate({opacity:1},YTPlayer.opt.fadeOnStartTime),YTPlayer.wrapper.CSSAnimate({opacity:YTPlayer.isAlone?1:YTPlayer.opt.opacity},YTPlayer.opt.fadeOnStartTime))),YTPlayer.isStarting=!1},150),YTPlayer.controlBar.length&&YTPlayer.controlBar.find(".mb_YTPPlayPause").html(jQuery.mbYTPlayer.controls.play);YTPlayer.isPlayer&&!YTPlayer.opt.autoPlay&&YTPlayer.loading&&YTPlayer.loading.length&&(YTPlayer.loading.html("Ready"),setTimeout(function(){YTPlayer.loading.fadeOut()},100)),YTPlayer.controlBar&&YTPlayer.controlBar.length&&YTPlayer.controlBar.slideDown(1e3)}else"mac"==jQuery.mbBrowser.os.name&&jQuery.mbBrowser.safari&&(YTPlayer.player.playVideo(),startAt>=0&&YTPlayer.player.seekTo(startAt,!0))},100),$YTPlayer},getTime:function(){var a=this.get(0);return jQuery.mbYTPlayer.formatTime(a.currentTime)},getTotalTime:function(a){var b=this.get(0);return jQuery.mbYTPlayer.formatTime(b.totalTime)},formatTime:function(a){var b=Math.floor(a/60),c=Math.floor(a-60*b);return(9>=b?"0"+b:b)+" : "+(9>=c?"0"+c:c)},setAnchor:function(a){var b=this;b.optimizeDisplay(a)},getAnchor:function(){var a=this.get(0);return a.opt.anchor}},jQuery.fn.optimizeDisplay=function(anchor){var YTPlayer=this.get(0),vid={};YTPlayer.opt.anchor=anchor||YTPlayer.opt.anchor,YTPlayer.opt.anchor="undefined "!=typeof YTPlayer.opt.anchor?YTPlayer.opt.anchor:"center,center";var YTPAlign=YTPlayer.opt.anchor.split(","),el=YTPlayer.wrapper,iframe=jQuery(YTPlayer.playerEl);if(YTPlayer.opt.optimizeDisplay){var abundance=iframe.height()*YTPlayer.opt.abundance,win={};win.width=el.outerWidth(),win.height=el.outerHeight()+abundance,YTPlayer.opt.ratio="auto"===YTPlayer.opt.ratio?16/9:YTPlayer.opt.ratio,YTPlayer.opt.ratio=eval(YTPlayer.opt.ratio),vid.width=win.width,vid.height=Math.ceil(vid.width/YTPlayer.opt.ratio),vid.marginTop=Math.ceil(-((vid.height-win.height)/2)),vid.marginLeft=0;var lowest=vid.height<win.height;lowest&&(vid.height=win.height,vid.width=Math.ceil(vid.height*YTPlayer.opt.ratio),vid.marginTop=0,vid.marginLeft=Math.ceil(-((vid.width-win.width)/2)));for(var a in YTPAlign)if(YTPAlign.hasOwnProperty(a)){var al=YTPAlign[a].replace(/ /g,"");switch(al){case"top":vid.marginTop=lowest?-((vid.height-win.height)/2):0;break;case"bottom":vid.marginTop=lowest?0:-(vid.height-win.height);break;case"left":vid.marginLeft=0;break;case"right":vid.marginLeft=lowest?-(vid.width-win.width):0;break;default:vid.width>win.width&&(vid.marginLeft=-((vid.width-win.width)/2))}}}else vid.width="100%",vid.height="100%",vid.marginTop=0,vid.marginLeft=0;iframe.css({width:vid.width,height:vid.height,marginTop:vid.marginTop,marginLeft:vid.marginLeft,maxWidth:"initial"})},jQuery.shuffle=function(a){for(var b=a.slice(),c=b.length,d=c;d--;){var e=parseInt(Math.random()*c),f=b[d];b[d]=b[e],b[e]=f}return b},jQuery.fn.unselectable=function(){return this.each(function(){jQuery(this).css({"-moz-user-select":"none","-webkit-user-select":"none","user-select":"none"}).attr("unselectable","on")})},jQuery.fn.YTPlayer=jQuery.mbYTPlayer.buildPlayer,jQuery.fn.mb_YTPlayer=jQuery.mbYTPlayer.buildPlayer,jQuery.fn.YTPCheckForState=jQuery.mbYTPlayer.checkForState,jQuery.fn.YTPGetPlayer=jQuery.mbYTPlayer.getPlayer,jQuery.fn.YTPGetVideoID=jQuery.mbYTPlayer.getVideoID,jQuery.fn.YTPGetPlaylistID=jQuery.mbYTPlayer.getPlaylistID,jQuery.fn.YTPChangeVideo=jQuery.fn.YTPChangeMovie=jQuery.mbYTPlayer.changeVideo,jQuery.fn.YTPPlayerDestroy=jQuery.mbYTPlayer.playerDestroy,jQuery.fn.YTPPlay=jQuery.mbYTPlayer.play,jQuery.fn.YTPTogglePlay=jQuery.mbYTPlayer.togglePlay,jQuery.fn.YTPStop=jQuery.mbYTPlayer.stop,jQuery.fn.YTPPause=jQuery.mbYTPlayer.pause,jQuery.fn.YTPSeekTo=jQuery.mbYTPlayer.seekTo,jQuery.fn.YTPlaylist=jQuery.mbYTPlayer.playlist,jQuery.fn.YTPPlayNext=jQuery.mbYTPlayer.playNext,jQuery.fn.YTPPlayPrev=jQuery.mbYTPlayer.playPrev,jQuery.fn.YTPPlayIndex=jQuery.mbYTPlayer.playIndex,jQuery.fn.YTPMute=jQuery.mbYTPlayer.mute,jQuery.fn.YTPUnmute=jQuery.mbYTPlayer.unmute,jQuery.fn.YTPToggleVolume=jQuery.mbYTPlayer.toggleVolume,jQuery.fn.YTPSetVolume=jQuery.mbYTPlayer.setVolume,jQuery.fn.YTPGetVolume=jQuery.mbYTPlayer.getVolume,jQuery.fn.YTPGetVideoData=jQuery.mbYTPlayer.getVideoData,jQuery.fn.YTPFullscreen=jQuery.mbYTPlayer.fullscreen,jQuery.fn.YTPToggleLoops=jQuery.mbYTPlayer.toggleLoops,jQuery.fn.YTPSetVideoQuality=jQuery.mbYTPlayer.setVideoQuality,jQuery.fn.YTPManageProgress=jQuery.mbYTPlayer.manageProgress,jQuery.fn.YTPApplyFilter=jQuery.mbYTPlayer.applyFilter,jQuery.fn.YTPApplyFilters=jQuery.mbYTPlayer.applyFilters,jQuery.fn.YTPToggleFilter=jQuery.mbYTPlayer.toggleFilter,jQuery.fn.YTPToggleFilters=jQuery.mbYTPlayer.toggleFilters,jQuery.fn.YTPRemoveFilter=jQuery.mbYTPlayer.removeFilter,jQuery.fn.YTPDisableFilters=jQuery.mbYTPlayer.disableFilters,jQuery.fn.YTPEnableFilters=jQuery.mbYTPlayer.enableFilters,jQuery.fn.YTPGetFilters=jQuery.mbYTPlayer.getFilters,jQuery.fn.YTPGetTime=jQuery.mbYTPlayer.getTime,jQuery.fn.YTPGetTotalTime=jQuery.mbYTPlayer.getTotalTime,jQuery.fn.YTPAddMask=jQuery.mbYTPlayer.addMask,jQuery.fn.YTPRemoveMask=jQuery.mbYTPlayer.removeMask,jQuery.fn.YTPToggleMask=jQuery.mbYTPlayer.toggleMask,jQuery.fn.YTPSetAnchor=jQuery.mbYTPlayer.setAnchor,jQuery.fn.YTPGetAnchor=jQuery.mbYTPlayer.getAnchor}(jQuery,ytp),jQuery.support.CSStransition=function(){var a=(document.body||document.documentElement).style;return void 0!==a.transition||void 0!==a.WebkitTransition||void 0!==a.MozTransition||void 0!==a.MsTransition||void 0!==a.OTransition}(),jQuery.CSS={name:"mb.CSSAnimate",author:"Matteo Bicocchi",version:"2.0.0",transitionEnd:"transitionEnd",sfx:"",filters:{blur:{min:0,max:100,unit:"px"},brightness:{min:0,max:400,unit:"%"},contrast:{min:0,max:400,unit:"%"},grayscale:{min:0,max:100,unit:"%"},hueRotate:{min:0,max:360,unit:"deg"},invert:{min:0,max:100,unit:"%"},saturate:{min:0,max:400,unit:"%"},sepia:{min:0,max:100,unit:"%"}},normalizeCss:function(a){var b=jQuery.extend(!0,{},a);jQuery.browser.webkit||jQuery.browser.opera?jQuery.CSS.sfx="-webkit-":jQuery.browser.mozilla?jQuery.CSS.sfx="-moz-":jQuery.browser.msie&&(jQuery.CSS.sfx="-ms-"),jQuery.CSS.sfx="";for(var c in b){if("transform"===c&&(b[jQuery.CSS.sfx+"transform"]=b[c],delete b[c]),"transform-origin"===c&&(b[jQuery.CSS.sfx+"transform-origin"]=a[c],delete b[c]),"filter"!==c||jQuery.browser.mozilla||(b[jQuery.CSS.sfx+"filter"]=a[c],delete b[c]),"blur"===c&&setFilter(b,"blur",a[c]),"brightness"===c&&setFilter(b,"brightness",a[c]),"contrast"===c&&setFilter(b,"contrast",a[c]),"grayscale"===c&&setFilter(b,"grayscale",a[c]),"hueRotate"===c&&setFilter(b,"hueRotate",a[c]),"invert"===c&&setFilter(b,"invert",a[c]),"saturate"===c&&setFilter(b,"saturate",a[c]),"sepia"===c&&setFilter(b,"sepia",a[c]),"x"===c){var d=jQuery.CSS.sfx+"transform";b[d]=b[d]||"",b[d]+=" translateX("+setUnit(a[c],"px")+")",delete b[c]}"y"===c&&(d=jQuery.CSS.sfx+"transform",b[d]=b[d]||"",b[d]+=" translateY("+setUnit(a[c],"px")+")",delete b[c]),"z"===c&&(d=jQuery.CSS.sfx+"transform",b[d]=b[d]||"",b[d]+=" translateZ("+setUnit(a[c],"px")+")",delete b[c]),"rotate"===c&&(d=jQuery.CSS.sfx+"transform",b[d]=b[d]||"",b[d]+=" rotate("+setUnit(a[c],"deg")+")",delete b[c]),"rotateX"===c&&(d=jQuery.CSS.sfx+"transform",b[d]=b[d]||"",b[d]+=" rotateX("+setUnit(a[c],"deg")+")",delete b[c]),"rotateY"===c&&(d=jQuery.CSS.sfx+"transform",b[d]=b[d]||"",b[d]+=" rotateY("+setUnit(a[c],"deg")+")",delete b[c]),"rotateZ"===c&&(d=jQuery.CSS.sfx+"transform",b[d]=b[d]||"",b[d]+=" rotateZ("+setUnit(a[c],"deg")+")",delete b[c]),"scale"===c&&(d=jQuery.CSS.sfx+"transform",b[d]=b[d]||"",b[d]+=" scale("+setUnit(a[c],"")+")",delete b[c]),"scaleX"===c&&(d=jQuery.CSS.sfx+"transform",b[d]=b[d]||"",b[d]+=" scaleX("+setUnit(a[c],"")+")",delete b[c]),"scaleY"===c&&(d=jQuery.CSS.sfx+"transform",b[d]=b[d]||"",b[d]+=" scaleY("+setUnit(a[c],"")+")",delete b[c]),"scaleZ"===c&&(d=jQuery.CSS.sfx+"transform",b[d]=b[d]||"",b[d]+=" scaleZ("+setUnit(a[c],"")+")",delete b[c]),"skew"===c&&(d=jQuery.CSS.sfx+"transform",b[d]=b[d]||"",b[d]+=" skew("+setUnit(a[c],"deg")+")",delete b[c]),"skewX"===c&&(d=jQuery.CSS.sfx+"transform",b[d]=b[d]||"",b[d]+=" skewX("+setUnit(a[c],"deg")+")",delete b[c]),"skewY"===c&&(d=jQuery.CSS.sfx+"transform",b[d]=b[d]||"",b[d]+=" skewY("+setUnit(a[c],"deg")+")",delete b[c]),"perspective"===c&&(d=jQuery.CSS.sfx+"transform",b[d]=b[d]||"",b[d]+=" perspective("+setUnit(a[c],"px")+")",delete b[c])}return b},getProp:function(a){var b,c=[];for(b in a)0>c.indexOf(b)&&c.push(uncamel(b));return c.join(",")},animate:function(a,b,c,d,e){return this.each(function(){function f(){g.called=!0,g.CSSAIsRunning=!1,h.off(jQuery.CSS.transitionEnd+"."+g.id),clearTimeout(g.timeout),h.css(jQuery.CSS.sfx+"transition",""),"function"==typeof e&&e.apply(g),"function"==typeof g.CSSqueue&&(g.CSSqueue(),g.CSSqueue=null)}var g=this,h=jQuery(this);g.id=g.id||"CSSA_"+(new Date).getTime();var i=i||{type:"noEvent"};if(g.CSSAIsRunning&&g.eventType==i.type&&!jQuery.browser.msie&&9>=jQuery.browser.version)g.CSSqueue=function(){h.CSSAnimate(a,b,c,d,e)};else if(g.CSSqueue=null,g.eventType=i.type,0!==h.length&&a){if(a=jQuery.normalizeCss(a),g.CSSAIsRunning=!0,"function"==typeof b&&(e=b,b=jQuery.fx.speeds._default),"function"==typeof c&&(d=c,c=0),"string"==typeof c&&(e=c,c=0),"function"==typeof d&&(e=d,d="cubic-bezier(0.65,0.03,0.36,0.72)"),"string"==typeof b)for(var j in jQuery.fx.speeds){if(b==j){b=jQuery.fx.speeds[j];break}b=jQuery.fx.speeds._default}if(b||(b=jQuery.fx.speeds._default),"string"==typeof e&&(d=e,e=null),jQuery.support.CSStransition){var k={"default":"ease","in":"ease-in",out:"ease-out","in-out":"ease-in-out",snap:"cubic-bezier(0,1,.5,1)",easeOutCubic:"cubic-bezier(.215,.61,.355,1)",easeInOutCubic:"cubic-bezier(.645,.045,.355,1)",easeInCirc:"cubic-bezier(.6,.04,.98,.335)",easeOutCirc:"cubic-bezier(.075,.82,.165,1)",easeInOutCirc:"cubic-bezier(.785,.135,.15,.86)",easeInExpo:"cubic-bezier(.95,.05,.795,.035)",easeOutExpo:"cubic-bezier(.19,1,.22,1)",easeInOutExpo:"cubic-bezier(1,0,0,1)",easeInQuad:"cubic-bezier(.55,.085,.68,.53)",easeOutQuad:"cubic-bezier(.25,.46,.45,.94)",easeInOutQuad:"cubic-bezier(.455,.03,.515,.955)",easeInQuart:"cubic-bezier(.895,.03,.685,.22)",easeOutQuart:"cubic-bezier(.165,.84,.44,1)",easeInOutQuart:"cubic-bezier(.77,0,.175,1)",easeInQuint:"cubic-bezier(.755,.05,.855,.06)",easeOutQuint:"cubic-bezier(.23,1,.32,1)",easeInOutQuint:"cubic-bezier(.86,0,.07,1)",easeInSine:"cubic-bezier(.47,0,.745,.715)",easeOutSine:"cubic-bezier(.39,.575,.565,1)",easeInOutSine:"cubic-bezier(.445,.05,.55,.95)",easeInBack:"cubic-bezier(.6,-.28,.735,.045)",easeOutBack:"cubic-bezier(.175, .885,.32,1.275)",easeInOutBack:"cubic-bezier(.68,-.55,.265,1.55)"};k[d]&&(d=k[d]),h.off(jQuery.CSS.transitionEnd+"."+g.id),k=jQuery.CSS.getProp(a);var l={};jQuery.extend(l,a),l[jQuery.CSS.sfx+"transition-property"]=k,l[jQuery.CSS.sfx+"transition-duration"]=b+"ms",l[jQuery.CSS.sfx+"transition-delay"]=c+"ms",l[jQuery.CSS.sfx+"transition-timing-function"]=d,setTimeout(function(){h.one(jQuery.CSS.transitionEnd+"."+g.id,f),h.css(l)},1),g.timeout=setTimeout(function(){g.called||!e?(g.called=!1,g.CSSAIsRunning=!1):(h.css(jQuery.CSS.sfx+"transition",""),e.apply(g),g.CSSAIsRunning=!1,"function"==typeof g.CSSqueue&&(g.CSSqueue(),g.CSSqueue=null))},b+c+10)}else{for(k in a)"transform"===k&&delete a[k],"filter"===k&&delete a[k],"transform-origin"===k&&delete a[k],"auto"===a[k]&&delete a[k],"x"===k&&(i=a[k],j="left",a[j]=i,delete a[k]),"y"===k&&(i=a[k],j="top",a[j]=i,delete a[k]),"-ms-transform"!==k&&"-ms-filter"!==k||delete a[k];h.delay(c).animate(a,b,e)}}})}},jQuery.fn.CSSAnimate=jQuery.CSS.animate,jQuery.normalizeCss=jQuery.CSS.normalizeCss,jQuery.fn.css3=function(a){return this.each(function(){var b=jQuery(this),c=jQuery.normalizeCss(a);b.css(c)})};var nAgt=navigator.userAgent;jQuery.browser=jQuery.browser||{},jQuery.browser.mozilla=!1,jQuery.browser.webkit=!1,jQuery.browser.opera=!1,jQuery.browser.safari=!1,jQuery.browser.chrome=!1,jQuery.browser.androidStock=!1,jQuery.browser.msie=!1,jQuery.browser.edge=!1,jQuery.browser.ua=nAgt;var getOS=function(){var a={version:"Unknown version",name:"Unknown OS"};return-1!=navigator.appVersion.indexOf("Win")&&(a.name="Windows"),-1!=navigator.appVersion.indexOf("Mac")&&0>navigator.appVersion.indexOf("Mobile")&&(a.name="Mac"),-1!=navigator.appVersion.indexOf("Linux")&&(a.name="Linux"),/Mac OS X/.test(nAgt)&&!/Mobile/.test(nAgt)&&(a.version=/Mac OS X (10[\.\_\d]+)/.exec(nAgt)[1],a.version=a.version.replace(/_/g,".").substring(0,5)),/Windows/.test(nAgt)&&(a.version="Unknown.Unknown"),/Windows NT 5.1/.test(nAgt)&&(a.version="5.1"),/Windows NT 6.0/.test(nAgt)&&(a.version="6.0"),/Windows NT 6.1/.test(nAgt)&&(a.version="6.1"),/Windows NT 6.2/.test(nAgt)&&(a.version="6.2"),/Windows NT 10.0/.test(nAgt)&&(a.version="10.0"),/Linux/.test(nAgt)&&/Linux/.test(nAgt)&&(a.version="Unknown.Unknown"),a.name=a.name.toLowerCase(),a.major_version="Unknown",a.minor_version="Unknown","Unknown.Unknown"!=a.version&&(a.major_version=parseFloat(a.version.split(".")[0]),a.minor_version=parseFloat(a.version.split(".")[1])),a};jQuery.browser.os=getOS(),jQuery.browser.hasTouch=isTouchSupported(),jQuery.browser.name=navigator.appName,jQuery.browser.fullVersion=""+parseFloat(navigator.appVersion),jQuery.browser.majorVersion=parseInt(navigator.appVersion,10);var nameOffset,verOffset,ix;if(-1!=(verOffset=nAgt.indexOf("Opera")))jQuery.browser.opera=!0,jQuery.browser.name="Opera",jQuery.browser.fullVersion=nAgt.substring(verOffset+6),-1!=(verOffset=nAgt.indexOf("Version"))&&(jQuery.browser.fullVersion=nAgt.substring(verOffset+8));else if(-1!=(verOffset=nAgt.indexOf("OPR")))jQuery.browser.opera=!0,jQuery.browser.name="Opera",jQuery.browser.fullVersion=nAgt.substring(verOffset+4);else if(-1!=(verOffset=nAgt.indexOf("MSIE")))jQuery.browser.msie=!0,jQuery.browser.name="Microsoft Internet Explorer",jQuery.browser.fullVersion=nAgt.substring(verOffset+5);else if(-1!=nAgt.indexOf("Trident")){jQuery.browser.msie=!0,jQuery.browser.name="Microsoft Internet Explorer";var start=nAgt.indexOf("rv:")+3,end=start+4;jQuery.browser.fullVersion=nAgt.substring(start,end)}else-1!=(verOffset=nAgt.indexOf("Edge"))?(jQuery.browser.edge=!0,jQuery.browser.name="Microsoft Edge",jQuery.browser.fullVersion=nAgt.substring(verOffset+5)):-1!=(verOffset=nAgt.indexOf("Chrome"))?(jQuery.browser.webkit=!0,jQuery.browser.chrome=!0,jQuery.browser.name="Chrome",jQuery.browser.fullVersion=nAgt.substring(verOffset+7)):-1<nAgt.indexOf("mozilla/5.0")&&-1<nAgt.indexOf("android ")&&-1<nAgt.indexOf("applewebkit")&&!(-1<nAgt.indexOf("chrome"))?(verOffset=nAgt.indexOf("Chrome"),jQuery.browser.webkit=!0,jQuery.browser.androidStock=!0,jQuery.browser.name="androidStock",jQuery.browser.fullVersion=nAgt.substring(verOffset+7)):-1!=(verOffset=nAgt.indexOf("Safari"))?(jQuery.browser.webkit=!0,jQuery.browser.safari=!0,jQuery.browser.name="Safari",jQuery.browser.fullVersion=nAgt.substring(verOffset+7),-1!=(verOffset=nAgt.indexOf("Version"))&&(jQuery.browser.fullVersion=nAgt.substring(verOffset+8))):-1!=(verOffset=nAgt.indexOf("AppleWebkit"))?(jQuery.browser.webkit=!0,jQuery.browser.safari=!0,jQuery.browser.name="Safari",jQuery.browser.fullVersion=nAgt.substring(verOffset+7),-1!=(verOffset=nAgt.indexOf("Version"))&&(jQuery.browser.fullVersion=nAgt.substring(verOffset+8))):-1!=(verOffset=nAgt.indexOf("Firefox"))?(jQuery.browser.mozilla=!0,jQuery.browser.name="Firefox",jQuery.browser.fullVersion=nAgt.substring(verOffset+8)):(nameOffset=nAgt.lastIndexOf(" ")+1)<(verOffset=nAgt.lastIndexOf("/"))&&(jQuery.browser.name=nAgt.substring(nameOffset,verOffset),jQuery.browser.fullVersion=nAgt.substring(verOffset+1),jQuery.browser.name.toLowerCase()==jQuery.browser.name.toUpperCase()&&(jQuery.browser.name=navigator.appName));-1!=(ix=jQuery.browser.fullVersion.indexOf(";"))&&(jQuery.browser.fullVersion=jQuery.browser.fullVersion.substring(0,ix)),-1!=(ix=jQuery.browser.fullVersion.indexOf(" "))&&(jQuery.browser.fullVersion=jQuery.browser.fullVersion.substring(0,ix)),jQuery.browser.majorVersion=parseInt(""+jQuery.browser.fullVersion,10),isNaN(jQuery.browser.majorVersion)&&(jQuery.browser.fullVersion=""+parseFloat(navigator.appVersion),jQuery.browser.majorVersion=parseInt(navigator.appVersion,10)),jQuery.browser.version=jQuery.browser.majorVersion,jQuery.browser.android=/Android/i.test(nAgt),jQuery.browser.blackberry=/BlackBerry|BB|PlayBook/i.test(nAgt),jQuery.browser.ios=/iPhone|iPad|iPod|webOS/i.test(nAgt),jQuery.browser.operaMobile=/Opera Mini/i.test(nAgt),jQuery.browser.windowsMobile=/IEMobile|Windows Phone/i.test(nAgt),jQuery.browser.kindle=/Kindle|Silk/i.test(nAgt),jQuery.browser.mobile=jQuery.browser.android||jQuery.browser.blackberry||jQuery.browser.ios||jQuery.browser.windowsMobile||jQuery.browser.operaMobile||jQuery.browser.kindle,jQuery.isMobile=jQuery.browser.mobile,jQuery.isTablet=jQuery.browser.mobile&&765<jQuery(window).width(),jQuery.isAndroidDefault=jQuery.browser.android&&!/chrome/i.test(nAgt),jQuery.mbBrowser=jQuery.browser,jQuery.browser.versionCompare=function(a,b){if("stringstring"!=typeof a+typeof b)return!1;for(var c=a.split("."),d=b.split("."),e=0,f=Math.max(c.length,d.length);f>e;e++){if(c[e]&&!d[e]&&0<parseInt(c[e])||parseInt(c[e])>parseInt(d[e]))return 1;if(d[e]&&!c[e]&&0<parseInt(d[e])||parseInt(c[e])<parseInt(d[e]))return-1}return 0};var nAgt=navigator.userAgent;jQuery.browser=jQuery.browser||{},jQuery.browser.mozilla=!1,jQuery.browser.webkit=!1,jQuery.browser.opera=!1,jQuery.browser.safari=!1,jQuery.browser.chrome=!1,jQuery.browser.androidStock=!1,jQuery.browser.msie=!1,jQuery.browser.edge=!1,jQuery.browser.ua=nAgt;var getOS=function(){var a={version:"Unknown version",name:"Unknown OS"};return-1!=navigator.appVersion.indexOf("Win")&&(a.name="Windows"),-1!=navigator.appVersion.indexOf("Mac")&&0>navigator.appVersion.indexOf("Mobile")&&(a.name="Mac"),-1!=navigator.appVersion.indexOf("Linux")&&(a.name="Linux"),/Mac OS X/.test(nAgt)&&!/Mobile/.test(nAgt)&&(a.version=/Mac OS X (10[\.\_\d]+)/.exec(nAgt)[1],a.version=a.version.replace(/_/g,".").substring(0,5)),/Windows/.test(nAgt)&&(a.version="Unknown.Unknown"),/Windows NT 5.1/.test(nAgt)&&(a.version="5.1"),/Windows NT 6.0/.test(nAgt)&&(a.version="6.0"),/Windows NT 6.1/.test(nAgt)&&(a.version="6.1"),/Windows NT 6.2/.test(nAgt)&&(a.version="6.2"),/Windows NT 10.0/.test(nAgt)&&(a.version="10.0"),/Linux/.test(nAgt)&&/Linux/.test(nAgt)&&(a.version="Unknown.Unknown"),a.name=a.name.toLowerCase(),a.major_version="Unknown",a.minor_version="Unknown","Unknown.Unknown"!=a.version&&(a.major_version=parseFloat(a.version.split(".")[0]),a.minor_version=parseFloat(a.version.split(".")[1])),a};jQuery.browser.os=getOS(),jQuery.browser.hasTouch=isTouchSupported(),jQuery.browser.name=navigator.appName,jQuery.browser.fullVersion=""+parseFloat(navigator.appVersion),jQuery.browser.majorVersion=parseInt(navigator.appVersion,10);var nameOffset,verOffset,ix;if(-1!=(verOffset=nAgt.indexOf("Opera")))jQuery.browser.opera=!0,jQuery.browser.name="Opera",jQuery.browser.fullVersion=nAgt.substring(verOffset+6),-1!=(verOffset=nAgt.indexOf("Version"))&&(jQuery.browser.fullVersion=nAgt.substring(verOffset+8));else if(-1!=(verOffset=nAgt.indexOf("OPR")))jQuery.browser.opera=!0,jQuery.browser.name="Opera",jQuery.browser.fullVersion=nAgt.substring(verOffset+4);else if(-1!=(verOffset=nAgt.indexOf("MSIE")))jQuery.browser.msie=!0,jQuery.browser.name="Microsoft Internet Explorer",jQuery.browser.fullVersion=nAgt.substring(verOffset+5);else if(-1!=nAgt.indexOf("Trident")){jQuery.browser.msie=!0,jQuery.browser.name="Microsoft Internet Explorer";var start=nAgt.indexOf("rv:")+3,end=start+4;jQuery.browser.fullVersion=nAgt.substring(start,end)}else-1!=(verOffset=nAgt.indexOf("Edge"))?(jQuery.browser.edge=!0,jQuery.browser.name="Microsoft Edge",jQuery.browser.fullVersion=nAgt.substring(verOffset+5)):-1!=(verOffset=nAgt.indexOf("Chrome"))?(jQuery.browser.webkit=!0,jQuery.browser.chrome=!0,jQuery.browser.name="Chrome",jQuery.browser.fullVersion=nAgt.substring(verOffset+7)):-1<nAgt.indexOf("mozilla/5.0")&&-1<nAgt.indexOf("android ")&&-1<nAgt.indexOf("applewebkit")&&!(-1<nAgt.indexOf("chrome"))?(verOffset=nAgt.indexOf("Chrome"),jQuery.browser.webkit=!0,jQuery.browser.androidStock=!0,jQuery.browser.name="androidStock",jQuery.browser.fullVersion=nAgt.substring(verOffset+7)):-1!=(verOffset=nAgt.indexOf("Safari"))?(jQuery.browser.webkit=!0,jQuery.browser.safari=!0,jQuery.browser.name="Safari",jQuery.browser.fullVersion=nAgt.substring(verOffset+7),-1!=(verOffset=nAgt.indexOf("Version"))&&(jQuery.browser.fullVersion=nAgt.substring(verOffset+8))):-1!=(verOffset=nAgt.indexOf("AppleWebkit"))?(jQuery.browser.webkit=!0,jQuery.browser.safari=!0,jQuery.browser.name="Safari",jQuery.browser.fullVersion=nAgt.substring(verOffset+7),-1!=(verOffset=nAgt.indexOf("Version"))&&(jQuery.browser.fullVersion=nAgt.substring(verOffset+8))):-1!=(verOffset=nAgt.indexOf("Firefox"))?(jQuery.browser.mozilla=!0,jQuery.browser.name="Firefox",jQuery.browser.fullVersion=nAgt.substring(verOffset+8)):(nameOffset=nAgt.lastIndexOf(" ")+1)<(verOffset=nAgt.lastIndexOf("/"))&&(jQuery.browser.name=nAgt.substring(nameOffset,verOffset),jQuery.browser.fullVersion=nAgt.substring(verOffset+1),jQuery.browser.name.toLowerCase()==jQuery.browser.name.toUpperCase()&&(jQuery.browser.name=navigator.appName));-1!=(ix=jQuery.browser.fullVersion.indexOf(";"))&&(jQuery.browser.fullVersion=jQuery.browser.fullVersion.substring(0,ix)),-1!=(ix=jQuery.browser.fullVersion.indexOf(" "))&&(jQuery.browser.fullVersion=jQuery.browser.fullVersion.substring(0,ix)),jQuery.browser.majorVersion=parseInt(""+jQuery.browser.fullVersion,10),isNaN(jQuery.browser.majorVersion)&&(jQuery.browser.fullVersion=""+parseFloat(navigator.appVersion),jQuery.browser.majorVersion=parseInt(navigator.appVersion,10)),jQuery.browser.version=jQuery.browser.majorVersion,jQuery.browser.android=/Android/i.test(nAgt),jQuery.browser.blackberry=/BlackBerry|BB|PlayBook/i.test(nAgt),jQuery.browser.ios=/iPhone|iPad|iPod|webOS/i.test(nAgt),jQuery.browser.operaMobile=/Opera Mini/i.test(nAgt),jQuery.browser.windowsMobile=/IEMobile|Windows Phone/i.test(nAgt),jQuery.browser.kindle=/Kindle|Silk/i.test(nAgt),jQuery.browser.mobile=jQuery.browser.android||jQuery.browser.blackberry||jQuery.browser.ios||jQuery.browser.windowsMobile||jQuery.browser.operaMobile||jQuery.browser.kindle,jQuery.isMobile=jQuery.browser.mobile,jQuery.isTablet=jQuery.browser.mobile&&765<jQuery(window).width(),jQuery.isAndroidDefault=jQuery.browser.android&&!/chrome/i.test(nAgt),jQuery.mbBrowser=jQuery.browser,jQuery.browser.versionCompare=function(a,b){if("stringstring"!=typeof a+typeof b)return!1;for(var c=a.split("."),d=b.split("."),e=0,f=Math.max(c.length,d.length);f>e;e++){if(c[e]&&!d[e]&&0<parseInt(c[e])||parseInt(c[e])>parseInt(d[e]))return 1;if(d[e]&&!c[e]&&0<parseInt(d[e])||parseInt(c[e])<parseInt(d[e]))return-1}return 0},function(a){a.simpleSlider={defaults:{initialval:0,scale:100,orientation:"h",readonly:!1,callback:!1},events:{start:a.browser.mobile?"touchstart":"mousedown",end:a.browser.mobile?"touchend":"mouseup",move:a.browser.mobile?"touchmove":"mousemove"},init:function(b){return this.each(function(){var c=this,d=a(c);d.addClass("simpleSlider"),c.opt={},a.extend(c.opt,a.simpleSlider.defaults,b),a.extend(c.opt,d.data());var e="h"==c.opt.orientation?"horizontal":"vertical";e=a("<div/>").addClass("level").addClass(e),d.prepend(e),c.level=e,d.css({cursor:"default"}),"auto"==c.opt.scale&&(c.opt.scale=a(c).outerWidth()),d.updateSliderVal(),c.opt.readonly||(d.on(a.simpleSlider.events.start,function(b){a.browser.mobile&&(b=b.changedTouches[0]),c.canSlide=!0,d.updateSliderVal(b),"h"==c.opt.orientation?d.css({cursor:"col-resize"}):d.css({cursor:"row-resize"}),a.browser.mobile||(b.preventDefault(),b.stopPropagation())}),a(document).on(a.simpleSlider.events.move,function(b){a.browser.mobile&&(b=b.changedTouches[0]),c.canSlide&&(a(document).css({cursor:"default"}),d.updateSliderVal(b),a.browser.mobile||(b.preventDefault(),b.stopPropagation()))}).on(a.simpleSlider.events.end,function(){a(document).css({cursor:"auto"}),c.canSlide=!1,d.css({cursor:"auto"})}))})},updateSliderVal:function(b){var c=this.get(0);if(c.opt){c.opt.initialval="number"==typeof c.opt.initialval?c.opt.initialval:c.opt.initialval(c);var d=a(c).outerWidth(),e=a(c).outerHeight();c.x="object"==typeof b?b.clientX+document.body.scrollLeft-this.offset().left:"number"==typeof b?b*d/c.opt.scale:c.opt.initialval*d/c.opt.scale,c.y="object"==typeof b?b.clientY+document.body.scrollTop-this.offset().top:"number"==typeof b?(c.opt.scale-c.opt.initialval-b)*e/c.opt.scale:c.opt.initialval*e/c.opt.scale,c.y=this.outerHeight()-c.y,c.scaleX=c.x*c.opt.scale/d,c.scaleY=c.y*c.opt.scale/e,c.outOfRangeX=c.scaleX>c.opt.scale?c.scaleX-c.opt.scale:0>c.scaleX?c.scaleX:0,c.outOfRangeY=c.scaleY>c.opt.scale?c.scaleY-c.opt.scale:0>c.scaleY?c.scaleY:0,c.outOfRange="h"==c.opt.orientation?c.outOfRangeX:c.outOfRangeY,c.value="undefined"!=typeof b?"h"==c.opt.orientation?c.x>=this.outerWidth()?c.opt.scale:0>=c.x?0:c.scaleX:c.y>=this.outerHeight()?c.opt.scale:0>=c.y?0:c.scaleY:"h"==c.opt.orientation?c.scaleX:c.scaleY,"h"==c.opt.orientation?c.level.width(Math.floor(100*c.x/d)+"%"):c.level.height(Math.floor(100*c.y/e)),"function"==typeof c.opt.callback&&c.opt.callback(c)}}},a.fn.simpleSlider=a.simpleSlider.init,a.fn.updateSliderVal=a.simpleSlider.updateSliderVal}(jQuery),function(a){a.mbCookie={set:function(a,b,c,d){"object"==typeof b&&(b=JSON.stringify(b)),d=d?"; domain="+d:"";var e=new Date,f="";c>0&&(e.setTime(e.getTime()+864e5*c),f="; expires="+e.toGMTString()),document.cookie=a+"="+b+f+"; path=/"+d},get:function(a){a+="=";for(var b=document.cookie.split(";"),c=0;c<b.length;c++){for(var d=b[c];" "==d.charAt(0);)d=d.substring(1,d.length);if(0==d.indexOf(a))try{return JSON.parse(d.substring(a.length,d.length))}catch(e){return d.substring(a.length,d.length)}}return null},remove:function(b){a.mbCookie.set(b,"",-1)}},a.mbStorage={set:function(a,b){"object"==typeof b&&(b=JSON.stringify(b)),localStorage.setItem(a,b)},get:function(a){if(!localStorage[a])return null;try{return JSON.parse(localStorage[a])}catch(b){return localStorage[a]}},remove:function(a){a?localStorage.removeItem(a):localStorage.clear()}}}(jQuery);




/*jquery.mb.vimeo_player 09-06-2018
 _ jquery.mb.components 
 _ email: matteo@open-lab.com 
 _ Copyright (c) 2001-2018. Matteo Bicocchi (Pupunzi); 
 _ blog: http://pupunzi.open-lab.com 
 _ Open Lab s.r.l., Florence - Italy 
 */
function isTouchSupported(){var a=nAgt.msMaxTouchPoints,b="ontouchstart"in document.createElement("div");return!(!a&&!b)}function isTouchSupported(){var a=nAgt.msMaxTouchPoints,b="ontouchstart"in document.createElement("div");return!(!a&&!b)}var get_vimeo_videoID=function(a){var b;return b=a.indexOf("vimeo.com")>0?a.substr(a.lastIndexOf("/")+1,a.length):a.length>15?null:a};!function($){jQuery.vimeo_player={name:"jquery.mb.vimeo_player",author:"Matteo Bicocchi (pupunzi)",version:"1.1.8",build:"543",defaults:{containment:"body",ratio:16/9,videoURL:null,startAt:0,stopAt:0,autoPlay:!0,fadeTime:1e3,vol:5,addRaster:!1,opacity:1,mute:!0,loop:!0,showControls:!0,show_vimeo_logo:!0,stopMovieOnBlur:!0,realfullscreen:!0,playOnMobile:!0,mobileFallbackImage:null,gaTrack:!1,optimizeDisplay:!0,mask:!1,align:"center,center",onReady:function(a){}},controls:{play:"P",pause:"p",mute:"M",unmute:"A",fullscreen:"O",showSite:"R",logo:"V"},buildPlayer:function(options){var isIframe=function(){var a=!1;try{self.location.href!=top.location.href&&(a=!0)}catch(b){a=!0}return a},script=document.createElement("script");return script.src="//player.vimeo.com/api/player.js",script.onload=function(){jQuery(document).trigger("vimeo_api_loaded")},document.head.appendChild(script),this.each(function(){var vimeo_player=this,$vimeo_player=jQuery(vimeo_player);vimeo_player.loop=0,vimeo_player.opt={},vimeo_player.state={},vimeo_player.id=vimeo_player.id||"YTP_"+(new Date).getTime(),$vimeo_player.addClass("vimeo_player");var property=$vimeo_player.data("property")&&"string"==typeof $vimeo_player.data("property")?eval("("+$vimeo_player.data("property")+")"):$vimeo_player.data("property");if(jQuery.extend(vimeo_player.opt,jQuery.vimeo_player.defaults,options,property),vimeo_player.opt.ratio="auto"==vimeo_player.opt.ratio?16/9:vimeo_player.opt.ratio,eval(vimeo_player.opt.loop)&&(vimeo_player.opt.loop=9999),vimeo_player.isRetina=window.retina||window.devicePixelRatio>1,vimeo_player.canGoFullScreen=!(jQuery.browser.msie||jQuery.browser.opera||isIframe()),vimeo_player.canGoFullScreen||(vimeo_player.opt.realfullscreen=!1),vimeo_player.isAlone=!1,vimeo_player.hasFocus=!0,vimeo_player.videoID=this.opt.videoURL?get_vimeo_videoID(this.opt.videoURL):!!$vimeo_player.attr("href")&&get_vimeo_videoID($vimeo_player.attr("href")),vimeo_player.isSelf="self"==vimeo_player.opt.containment,vimeo_player.opt.containment="self"==vimeo_player.opt.containment?jQuery(this):jQuery(vimeo_player.opt.containment),vimeo_player.opt.vol=vimeo_player.opt.vol/10,vimeo_player.isBackground=vimeo_player.opt.containment.is("body"),!vimeo_player.isBackground||!vimeo_player.backgroundIsInited){vimeo_player.playOnMobile=vimeo_player.opt.playOnMobile&&jQuery.browser.mobile,vimeo_player.isSelf||$vimeo_player.hide();var overlay=jQuery("<div/>").css({position:"absolute",top:0,left:0,width:"100%",height:"100%"}).addClass("vimeo_player_overlay");vimeo_player.isSelf&&overlay.on("click",function(){$vimeo_player.togglePlay()});var playerID="vimeo_player_"+vimeo_player.id,wrapper=jQuery("<div/>").addClass("vimeo_player_wrapper").attr("id","vimeo_player_wrapper_"+playerID);wrapper.css({position:"absolute",zIndex:0,width:"100%",height:"100%",left:0,top:0,overflow:"hidden",opacity:0}),vimeo_player.opt.containment.prepend(wrapper),vimeo_player.opt.containment.children().not("script, style").each(function(){"static"==jQuery(this).css("position")&&jQuery(this).css("position","relative")}),vimeo_player.isBackground?(jQuery("body").css({boxSizing:"border-box"}),wrapper.css({position:"fixed",top:0,left:0,zIndex:0})):"static"==vimeo_player.opt.containment.css("position")&&vimeo_player.opt.containment.css({position:"relative"}),vimeo_player.videoWrapper=wrapper,vimeo_player.overlay=overlay,vimeo_player.isBackground||overlay.on("mouseenter",function(){vimeo_player.controlBar&&vimeo_player.controlBar.length&&vimeo_player.controlBar.addClass("visible")}).on("mouseleave",function(){vimeo_player.controlBar&&vimeo_player.controlBar.length&&vimeo_player.controlBar.removeClass("visible")}),jQuery(document).on("vimeo_api_loaded",function(){var options={id:vimeo_player.opt.videoURL,muted:vimeo_player.opt.mute?1:0,background:1,autoplay:vimeo_player.playOnMobile?1:0};vimeo_player.player=new Vimeo.Player(vimeo_player.videoWrapper.get(0).id,options),vimeo_player.player.ready().then(function(){function start(){vimeo_player.isReady=!0,vimeo_player.opt.mute&&setTimeout(function(){$vimeo_player.v_mute()},1),vimeo_player.opt.showControls&&jQuery.vimeo_player.buildControls(vimeo_player),vimeo_player.opt.autoPlay?vimeo_player.playOnMobile?setTimeout(function(){VEvent=jQuery.Event("VPStart"),$vimeo_player.trigger(VEvent),vimeo_player.videoWrapper.fadeTo(vimeo_player.opt.fadeTime,vimeo_player.opt.opacity)},1e3):setTimeout(function(){vimeo_player.player.pause(),$vimeo_player.v_play(),VEvent=jQuery.Event("VPStart"),$vimeo_player.trigger(VEvent),$vimeo_player.v_optimize_display()},vimeo_player.opt.fadeTime):$vimeo_player.v_pause(),VEvent=jQuery.Event("VPReady"),VEvent.opt=vimeo_player.opt,$vimeo_player.trigger(VEvent),"function"==typeof vimeo_player.opt.onReady&&vimeo_player.opt.onReady(vimeo_player),$vimeo_player.v_optimize_display()}vimeo_player.playerBox=vimeo_player.videoWrapper.find("iframe"),vimeo_player.playerBox.after(overlay);var VEvent;vimeo_player.opt.startAt?(vimeo_player.player.play().then(function(){vimeo_player.player.pause()}),$vimeo_player.v_seekTo(vimeo_player.opt.startAt,function(){start()})):start(),jQuery(window).off("resize.vimeo_player_"+vimeo_player.id).on("resize.vimeo_player_"+vimeo_player.id,function(){clearTimeout(vimeo_player.optimizeD),vimeo_player.optimizeD=setTimeout(function(){$vimeo_player.v_optimize_display()},250)}),vimeo_player.player.on("progress",function(a){VEvent=jQuery.Event("VPProgress"),VEvent.data=a,$vimeo_player.trigger(VEvent)}),vimeo_player.player.on("error",function(a){vimeo_player.state=-1,VEvent=jQuery.Event("VPError"),VEvent.error=a,$vimeo_player.trigger(VEvent)}),vimeo_player.player.on("play",function(data){if(vimeo_player.state=1,$vimeo_player.trigger("change_state"),vimeo_player.controlBar&&vimeo_player.controlBar.length&&vimeo_player.controlBar.find(".vimeo_player_pause").html(jQuery.vimeo_player.controls.pause),"undefined"!=typeof _gaq&&eval(vimeo_player.opt.gaTrack)&&_gaq.push(["_trackEvent","vimeo_player","Play",vimeo_player.videoID]),"undefined"!=typeof ga&&eval(vimeo_player.opt.gaTrack)&&ga("send","event","vimeo_player","play",vimeo_player.videoID),VEvent=jQuery.Event("VPPlay"),VEvent.error=data,$vimeo_player.trigger(VEvent),vimeo_player.opt.addRaster){var classN="dot"==vimeo_player.opt.addRaster?"raster-dot":"raster";vimeo_player.overlay.addClass(vimeo_player.isRetina?classN+" retina":classN)}else vimeo_player.overlay.removeClass(function(a,b){var c=b.split(" "),d=[];return jQuery.each(c,function(a,b){/raster.*/.test(b)&&d.push(b)}),d.push("retina"),d.join(" ")})}),vimeo_player.player.on("pause",function(a){vimeo_player.state=2,$vimeo_player.trigger("change_state"),vimeo_player.controlBar&&vimeo_player.controlBar.length&&vimeo_player.controlBar.find(".vimeo_player_pause").html(jQuery.vimeo_player.controls.play),VEvent=jQuery.Event("VPPause"),VEvent.time=a,$vimeo_player.trigger(VEvent)}),vimeo_player.player.on("seeked",function(a){vimeo_player.state=3,$vimeo_player.trigger("change_state")}),vimeo_player.player.on("ended",function(a){vimeo_player.state=0,$vimeo_player.trigger("change_state"),VEvent=jQuery.Event("VPEnd"),VEvent.time=a,$vimeo_player.trigger(VEvent)}),vimeo_player.player.on("timeupdate",function(a){if(vimeo_player.duration=a.duration,vimeo_player.percent=a.percent,vimeo_player.seconds=a.seconds,vimeo_player.state=1,vimeo_player.player.getPaused().then(function(a){a&&(vimeo_player.state=2)}),vimeo_player.opt.stopMovieOnBlur&&(document.hasFocus()||1==vimeo_player.state&&(vimeo_player.hasFocus=!1,$vimeo_player.v_pause(),vimeo_player.document_focus=setInterval(function(){document.hasFocus()&&!vimeo_player.hasFocus&&(vimeo_player.hasFocus=!0,$vimeo_player.v_play(),clearInterval(vimeo_player.document_focus))},300))),vimeo_player.opt.showControls){var b=jQuery("#controlBar_"+vimeo_player.id),c=b.find(".vimeo_player_pogress"),d=b.find(".vimeo_player_loaded"),e=b.find(".vimeo_player_seek_bar"),f=c.outerWidth(),g=Math.floor(a.seconds),h=Math.floor(a.duration),i=g*f/h,j=0,k=100*a.percent;d.css({left:j,width:k+"%"}),e.css({left:0,width:i}),a.duration?vimeo_player.controlBar.find(".vimeo_player_time").html(jQuery.vimeo_player.formatTime(a.seconds)+" / "+jQuery.vimeo_player.formatTime(a.duration)):vimeo_player.controlBar.find(".vimeo_player_time").html("-- : -- / -- : --")}vimeo_player.opt.stopAt=vimeo_player.opt.stopAt>a.duration?a.duration-.5:vimeo_player.opt.stopAt;var l=vimeo_player.opt.stopAt||a.duration-.5;a.seconds>=l&&(vimeo_player.loop=vimeo_player.loop||0,vimeo_player.opt.loop&&vimeo_player.loop<vimeo_player.opt.loop?($vimeo_player.v_seekTo(vimeo_player.opt.startAt),vimeo_player.loop++):($vimeo_player.v_pause(),vimeo_player.state=0,$vimeo_player.trigger("change_state"))),VEvent=jQuery.Event("VPTime"),VEvent.time=a.seconds,$vimeo_player.trigger(VEvent)})}),$vimeo_player.on("change_state",function(){0==vimeo_player.state&&vimeo_player.videoWrapper.fadeOut(vimeo_player.opt.fadeTime,function(){$vimeo_player.v_seekTo(0)})})})}})},formatTime:function(a){var b=Math.floor(a/60),c=Math.floor(a-60*b);return(b<=9?"0"+b:b)+" : "+(c<=9?"0"+c:c)},play:function(){var a=this.get(0);if(!a.isReady)return this;a.player.pause(),a.player.play(),setTimeout(function(){a.videoWrapper.fadeTo(a.opt.fadeTime,a.opt.opacity)},1e3);var b=jQuery("#controlBar_"+a.id);if(b.length){var c=b.find(".mb_YTPPvimeo_player_playpause");c.html(jQuery.vimeo_player.controls.pause)}return a.state=1,jQuery(a).css("background-image","none"),this},togglePlay:function(a){var b=this.get(0);return 1==b.state?this.v_pause():this.v_play(),"function"==typeof a&&a(b.state),this},pause:function(){var a=this.get(0);return a.player.pause(),a.state=2,this},seekTo:function(a,b){var c=this.get(0),d=c.opt.stopAt&&a>=c.opt.stopAt?c.opt.stopAt-.5:a;return c.player.setCurrentTime(d).then(function(a){"function"==typeof b&&b(a)}),this},setVolume:function(a){var b=this.get(0);return b.isMute=!1,b.opt.vol=a||b.opt.vol,b.player.setVolume(b.opt.vol),b.volumeBar&&b.volumeBar.length&&b.volumeBar.updateSliderVal(100*a),this},toggleVolume:function(){var a=this.get(0);if(a)return a.isMute?(jQuery(a).v_unmute(),!0):(jQuery(a).v_mute(),!1)},mute:function(){var a=this.get(0);if(a.isMute)return this;a.playOnMobile&&a.player.toggleMute(),a.isMute=!0,a.player.setVolume(0),a.volumeBar&&a.volumeBar.length&&a.volumeBar.width()>10&&a.volumeBar.updateSliderVal(0);var b=jQuery("#controlBar_"+a.id),c=b.find(".vimeo_player_muteUnmute");return c.html(jQuery.vimeo_player.controls.unmute),jQuery(a).addClass("isMuted"),a.volumeBar&&a.volumeBar.length&&a.volumeBar.addClass("muted"),this},unmute:function(){var a=this.get(0);if(a.isMute){a.isMute=!1,a.playOnMobile&&a.player.toggleMute(),jQuery(a).v_set_volume(a.opt.vol),a.volumeBar&&a.volumeBar.length&&a.volumeBar.updateSliderVal(a.opt.vol>.1?a.opt.vol:.1);var b=jQuery("#controlBar_"+a.id),c=b.find(".vimeo_player_muteUnmute");return c.html(jQuery.vimeo_player.controls.mute),jQuery(a).removeClass("isMuted"),a.volumeBar&&a.volumeBar.length&&a.volumeBar.removeClass("muted"),this}},changeMovie:function(a){var b=this,c=b.get(0);c.opt.startAt=0,c.opt.stopAt=0,c.opt.mask=!1,c.opt.mute=!0,c.hasData=!1,c.hasChanged=!0,c.player.loopTime=void 0,a&&jQuery.extend(c.opt,a),"true"==c.opt.loop&&(c.opt.loop=9999),c.player.loadVideo(a.videoURL).then(function(a){b.v_optimize_display(),jQuery(c).v_play(),c.opt.startAt&&b.v_seekTo(c.opt.startAt)})},buildControls:function(vimeo_player){var data=vimeo_player.opt;if(!jQuery("#controlBar_"+vimeo_player.id).length){vimeo_player.controlBar=jQuery("<span/>").attr("id","controlBar_"+vimeo_player.id).addClass("vimeo_player_bar").css({whiteSpace:"noWrap",position:vimeo_player.isBackground?"fixed":"absolute",zIndex:vimeo_player.isBackground?1e4:1e3});var buttonBar=jQuery("<div/>").addClass("buttonBar"),playpause=jQuery("<span>"+jQuery.vimeo_player.controls.play+"</span>").addClass("vimeo_player_pause vimeo_icon").click(function(){1==vimeo_player.state?jQuery(vimeo_player).v_pause():jQuery(vimeo_player).v_play()}),MuteUnmute=jQuery("<span>"+jQuery.vimeo_player.controls.mute+"</span>").addClass("vimeo_player_muteUnmute vimeo_icon").click(function(){vimeo_player.isMute?jQuery(vimeo_player).v_unmute():jQuery(vimeo_player).v_mute()}),volumeBar=jQuery("<div/>").addClass("vimeo_player_volume_bar").css({display:"inline-block"});vimeo_player.volumeBar=volumeBar;var idx=jQuery("<span/>").addClass("vimeo_player_time"),vURL="https://vimeo.com/"+vimeo_player.videoID,movieUrl=jQuery("<span/>").html(jQuery.vimeo_player.controls.logo).addClass("vimeo_url vimeo_icon").attr("title","view on Vimeo").on("click",function(){window.open(vURL,"viewOnVimeo")}),fullscreen=jQuery("<span/>").html(jQuery.vimeo_player.controls.fullscreen).addClass("vimeo_fullscreen vimeo_icon").on("click",function(){jQuery(vimeo_player).v_fullscreen(data.realfullscreen)}),progressBar=jQuery("<div/>").addClass("vimeo_player_pogress").css("position","absolute").click(function(a){timeBar.css({width:a.clientX-timeBar.offset().left}),vimeo_player.timeW=a.clientX-timeBar.offset().left,vimeo_player.controlBar.find(".vimeo_player_loaded").css({width:0});var b=Math.floor(vimeo_player.duration);vimeo_player.goto=timeBar.outerWidth()*b/progressBar.outerWidth(),jQuery(vimeo_player).v_seekTo(parseFloat(vimeo_player.goto)),vimeo_player.controlBar.find(".vimeo_player_loaded").css({width:0})}),loadedBar=jQuery("<div/>").addClass("vimeo_player_loaded").css("position","absolute"),timeBar=jQuery("<div/>").addClass("vimeo_player_seek_bar").css("position","absolute");progressBar.append(loadedBar).append(timeBar),buttonBar.append(playpause).append(MuteUnmute).append(volumeBar).append(idx),data.show_vimeo_logo&&buttonBar.append(movieUrl),(vimeo_player.isBackground||eval(vimeo_player.opt.realfullscreen)&&!vimeo_player.isBackground)&&buttonBar.append(fullscreen),vimeo_player.controlBar.append(buttonBar).append(progressBar),vimeo_player.isBackground?jQuery("body").after(vimeo_player.controlBar):vimeo_player.videoWrapper.before(vimeo_player.controlBar),volumeBar.simpleSlider({initialval:vimeo_player.opt.vol,scale:100,orientation:"h",callback:function(a){0==a.value?jQuery(vimeo_player).v_mute():jQuery(vimeo_player).v_unmute(),vimeo_player.player.setVolume(a.value/100),vimeo_player.isMute||(vimeo_player.opt.vol=a.value)}})}},optimizeVimeoDisplay:function(align){var vimeo_player=this.get(0),vid={};vimeo_player.opt.align=align||vimeo_player.opt.align,vimeo_player.opt.align="undefined "!=typeof vimeo_player.opt.align?vimeo_player.opt.align:"center,center";var VimeoAlign=vimeo_player.opt.align.split(",");if(vimeo_player.opt.optimizeDisplay){var win={},el=vimeo_player.videoWrapper,abundance=vimeo_player.isPlayer?0:.15*el.outerHeight();win.width=el.outerWidth()+abundance,win.height=el.outerHeight()+abundance,vimeo_player.opt.ratio=eval(vimeo_player.opt.ratio),vid.width=win.width,vid.height=Math.ceil(vid.width/vimeo_player.opt.ratio),vid.marginTop=Math.ceil(-((vid.height-win.height)/2)),vid.marginLeft=0,vimeo_player.playerBox.css({top:0,opacity:0,width:100,height:Math.ceil(100/vimeo_player.opt.ratio),marginTop:0,marginLeft:0,frameBorder:0});var lowest=vid.height<win.height;lowest&&(vid.height=win.height,vid.width=Math.ceil(vid.height*vimeo_player.opt.ratio),vid.marginTop=0,vid.marginLeft=Math.ceil(-((vid.width-win.width)/2)));for(var a in VimeoAlign)if(VimeoAlign.hasOwnProperty(a)){var al=VimeoAlign[a].replace(/ /g,"");switch(al){case"top":vid.marginTop=lowest?-((vid.height-win.height)/2):0;break;case"bottom":vid.marginTop=lowest?0:-(vid.height-win.height);break;case"left":vid.marginLeft=0;break;case"right":vid.marginLeft=lowest?-(vid.width-win.width):0;break;default:vid.width>win.width&&(vid.marginLeft=-((vid.width-win.width)/2))}}}else vid.width="100%",vid.height="100%",vid.marginTop=0,vid.marginLeft=0;setTimeout(function(){vimeo_player.playerBox.css({opacity:1,width:vid.width,height:vid.height,marginTop:vid.marginTop,marginLeft:vid.marginLeft,maxWidth:"initial"})},10)},setAlign:function(a){var b=this;b.v_optimize_display(a)},getAlign:function(){var a=this.get(0);return a.opt.align},fullscreen:function(real){function hideMouse(){vimeo_player.overlay.css({cursor:"none"})}function RunPrefixMethod(a,b){for(var c,d,e=["webkit","moz","ms","o",""],f=0;f<e.length&&!a[c];){if(c=b,""==e[f]&&(c=c.substr(0,1).toLowerCase()+c.substr(1)),c=e[f]+c,d=typeof a[c],"undefined"!=d)return e=[e[f]],"function"==d?a[c]():a[c];f++}}function launchFullscreen(a){RunPrefixMethod(a,"RequestFullScreen")}function cancelFullscreen(){(RunPrefixMethod(document,"FullScreen")||RunPrefixMethod(document,"IsFullScreen"))&&RunPrefixMethod(document,"CancelFullScreen")}var vimeo_player=this.get(0),$vimeo_player=jQuery(vimeo_player),VEvent;"undefined"==typeof real&&(real=vimeo_player.opt.realfullscreen),real=eval(real);var controls=jQuery("#controlBar_"+vimeo_player.id),fullScreenBtn=controls.find(".vimeo_fullscreen"),videoWrapper=vimeo_player.isSelf?vimeo_player.opt.containment:vimeo_player.videoWrapper;if(real){var fullscreenchange=jQuery.browser.mozilla?"mozfullscreenchange":jQuery.browser.webkit?"webkitfullscreenchange":"fullscreenchange";jQuery(document).off(fullscreenchange).on(fullscreenchange,function(){var a=RunPrefixMethod(document,"IsFullScreen")||RunPrefixMethod(document,"FullScreen");a?(VEvent=jQuery.Event("VPFullScreenStart"),$vimeo_player.trigger(VEvent)):(vimeo_player.isAlone=!1,fullScreenBtn.html(jQuery.vimeo_player.controls.fullscreen),videoWrapper.removeClass("vimeo_player_Fullscreen"),videoWrapper.fadeTo(vimeo_player.opt.fadeTime,vimeo_player.opt.opacity),videoWrapper.css({zIndex:0}),vimeo_player.isBackground?jQuery("body").after(controls):vimeo_player.videoWrapper.before(controls),jQuery(window).resize(),VEvent=jQuery.Event("VPFullScreenEnd"),$vimeo_player.trigger(VEvent))})}return vimeo_player.isAlone?(jQuery(document).off("mousemove.vimeo_player"),clearTimeout(vimeo_player.hideCursor),vimeo_player.overlay.css({cursor:"auto"}),real?cancelFullscreen():videoWrapper.fadeTo(vimeo_player.opt.fadeTime,vimeo_player.opt.opacity).css({zIndex:0}),fullScreenBtn.html(jQuery.vimeo_player.controls.fullscreen),vimeo_player.isAlone=!1):(jQuery(document).on("mousemove.vimeo_player",function(a){vimeo_player.overlay.css({cursor:"auto"}),clearTimeout(vimeo_player.hideCursor),jQuery(a.target).parents().is(".vimeo_player_bar")||(vimeo_player.hideCursor=setTimeout(hideMouse,3e3))}),hideMouse(),real?(videoWrapper.css({opacity:0}),videoWrapper.addClass("vimeo_player_Fullscreen"),launchFullscreen(videoWrapper.get(0)),setTimeout(function(){videoWrapper.fadeTo(vimeo_player.opt.fadeTime,1),vimeo_player.videoWrapper.append(controls),jQuery(vimeo_player).v_optimize_display()},500)):videoWrapper.css({zIndex:1e4}).fadeTo(vimeo_player.opt.fadeTime,1),fullScreenBtn.html(jQuery.vimeo_player.controls.showSite),vimeo_player.isAlone=!0),this}},jQuery.fn.vimeo_player=jQuery.vimeo_player.buildPlayer,jQuery.fn.v_play=jQuery.vimeo_player.play,jQuery.fn.v_toggle_play=jQuery.vimeo_player.togglePlay,jQuery.fn.v_change_movie=jQuery.vimeo_player.changeMovie,jQuery.fn.v_pause=jQuery.vimeo_player.pause,jQuery.fn.v_seekTo=jQuery.vimeo_player.seekTo,jQuery.fn.v_optimize_display=jQuery.vimeo_player.optimizeVimeoDisplay,jQuery.fn.v_set_align=jQuery.vimeo_player.setAlign,jQuery.fn.v_get_align=jQuery.vimeo_player.getAlign,jQuery.fn.v_fullscreen=jQuery.vimeo_player.fullscreen,jQuery.fn.v_mute=jQuery.vimeo_player.mute,jQuery.fn.v_unmute=jQuery.vimeo_player.unmute,jQuery.fn.v_set_volume=jQuery.vimeo_player.setVolume,jQuery.fn.v_toggle_volume=jQuery.vimeo_player.toggleVolume}(jQuery);var nAgt=navigator.userAgent;jQuery.browser=jQuery.browser||{},jQuery.browser.mozilla=!1,jQuery.browser.webkit=!1,jQuery.browser.opera=!1,jQuery.browser.safari=!1,jQuery.browser.chrome=!1,jQuery.browser.androidStock=!1,jQuery.browser.msie=!1,jQuery.browser.edge=!1,jQuery.browser.ua=nAgt;var getOS=function(){var a={version:"Unknown version",name:"Unknown OS"};return-1!=navigator.appVersion.indexOf("Win")&&(a.name="Windows"),-1!=navigator.appVersion.indexOf("Mac")&&0>navigator.appVersion.indexOf("Mobile")&&(a.name="Mac"),-1!=navigator.appVersion.indexOf("Linux")&&(a.name="Linux"),/Mac OS X/.test(nAgt)&&!/Mobile/.test(nAgt)&&(a.version=/Mac OS X (10[\.\_\d]+)/.exec(nAgt)[1],a.version=a.version.replace(/_/g,".").substring(0,5)),/Windows/.test(nAgt)&&(a.version="Unknown.Unknown"),/Windows NT 5.1/.test(nAgt)&&(a.version="5.1"),/Windows NT 6.0/.test(nAgt)&&(a.version="6.0"),/Windows NT 6.1/.test(nAgt)&&(a.version="6.1"),/Windows NT 6.2/.test(nAgt)&&(a.version="6.2"),/Windows NT 10.0/.test(nAgt)&&(a.version="10.0"),/Linux/.test(nAgt)&&/Linux/.test(nAgt)&&(a.version="Unknown.Unknown"),a.name=a.name.toLowerCase(),a.major_version="Unknown",a.minor_version="Unknown","Unknown.Unknown"!=a.version&&(a.major_version=parseFloat(a.version.split(".")[0]),a.minor_version=parseFloat(a.version.split(".")[1])),a};jQuery.browser.os=getOS(),jQuery.browser.hasTouch=isTouchSupported(),jQuery.browser.name=navigator.appName,jQuery.browser.fullVersion=""+parseFloat(navigator.appVersion),jQuery.browser.majorVersion=parseInt(navigator.appVersion,10);var nameOffset,verOffset,ix;if(-1!=(verOffset=nAgt.indexOf("Opera")))jQuery.browser.opera=!0,jQuery.browser.name="Opera",jQuery.browser.fullVersion=nAgt.substring(verOffset+6),-1!=(verOffset=nAgt.indexOf("Version"))&&(jQuery.browser.fullVersion=nAgt.substring(verOffset+8));else if(-1!=(verOffset=nAgt.indexOf("OPR")))jQuery.browser.opera=!0,jQuery.browser.name="Opera",jQuery.browser.fullVersion=nAgt.substring(verOffset+4);else if(-1!=(verOffset=nAgt.indexOf("MSIE")))jQuery.browser.msie=!0,jQuery.browser.name="Microsoft Internet Explorer",jQuery.browser.fullVersion=nAgt.substring(verOffset+5);else if(-1!=nAgt.indexOf("Trident")){jQuery.browser.msie=!0,jQuery.browser.name="Microsoft Internet Explorer";var start=nAgt.indexOf("rv:")+3,end=start+4;jQuery.browser.fullVersion=nAgt.substring(start,end)}else-1!=(verOffset=nAgt.indexOf("Edge"))?(jQuery.browser.edge=!0,jQuery.browser.name="Microsoft Edge",jQuery.browser.fullVersion=nAgt.substring(verOffset+5)):-1!=(verOffset=nAgt.indexOf("Chrome"))?(jQuery.browser.webkit=!0,jQuery.browser.chrome=!0,jQuery.browser.name="Chrome",jQuery.browser.fullVersion=nAgt.substring(verOffset+7)):-1<nAgt.indexOf("mozilla/5.0")&&-1<nAgt.indexOf("android ")&&-1<nAgt.indexOf("applewebkit")&&!(-1<nAgt.indexOf("chrome"))?(verOffset=nAgt.indexOf("Chrome"),jQuery.browser.webkit=!0,jQuery.browser.androidStock=!0,jQuery.browser.name="androidStock",jQuery.browser.fullVersion=nAgt.substring(verOffset+7)):-1!=(verOffset=nAgt.indexOf("Safari"))?(jQuery.browser.webkit=!0,jQuery.browser.safari=!0,jQuery.browser.name="Safari",jQuery.browser.fullVersion=nAgt.substring(verOffset+7),-1!=(verOffset=nAgt.indexOf("Version"))&&(jQuery.browser.fullVersion=nAgt.substring(verOffset+8))):-1!=(verOffset=nAgt.indexOf("AppleWebkit"))?(jQuery.browser.webkit=!0,jQuery.browser.safari=!0,jQuery.browser.name="Safari",jQuery.browser.fullVersion=nAgt.substring(verOffset+7),-1!=(verOffset=nAgt.indexOf("Version"))&&(jQuery.browser.fullVersion=nAgt.substring(verOffset+8))):-1!=(verOffset=nAgt.indexOf("Firefox"))?(jQuery.browser.mozilla=!0,jQuery.browser.name="Firefox",jQuery.browser.fullVersion=nAgt.substring(verOffset+8)):(nameOffset=nAgt.lastIndexOf(" ")+1)<(verOffset=nAgt.lastIndexOf("/"))&&(jQuery.browser.name=nAgt.substring(nameOffset,verOffset),jQuery.browser.fullVersion=nAgt.substring(verOffset+1),jQuery.browser.name.toLowerCase()==jQuery.browser.name.toUpperCase()&&(jQuery.browser.name=navigator.appName));-1!=(ix=jQuery.browser.fullVersion.indexOf(";"))&&(jQuery.browser.fullVersion=jQuery.browser.fullVersion.substring(0,ix)),-1!=(ix=jQuery.browser.fullVersion.indexOf(" "))&&(jQuery.browser.fullVersion=jQuery.browser.fullVersion.substring(0,ix)),jQuery.browser.majorVersion=parseInt(""+jQuery.browser.fullVersion,10),isNaN(jQuery.browser.majorVersion)&&(jQuery.browser.fullVersion=""+parseFloat(navigator.appVersion),jQuery.browser.majorVersion=parseInt(navigator.appVersion,10)),jQuery.browser.version=jQuery.browser.majorVersion,jQuery.browser.android=/Android/i.test(nAgt),jQuery.browser.blackberry=/BlackBerry|BB|PlayBook/i.test(nAgt),jQuery.browser.ios=/iPhone|iPad|iPod|webOS/i.test(nAgt),jQuery.browser.operaMobile=/Opera Mini/i.test(nAgt),jQuery.browser.windowsMobile=/IEMobile|Windows Phone/i.test(nAgt),jQuery.browser.kindle=/Kindle|Silk/i.test(nAgt),jQuery.browser.mobile=jQuery.browser.android||jQuery.browser.blackberry||jQuery.browser.ios||jQuery.browser.windowsMobile||jQuery.browser.operaMobile||jQuery.browser.kindle,jQuery.isMobile=jQuery.browser.mobile,jQuery.isTablet=jQuery.browser.mobile&&765<jQuery(window).width(),jQuery.isAndroidDefault=jQuery.browser.android&&!/chrome/i.test(nAgt),jQuery.mbBrowser=jQuery.browser,jQuery.browser.versionCompare=function(a,b){if("stringstring"!=typeof a+typeof b)return!1;for(var c=a.split("."),d=b.split("."),e=0,f=Math.max(c.length,d.length);e<f;e++){if(c[e]&&!d[e]&&0<parseInt(c[e])||parseInt(c[e])>parseInt(d[e]))return 1;if(d[e]&&!c[e]&&0<parseInt(d[e])||parseInt(c[e])<parseInt(d[e]))return-1}return 0};var nAgt=navigator.userAgent;jQuery.browser=jQuery.browser||{},jQuery.browser.mozilla=!1,jQuery.browser.webkit=!1,jQuery.browser.opera=!1,jQuery.browser.safari=!1,jQuery.browser.chrome=!1,jQuery.browser.androidStock=!1,jQuery.browser.msie=!1,jQuery.browser.edge=!1,jQuery.browser.ua=nAgt;var getOS=function(){var a={version:"Unknown version",name:"Unknown OS"};return-1!=navigator.appVersion.indexOf("Win")&&(a.name="Windows"),-1!=navigator.appVersion.indexOf("Mac")&&0>navigator.appVersion.indexOf("Mobile")&&(a.name="Mac"),-1!=navigator.appVersion.indexOf("Linux")&&(a.name="Linux"),/Mac OS X/.test(nAgt)&&!/Mobile/.test(nAgt)&&(a.version=/Mac OS X (10[\.\_\d]+)/.exec(nAgt)[1],a.version=a.version.replace(/_/g,".").substring(0,5)),/Windows/.test(nAgt)&&(a.version="Unknown.Unknown"),/Windows NT 5.1/.test(nAgt)&&(a.version="5.1"),/Windows NT 6.0/.test(nAgt)&&(a.version="6.0"),/Windows NT 6.1/.test(nAgt)&&(a.version="6.1"),/Windows NT 6.2/.test(nAgt)&&(a.version="6.2"),/Windows NT 10.0/.test(nAgt)&&(a.version="10.0"),/Linux/.test(nAgt)&&/Linux/.test(nAgt)&&(a.version="Unknown.Unknown"),a.name=a.name.toLowerCase(),a.major_version="Unknown",a.minor_version="Unknown","Unknown.Unknown"!=a.version&&(a.major_version=parseFloat(a.version.split(".")[0]),a.minor_version=parseFloat(a.version.split(".")[1])),a};jQuery.browser.os=getOS(),jQuery.browser.hasTouch=isTouchSupported(),jQuery.browser.name=navigator.appName,jQuery.browser.fullVersion=""+parseFloat(navigator.appVersion),jQuery.browser.majorVersion=parseInt(navigator.appVersion,10);var nameOffset,verOffset,ix;if(-1!=(verOffset=nAgt.indexOf("Opera")))jQuery.browser.opera=!0,jQuery.browser.name="Opera",jQuery.browser.fullVersion=nAgt.substring(verOffset+6),-1!=(verOffset=nAgt.indexOf("Version"))&&(jQuery.browser.fullVersion=nAgt.substring(verOffset+8));else if(-1!=(verOffset=nAgt.indexOf("OPR")))jQuery.browser.opera=!0,jQuery.browser.name="Opera",jQuery.browser.fullVersion=nAgt.substring(verOffset+4);else if(-1!=(verOffset=nAgt.indexOf("MSIE")))jQuery.browser.msie=!0,jQuery.browser.name="Microsoft Internet Explorer",jQuery.browser.fullVersion=nAgt.substring(verOffset+5);else if(-1!=nAgt.indexOf("Trident")){jQuery.browser.msie=!0,jQuery.browser.name="Microsoft Internet Explorer";var start=nAgt.indexOf("rv:")+3,end=start+4;jQuery.browser.fullVersion=nAgt.substring(start,end)}else-1!=(verOffset=nAgt.indexOf("Edge"))?(jQuery.browser.edge=!0,jQuery.browser.name="Microsoft Edge",jQuery.browser.fullVersion=nAgt.substring(verOffset+5)):-1!=(verOffset=nAgt.indexOf("Chrome"))?(jQuery.browser.webkit=!0,jQuery.browser.chrome=!0,jQuery.browser.name="Chrome",jQuery.browser.fullVersion=nAgt.substring(verOffset+7)):-1<nAgt.indexOf("mozilla/5.0")&&-1<nAgt.indexOf("android ")&&-1<nAgt.indexOf("applewebkit")&&!(-1<nAgt.indexOf("chrome"))?(verOffset=nAgt.indexOf("Chrome"),jQuery.browser.webkit=!0,jQuery.browser.androidStock=!0,jQuery.browser.name="androidStock",jQuery.browser.fullVersion=nAgt.substring(verOffset+7)):-1!=(verOffset=nAgt.indexOf("Safari"))?(jQuery.browser.webkit=!0,jQuery.browser.safari=!0,jQuery.browser.name="Safari",jQuery.browser.fullVersion=nAgt.substring(verOffset+7),-1!=(verOffset=nAgt.indexOf("Version"))&&(jQuery.browser.fullVersion=nAgt.substring(verOffset+8))):-1!=(verOffset=nAgt.indexOf("AppleWebkit"))?(jQuery.browser.webkit=!0,jQuery.browser.safari=!0,jQuery.browser.name="Safari",jQuery.browser.fullVersion=nAgt.substring(verOffset+7),-1!=(verOffset=nAgt.indexOf("Version"))&&(jQuery.browser.fullVersion=nAgt.substring(verOffset+8))):-1!=(verOffset=nAgt.indexOf("Firefox"))?(jQuery.browser.mozilla=!0,jQuery.browser.name="Firefox",jQuery.browser.fullVersion=nAgt.substring(verOffset+8)):(nameOffset=nAgt.lastIndexOf(" ")+1)<(verOffset=nAgt.lastIndexOf("/"))&&(jQuery.browser.name=nAgt.substring(nameOffset,verOffset),jQuery.browser.fullVersion=nAgt.substring(verOffset+1),jQuery.browser.name.toLowerCase()==jQuery.browser.name.toUpperCase()&&(jQuery.browser.name=navigator.appName));-1!=(ix=jQuery.browser.fullVersion.indexOf(";"))&&(jQuery.browser.fullVersion=jQuery.browser.fullVersion.substring(0,ix)),-1!=(ix=jQuery.browser.fullVersion.indexOf(" "))&&(jQuery.browser.fullVersion=jQuery.browser.fullVersion.substring(0,ix)),jQuery.browser.majorVersion=parseInt(""+jQuery.browser.fullVersion,10),isNaN(jQuery.browser.majorVersion)&&(jQuery.browser.fullVersion=""+parseFloat(navigator.appVersion),jQuery.browser.majorVersion=parseInt(navigator.appVersion,10)),jQuery.browser.version=jQuery.browser.majorVersion,jQuery.browser.android=/Android/i.test(nAgt),jQuery.browser.blackberry=/BlackBerry|BB|PlayBook/i.test(nAgt),jQuery.browser.ios=/iPhone|iPad|iPod|webOS/i.test(nAgt),jQuery.browser.operaMobile=/Opera Mini/i.test(nAgt),jQuery.browser.windowsMobile=/IEMobile|Windows Phone/i.test(nAgt),jQuery.browser.kindle=/Kindle|Silk/i.test(nAgt),jQuery.browser.mobile=jQuery.browser.android||jQuery.browser.blackberry||jQuery.browser.ios||jQuery.browser.windowsMobile||jQuery.browser.operaMobile||jQuery.browser.kindle,jQuery.isMobile=jQuery.browser.mobile,jQuery.isTablet=jQuery.browser.mobile&&765<jQuery(window).width(),jQuery.isAndroidDefault=jQuery.browser.android&&!/chrome/i.test(nAgt),jQuery.mbBrowser=jQuery.browser,jQuery.browser.versionCompare=function(a,b){if("stringstring"!=typeof a+typeof b)return!1;for(var c=a.split("."),d=b.split("."),e=0,f=Math.max(c.length,d.length);e<f;e++){if(c[e]&&!d[e]&&0<parseInt(c[e])||parseInt(c[e])>parseInt(d[e]))return 1;if(d[e]&&!c[e]&&0<parseInt(d[e])||parseInt(c[e])<parseInt(d[e]))return-1}return 0},function(a){a.simpleSlider={defaults:{initialval:0,scale:100,orientation:"h",readonly:!1,callback:!1},events:{start:a.browser.mobile?"touchstart":"mousedown",end:a.browser.mobile?"touchend":"mouseup",move:a.browser.mobile?"touchmove":"mousemove"},init:function(b){return this.each(function(){var c=this,d=a(c);d.addClass("simpleSlider"),c.opt={},a.extend(c.opt,a.simpleSlider.defaults,b),a.extend(c.opt,d.data());var e="h"==c.opt.orientation?"horizontal":"vertical";e=a("<div/>").addClass("level").addClass(e),d.prepend(e),c.level=e,d.css({cursor:"default"}),"auto"==c.opt.scale&&(c.opt.scale=a(c).outerWidth()),d.updateSliderVal(),c.opt.readonly||(d.on(a.simpleSlider.events.start,function(b){a.browser.mobile&&(b=b.changedTouches[0]),c.canSlide=!0,d.updateSliderVal(b),"h"==c.opt.orientation?d.css({cursor:"col-resize"}):d.css({cursor:"row-resize"}),a.browser.mobile||(b.preventDefault(),b.stopPropagation())}),a(document).on(a.simpleSlider.events.move,function(b){
a.browser.mobile&&(b=b.changedTouches[0]),c.canSlide&&(a(document).css({cursor:"default"}),d.updateSliderVal(b),a.browser.mobile||(b.preventDefault(),b.stopPropagation()))}).on(a.simpleSlider.events.end,function(){a(document).css({cursor:"auto"}),c.canSlide=!1,d.css({cursor:"auto"})}))})},updateSliderVal:function(b){var c=this.get(0);if(c.opt){c.opt.initialval="number"==typeof c.opt.initialval?c.opt.initialval:c.opt.initialval(c);var d=a(c).outerWidth(),e=a(c).outerHeight();c.x="object"==typeof b?b.clientX+document.body.scrollLeft-this.offset().left:"number"==typeof b?b*d/c.opt.scale:c.opt.initialval*d/c.opt.scale,c.y="object"==typeof b?b.clientY+document.body.scrollTop-this.offset().top:"number"==typeof b?(c.opt.scale-c.opt.initialval-b)*e/c.opt.scale:c.opt.initialval*e/c.opt.scale,c.y=this.outerHeight()-c.y,c.scaleX=c.x*c.opt.scale/d,c.scaleY=c.y*c.opt.scale/e,c.outOfRangeX=c.scaleX>c.opt.scale?c.scaleX-c.opt.scale:0>c.scaleX?c.scaleX:0,c.outOfRangeY=c.scaleY>c.opt.scale?c.scaleY-c.opt.scale:0>c.scaleY?c.scaleY:0,c.outOfRange="h"==c.opt.orientation?c.outOfRangeX:c.outOfRangeY,c.value="undefined"!=typeof b?"h"==c.opt.orientation?c.x>=this.outerWidth()?c.opt.scale:0>=c.x?0:c.scaleX:c.y>=this.outerHeight()?c.opt.scale:0>=c.y?0:c.scaleY:"h"==c.opt.orientation?c.scaleX:c.scaleY,"h"==c.opt.orientation?c.level.width(Math.floor(100*c.x/d)+"%"):c.level.height(Math.floor(100*c.y/e)),"function"==typeof c.opt.callback&&c.opt.callback(c)}}},a.fn.simpleSlider=a.simpleSlider.init,a.fn.updateSliderVal=a.simpleSlider.updateSliderVal}(jQuery);






/*
 *  Vide - v0.5.1
 *  Easy as hell jQuery plugin for video backgrounds.
 *  http://vodkabears.github.io/vide/
 *
 *  Made by Ilya Makarov
 *  Under MIT License
 */
!function(a,b){"function"==typeof define&&define.amd?define(["jquery"],b):b("object"==typeof exports?require("jquery"):a.jQuery)}(this,function(a){"use strict";function b(a){var b,c,d,e,f,g,h,i={};for(f=a.replace(/\s*:\s*/g,":").replace(/\s*,\s*/g,",").split(","),h=0,g=f.length;h<g&&(c=f[h],c.search(/^(http|https|ftp):\/\//)===-1&&c.search(":")!==-1);h++)b=c.indexOf(":"),d=c.substring(0,b),e=c.substring(b+1),e||(e=void 0),"string"==typeof e&&(e="true"===e||"false"!==e&&e),"string"==typeof e&&(e=isNaN(e)?e:+e),i[d]=e;return null==d&&null==e?a:i}function c(a){a=""+a;var b,c,d,e=a.split(/\s+/),f="50%",g="50%";for(d=0,b=e.length;d<b;d++)c=e[d],"left"===c?f="0%":"right"===c?f="100%":"top"===c?g="0%":"bottom"===c?g="100%":"center"===c?0===d?f="50%":g="50%":0===d?f=c:g=c;return{x:f,y:g}}function d(b,c){var d=function(){c(this.src)};a('<img src="'+b+'.gif">').on("load",d),a('<img src="'+b+'.jpg">').on("load",d),a('<img src="'+b+'.jpeg">').on("load",d),a('<img src="'+b+'.png">').on("load",d)}function e(c,d,e){if(this.$element=a(c),"string"==typeof d&&(d=b(d)),e?"string"==typeof e&&(e=b(e)):e={},"string"==typeof d)d=d.replace(/\.\w*$/,"");else if("object"==typeof d)for(var f in d)d.hasOwnProperty(f)&&(d[f]=d[f].replace(/\.\w*$/,""));this.settings=a.extend({},g,e),this.path=d;try{this.init()}catch(i){if(i.message!==h)throw i}}var f="vide",g={volume:1,playbackRate:1,muted:!0,loop:!0,autoplay:!0,position:"50% 50%",posterType:"detect",resizing:!0,bgColor:"transparent",className:""},h="Not implemented";e.prototype.init=function(){var b,e,f=this,g=f.path,i=g,j="",k=f.$element,l=f.settings,m=c(l.position),n=l.posterType;e=f.$wrapper=a("<div>").addClass(l.className).css({position:"absolute","z-index":-1,top:0,left:0,bottom:0,right:0,overflow:"hidden","-webkit-background-size":"cover","-moz-background-size":"cover","-o-background-size":"cover","background-size":"cover","background-color":l.bgColor,"background-repeat":"no-repeat","background-position":m.x+" "+m.y}),"object"==typeof g&&(g.poster?i=g.poster:g.mp4?i=g.mp4:g.webm?i=g.webm:g.ogv&&(i=g.ogv)),"detect"===n?d(i,function(a){e.css("background-image","url("+a+")")}):"none"!==n&&e.css("background-image","url("+i+"."+n+")"),"static"===k.css("position")&&k.css("position","relative"),k.prepend(e),"object"==typeof g?(g.mp4&&(j+='<source src="'+g.mp4+'.mp4" type="video/mp4">'),g.webm&&(j+='<source src="'+g.webm+'.webm" type="video/webm">'),g.ogv&&(j+='<source src="'+g.ogv+'.ogv" type="video/ogg">'),b=f.$video=a("<video>"+j+"</video>")):b=f.$video=a('<video><source src="'+g+'.mp4" type="video/mp4"><source src="'+g+'.webm" type="video/webm"><source src="'+g+'.ogv" type="video/ogg"></video>');try{b.prop({autoplay:l.autoplay,loop:l.loop,volume:l.volume,muted:l.muted,defaultMuted:l.muted,playbackRate:l.playbackRate,defaultPlaybackRate:l.playbackRate})}catch(o){throw new Error(h)}b.css({margin:"auto",position:"absolute","z-index":-1,top:m.y,left:m.x,"-webkit-transform":"translate(-"+m.x+", -"+m.y+")","-ms-transform":"translate(-"+m.x+", -"+m.y+")","-moz-transform":"translate(-"+m.x+", -"+m.y+")",transform:"translate(-"+m.x+", -"+m.y+")",visibility:"hidden",opacity:0}).one("canplaythrough.vide",function(){f.resize()}).one("playing.vide",function(){b.css({visibility:"visible",opacity:1}),e.css("background-image","none")}),k.on("resize.vide",function(){l.resizing&&f.resize()}),e.append(b)},e.prototype.getVideoObject=function(){return this.$video[0]},e.prototype.resize=function(){if(this.$video){var a=this.$wrapper,b=this.$video,c=b[0],d=c.videoHeight,e=c.videoWidth,f=a.height(),g=a.width();g/e>f/d?b.css({width:g+2,height:"auto"}):b.css({width:"auto",height:f+2})}},e.prototype.destroy=function(){delete a[f].lookup[this.index],this.$video&&this.$video.off(f),this.$element.off(f).removeData(f),this.$wrapper.remove()},a[f]={lookup:[]},a.fn[f]=function(b,c){var d;return this.each(function(){d=a.data(this,f),d&&d.destroy(),d=new e(this,b,c),d.index=a[f].lookup.push(d)-1,a.data(this,f,d)}),this},a(document).ready(function(){var b=a(window);b.on("resize.vide",function(){for(var b,c=a[f].lookup.length,d=0;d<c;d++)b=a[f].lookup[d],b&&b.settings.resizing&&b.resize()}),b.on("unload.vide",function(){return!1}),a(document).find("[data-vide-bg]").each(function(b,c){var d=a(c),e=d.data("vide-options"),g=d.data("vide-bg");d[f](g,e)})})});




/*!-----------------------------------------------------------------------------
 * Vegas - Fullscreen Backgrounds and Slideshows.
 * v2.4.3 - built 2018-09-18
 * Licensed under the MIT License.
 * http://vegas.jaysalvat.com/
 * ----------------------------------------------------------------------------
 * Copyright (C) 2010-2018 Jay Salvat
 * http://jaysalvat.com/
 * --------------------------------------------------------------------------*/
!function(b){"use strict";var e={slide:0,delay:5e3,loop:!0,preload:!1,preloadImage:!1,preloadVideo:!1,timer:!0,overlay:!1,autoplay:!0,shuffle:!1,cover:!0,color:null,align:"center",valign:"center",firstTransition:null,firstTransitionDuration:null,transition:"fade",transitionDuration:1e3,transitionRegister:[],animation:null,animationDuration:"auto",animationRegister:[],slidesToKeep:1,init:function(){},play:function(){},pause:function(){},walk:function(){},slides:[]},n={},t=function(t,s){this.elmt=t,this.settings=b.extend({},e,b.vegas.defaults,s),this.slide=this.settings.slide,this.total=this.settings.slides.length,this.noshow=this.total<2,this.paused=!this.settings.autoplay||this.noshow,this.ended=!1,this.$elmt=b(t),this.$timer=null,this.$overlay=null,this.$slide=null,this.timeout=null,this.first=!0,this.transitions=["fade","fade2","blur","blur2","flash","flash2","negative","negative2","burn","burn2","slideLeft","slideLeft2","slideRight","slideRight2","slideUp","slideUp2","slideDown","slideDown2","zoomIn","zoomIn2","zoomOut","zoomOut2","swirlLeft","swirlLeft2","swirlRight","swirlRight2"],this.animations=["kenburns","kenburnsLeft","kenburnsRight","kenburnsUp","kenburnsUpLeft","kenburnsUpRight","kenburnsDown","kenburnsDownLeft","kenburnsDownRight"],this.settings.transitionRegister instanceof Array==!1&&(this.settings.transitionRegister=[this.settings.transitionRegister]),this.settings.animationRegister instanceof Array==!1&&(this.settings.animationRegister=[this.settings.animationRegister]),this.transitions=this.transitions.concat(this.settings.transitionRegister),this.animations=this.animations.concat(this.settings.animationRegister),this.support={objectFit:"objectFit"in document.body.style,transition:"transition"in document.body.style||"WebkitTransition"in document.body.style,video:b.vegas.isVideoCompatible()},!0===this.settings.shuffle&&this.shuffle(),this._init()};t.prototype={_init:function(){var t,s,i,e="BODY"===this.elmt.tagName,n=this.settings.timer,o=this.settings.overlay,a=this;this._preload(),e||(this.$elmt.css("height",this.$elmt.css("height")),t=b('<div class="vegas-wrapper">').css("overflow",this.$elmt.css("overflow")).css("padding",this.$elmt.css("padding")),this.$elmt.css("padding")||t.css("padding-top",this.$elmt.css("padding-top")).css("padding-bottom",this.$elmt.css("padding-bottom")).css("padding-left",this.$elmt.css("padding-left")).css("padding-right",this.$elmt.css("padding-right")),this.$elmt.clone(!0).children().appendTo(t),this.elmt.innerHTML=""),n&&this.support.transition&&(i=b('<div class="vegas-timer"><div class="vegas-timer-progress">'),this.$timer=i,this.$elmt.prepend(i)),o&&(s=b('<div class="vegas-overlay">'),"string"==typeof o&&s.css("background-image","url("+o+")"),this.$overlay=s,this.$elmt.prepend(s)),this.$elmt.addClass("vegas-container"),e||this.$elmt.append(t),setTimeout(function(){a.trigger("init"),a._goto(a.slide),a.settings.autoplay&&a.trigger("play")},1)},_preload:function(){var t;for(t=0;t<this.settings.slides.length;t++)(this.settings.preload||this.settings.preloadImages)&&this.settings.slides[t].src&&((new Image).src=this.settings.slides[t].src),(this.settings.preload||this.settings.preloadVideos)&&this.support.video&&this.settings.slides[t].video&&(this.settings.slides[t].video instanceof Array?this._video(this.settings.slides[t].video):this._video(this.settings.slides[t].video.src))},_random:function(t){return t[Math.floor(Math.random()*t.length)]},_slideShow:function(){var t=this;1<this.total&&!this.ended&&!this.paused&&!this.noshow&&(this.timeout=setTimeout(function(){t.next()},this._options("delay")))},_timer:function(t){var s=this;clearTimeout(this.timeout),this.$timer&&(this.$timer.removeClass("vegas-timer-running").find("div").css("transition-duration","0ms"),this.ended||this.paused||this.noshow||t&&setTimeout(function(){s.$timer.addClass("vegas-timer-running").find("div").css("transition-duration",s._options("delay")-100+"ms")},100))},_video:function(t){var s,i,e=t.toString();return n[e]?n[e]:(t instanceof Array==!1&&(t=[t]),(s=document.createElement("video")).preload=!0,t.forEach(function(t){(i=document.createElement("source")).src=t,s.appendChild(i)}),n[e]=s)},_fadeOutSound:function(t,s){var i=this,e=s/10,n=t.volume-.09;0<n?(t.volume=n,setTimeout(function(){i._fadeOutSound(t,s)},e)):t.pause()},_fadeInSound:function(t,s){var i=this,e=s/10,n=t.volume+.09;n<1&&(t.volume=n,setTimeout(function(){i._fadeInSound(t,s)},e))},_options:function(t,s){return void 0===s&&(s=this.slide),void 0!==this.settings.slides[s][t]?this.settings.slides[s][t]:this.settings[t]},_goto:function(t){void 0===this.settings.slides[t]&&(t=0),this.slide=t;var s,i,e,n,o,a=this.$elmt.children(".vegas-slide"),r=this.settings.slides[t].src,h=this.settings.slides[t].video,d=this._options("delay"),l=this._options("align"),g=this._options("valign"),u=this._options("cover"),c=this._options("color")||this.$elmt.css("background-color"),p=this,m=a.length,f=this._options("transition"),v=this._options("transitionDuration"),y=this._options("animation"),_=this._options("animationDuration");function w(){p._timer(!0),setTimeout(function(){f&&(p.support.transition?(a.css("transition","all "+v+"ms").addClass("vegas-transition-"+f+"-out"),a.each(function(){var t=a.find("video").get(0);t&&(t.volume=1,p._fadeOutSound(t,v))}),s.css("transition","all "+v+"ms").addClass("vegas-transition-"+f+"-in")):s.fadeIn(v));for(var t=0;t<a.length-p.settings.slidesToKeep;t++)a.eq(t).remove();p.trigger("walk"),p._slideShow()},100)}this.settings.firstTransition&&this.first&&(f=this.settings.firstTransition||f),this.settings.firstTransitionDuration&&this.first&&(v=this.settings.firstTransitionDuration||v),this.first&&(this.first=!1),"repeat"!==u&&(!0===u?u="cover":!1===u&&(u="contain")),("random"===f||f instanceof Array)&&(f=f instanceof Array?this._random(f):this._random(this.transitions)),("random"===y||y instanceof Array)&&(y=y instanceof Array?this._random(y):this._random(this.animations)),("auto"===v||d<v)&&(v=d),"auto"===_&&(_=d),s=b('<div class="vegas-slide"></div>'),this.support.transition&&f&&s.addClass("vegas-transition-"+f),this.support.video&&h?((n=h instanceof Array?this._video(h):this._video(h.src)).loop=void 0===h.loop||h.loop,n.muted=void 0===h.mute||h.mute,!1===n.muted?(n.volume=0,this._fadeInSound(n,v)):n.pause(),e=b(n).addClass("vegas-video").css("background-color",c),this.support.objectFit?e.css("object-position",l+" "+g).css("object-fit",u).css("width","100%").css("height","100%"):"contain"===u&&e.css("width","100%").css("height","100%"),s.append(e)):(o=new Image,i=b('<div class="vegas-slide-inner"></div>').css("background-image",'url("'+r+'")').css("background-color",c).css("background-position",l+" "+g),"repeat"===u?i.css("background-repeat","repeat"):i.css("background-size",u),this.support.transition&&y&&i.addClass("vegas-animation-"+y).css("animation-duration",_+"ms"),s.append(i)),this.support.transition||s.css("display","none"),m?a.eq(m-1).after(s):this.$elmt.prepend(s),a.css("transition","all 0ms").each(function(){this.className="vegas-slide","VIDEO"===this.tagName&&(this.className+=" vegas-video"),f&&(this.className+=" vegas-transition-"+f,this.className+=" vegas-transition-"+f+"-in")}),p._timer(!1),n?(4===n.readyState&&(n.currentTime=0),n.play(),w()):(o.src=r,o.complete?w():o.onload=w)},_end:function(){this.settings.autoplay?this.ended=!1:this.ended=!0,this._timer(!1),this.trigger("end")},shuffle:function(){for(var t,s,i=this.total-1;0<i;i--)s=Math.floor(Math.random()*(i+1)),t=this.settings.slides[i],this.settings.slides[i]=this.settings.slides[s],this.settings.slides[s]=t},play:function(){this.paused&&(this.paused=!1,this.next(),this.trigger("play"))},pause:function(){this._timer(!1),this.paused=!0,this.trigger("pause")},toggle:function(){this.paused?this.play():this.pause()},playing:function(){return!this.paused&&!this.noshow},current:function(t){return t?{slide:this.slide,data:this.settings.slides[this.slide]}:this.slide},jump:function(t){t<0||t>this.total-1||t===this.slide||(this.slide=t,this._goto(this.slide))},next:function(){if(this.slide++,this.slide>=this.total){if(!this.settings.loop)return this._end();this.slide=0}this._goto(this.slide)},previous:function(){if(this.slide--,this.slide<0){if(!this.settings.loop)return void this.slide++;this.slide=this.total-1}this._goto(this.slide)},trigger:function(t){var s=[];s="init"===t?[this.settings]:[this.slide,this.settings.slides[this.slide]],this.$elmt.trigger("vegas"+t,s),"function"==typeof this.settings[t]&&this.settings[t].apply(this.$elmt,s)},options:function(t,s){var i=this.settings.slides.slice();if("object"==typeof t)this.settings=b.extend({},e,b.vegas.defaults,t);else{if("string"!=typeof t)return this.settings;if(void 0===s)return this.settings[t];this.settings[t]=s}this.settings.slides!==i&&(this.total=this.settings.slides.length,this.noshow=this.total<2,this._preload())},destroy:function(){clearTimeout(this.timeout),this.$elmt.removeClass("vegas-container"),this.$elmt.find("> .vegas-slide").remove(),this.$elmt.find("> .vegas-wrapper").clone(!0).children().appendTo(this.$elmt),this.$elmt.find("> .vegas-wrapper").remove(),this.settings.timer&&this.$timer.remove(),this.settings.overlay&&this.$overlay.remove(),this.elmt._vegas=null}},b.fn.vegas=function(s){var i,e=arguments,n=!1;if(void 0===s||"object"==typeof s)return this.each(function(){this._vegas||(this._vegas=new t(this,s))});if("string"==typeof s){if(this.each(function(){var t=this._vegas;if(!t)throw new Error("No Vegas applied to this element.");"function"==typeof t[s]&&"_"!==s[0]?i=t[s].apply(t,[].slice.call(e,1)):n=!0}),n)throw new Error('No method "'+s+'" in Vegas.');return void 0!==i?i:this}},b.vegas={},b.vegas.defaults=e,b.vegas.isVideoCompatible=function(){return!/(Android|webOS|Phone|iPad|iPod|BlackBerry|Windows Phone)/i.test(navigator.userAgent)}}(window.jQuery||window.Zepto);
//# sourceMappingURL=vegas.min.js.map







/*
Mouse Parallax
==============
A simple jQuery plugin to allow given elements to be used as backgrounds that respond to mouse movement.  Could easily be further extended or modified.
--------------
Author: "Pip Beard Design," Benjamin Alan Robinson
LICENSE: The MIT License (MIT)
*/

(function ( $ ) {
    $.fn.extend({
    
        mouseParallax: function(options) {
        
            var defaults = { moveFactor: 5, zIndexValue: "-1", targetContainer: '.construction-wrap, .working-process-style-1' };
        
            var options = $.extend(defaults, options);
        
            return this.each(function() {
                var o = options;
                var background = $(this);
                
                $(o.targetContainer).on('mousemove', function(e){
                
                    mouseX = e.pageX;
                    mouseY = e.pageY;
                    
                    windowWidth = $(window).width();
                    windowHeight = $(window).height();
                    
                    percentX = ((mouseX/windowWidth)*o.moveFactor) - (o.moveFactor/2);
                    percentY = ((mouseY/windowHeight)*o.moveFactor) - (o.moveFactor/2);
    
                    leftString = (0-percentX-o.moveFactor)+"%";
                    rightString = (0-percentX-o.moveFactor)+"%";
                    topString = (0-percentY-o.moveFactor)+"%";
                    bottomString = (0-percentY-o.moveFactor)+"%";
    
                    background[0].style.left = leftString;
                    background[0].style.right = rightString;
                    background[0].style.top = topString;
                    background[0].style.bottom = bottomString;
                    if(o.zIndexValue) { 
                        background[0].style.zIndex = o.zIndexValue;
                    }
                });
            });
        }                   
    });
} (jQuery) );








