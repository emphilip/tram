  // --------------------------------------------------
  // Private vars
  /*global $, P, easing */
  
  var doc = document;
  var win = window;
  var store = 'bkwld-tram-js';
  var slice = Array.prototype.slice;
  var testStyle = doc.createElement('a').style;
  var domPrefixes = ['Webkit', 'Moz', 'O', 'ms'];
  var cssPrefixes = ['-webkit-', '-moz-', '-o-', '-ms-'];
  
  var typeNumber = 'n';
  var typeColor = '# rgb rgba';
  var typeLength = 'em cm mm in pt pc px';
  var typePercent = '%';
  var typeDegrees = 'deg';
  var typePixels = 'px';
  
  // --------------------------------------------------
  // Private functions
  
  // Simple feature detect, returns both dom + css prefixed names
  var testFeature = function (prop) {
    // unprefixed case
    if (prop in testStyle) return { dom: prop, css: prop };
    // test all prefixes
    var i, domProp, domSuffix = prop.charAt(0).toUpperCase() + prop.slice(1);
    for (i = 0; i < domPrefixes.length; i++) {
      domProp = domPrefixes[i] + domSuffix;
      if (domProp in testStyle) return { dom: domProp, css: cssPrefixes[i] + prop };
    }
  };
  
  // Feature tests
  var support = $.extend({}, $.support, {
      bind: Function.prototype.bind
    , transform: testFeature('transform')
    , transition: testFeature('transition')
  });
  
  // Animation timer shim with setTimeout fallback
  var enterFrame = function () {
    return win.requestAnimationFrame ||
    win.webkitRequestAnimationFrame ||
    win.mozRequestAnimationFrame ||
    win.oRequestAnimationFrame ||
    win.msRequestAnimationFrame ||
    function (callback) {
      win.setTimeout(callback, 16);
    };
  }();
  
  // Timestamp shim with fallback
  var timeNow = function () {
    // use high-res timer if available
    var perf = win.performance,
      perfNow = perf && (perf.now || perf.webkitNow || perf.msNow || perf.mozNow);
    if (perfNow && support.bind) {
      return perfNow.bind(perf);
    }
    // fallback to epoch-based timestamp
    return Date.now || function () {
      return +(new Date);
    };
  }();
  
  // --------------------------------------------------
  // Transition class - public API returned from the tram() wrapper.
  
  var Transition = P(function(proto) {
    
    proto.init = function (el) {
      this.el = el;
      this.$el = $(el);
      this.props = {};
      this.queue = [];
    };
    
    // Public chainable methods
    chain('add', add);
    chain('start', start);
    chain('stop', stop);
    
    function add(transition, options) {
      // Parse transition settings
      var settings = compact(('' + transition).split(' '));
      var name = settings.shift();
      
      // Get property definition from map
      var definition = propertyMap[name];
      if (!definition) return warn('Unsupported property: ' + name);
      definition = definition.slice();
      
      // Init property with settings + definition + options
      var Class = definition.shift();
      var prop = this.props[name];
      if (prop && prop.Property) {
        prop.init(settings, definition, options);
      } else {
        this.props[name] = new Class(settings, definition, options);
      }
    }
    
    function start(options) {
      // If the first argument is an array, use that as the arguments instead.
      var args = $.isArray(options) ? options : slice.call(arguments);
      if (!args.length) return this;
      
      // Push extra arguments into queue
      if (args.length > 1) this.queue = this.queue.concat(args.slice(1));
      
      // Begin processing the current item
      var current = args[0];
      if (!current) return this;
      
      // If current is a function, invoke it.
      if (typeof current === 'function') return current(this);
      
      // If current is an object, check for valid props.
      if (typeof current === 'object') {
        for (var x in current) {
          var prop = this.props[x];
          if (!prop || !prop.Property) continue;
          console.log('process', x);
        }
      }
      
      // TODO redraw(el) before tween
    }
    
    function stop(property) {
      if (property in this.props) {
        // TODO stop property or stop all
      }
    }
    
    // Define a chainable method that takes children into account
    function chain(name, method) {
      proto[name] = function () {
        if (this.children) return each.call(this, method, arguments);
        method.apply(this, arguments);
        return this;
      };
    }
    
    // Iterate through children and apply the method
    function each(method, args) {
      var i, count = this.children.length;
      for (i = 0; i < count; i++) {
        method.apply(this.children[i], args);
      }
      return this;
    }
    
    // Redraw element for styles to take effect
    function redraw(el) {
      var r = el.offsetHeight;
    }
  });
  
  // Tram class - extends Transition + wraps child instances for chaining.
  var Tram = P(Transition, function (proto) {
    
    proto.init = function (args) {
      var $elems = $(args[0]);
      var options = args.slice(1);
      
      // Invalid selector, do nothing.
      if (!$elems.length) return this;
      
      // Single case - return single Transition instance
      if ($elems.length === 1) return factory($elems[0], options);
      
      // Store multiple instances for chaining
      var children = [];
      $elems.each(function (index, el) {
        children.push(factory(el, options));
      });
      this.children = children;
      return this;
    };
    
    // Retrieve instance from data or create a new one.
    function factory(el, options) {
      var t = $.data(el, store) || $.data(el, store, new Transition.Bare());
      if (!t.el) t.init(el);
      if (options.length) return t.start(options);
      return t;
    }
  });
  
  // --------------------------------------------------
  // Property class - get/set property values
  
  var Property = P(function (proto) {
    proto.Property = true;
    
    var defaults = {
        duration: 500
      , ease: 'ease'
      , delay: 0
    };
    
    proto.init = function (settings, definition) {
      // Initialize or extend settings
      this.duration = validTime(settings[0], this.duration, defaults.duration);
      this.ease = validEase(settings[1], this.ease, defaults.ease);
      this.delay = validTime(settings[2], this.delay, defaults.delay);
      // Store types array for setters
      this.types = definition;
      // TODO use options to override gpuTransforms value?
    };
    
    // Normalize time values
    var ms = /ms/;
    var sec = /s|\./;
    function validTime(string, current, safe) {
      if (current !== undefined) safe = current;
      if (string === undefined) return safe;
      var n = safe;
      // if string contains 'ms' or contains no suffix
      if (ms.test(string) || !sec.test(string)) {
        n = parseInt(string, 10);
      // otherwise if string contains 's' or a decimal point
      } else if (sec.test(string)) {
        n = parseFloat(string) * 1000;
      }
      if (n < 0) n *= -1; // positive only plz
      return n === n ? n : safe; // protect from NaNs
    }
    
    // Make sure ease exists
    function validEase(ease, current, safe) {
      if (current !== undefined) safe = current;
      return ease in easing ? ease : safe;
    }
  });
      
  // Transform - special combo property
  var Transform = P(Property, function (proto) {
    // TODO add option for gpu triggers
    // backface-visibility(hidden);
    // translate3d(0,0,0);
    
    proto.init = function () {
      
    };
  });
  
  // --------------------------------------------------
  // Tween class - handles timing and fallback animation.
  
  var Tween = P(function (proto) {
    proto.init = function () {
    };
  });
  
  // --------------------------------------------------
  // Main wrapper - returns a Tram instance with public chaining API.
  
  function tram() {
    // Chain on the result of Tram.init() to optimize single case.
    var wrap = new Tram.Bare();
    return wrap.init(slice.call(arguments));
  }
  
  // Global tram config
  tram.config = {
      baseFontSize: 16 // used by remFallback
    , remFallback: false // TODO add rem fallback for px length values
    , defaultUnit: typePixels // default unit added to <length> types
    , gpuTransforms: true // always prepend gpu cache trick to transforms
  };
  
  // macro() static method
  tram.macro = function () {
    // TODO
  };
  
  // tween() static method
  tram.tween = function () {
    // TODO
  };
  
  // jQuery plugin method, keeps jQuery chain intact.
  $.fn.tram = function (args) {
    // Pass along element as first argument
    args = [this].concat(slice.call(arguments));
    // Directly instantiate Tram class, no tram chain!
    new Tram(args);
    return this;
  };
  
  // --------------------------------------------------
  // Property map + unit values
  
  var propertyMap = (function (Prop) {
    
    var color = typeColor;
    var number = typeNumber;
    var length = typeLength;
    var percent = typePercent;
    var deg = typeDegrees;
    var px = typePixels;
    
    // Transform sub-properties { name: [ realName, units ]}
    Transform.map = {
        x:            [ 'translateX', px ]
      , y:            [ 'translateY', px ]
      , z:            [ 'translateZ', px ]
      , rotate:       [ '', deg ]
      , rotateX:      [ '', deg ]
      , rotateY:      [ '', deg ]
      , rotateZ:      [ '', deg ]
      , scale:        [ '', number ]
      , scaleX:       [ '', number ]
      , scaleY:       [ '', number ]
      , scaleZ:       [ '', number ]
      , skew:         [ '', deg ]
      , skewX:        [ '', deg ]
      , skewY:        [ '', deg ]
      , perspective:  [ '', px ]
    };
    
    // Main Property map { name: [ class, units ]}
    return {
        'color'                : [ Prop, color ]
      , 'background-color'     : [ Prop, color ]
      , 'outline-color'        : [ Prop, color ]
      , 'border-color'         : [ Prop, color ]
      , 'border-top-color'     : [ Prop, color ]
      , 'border-right-color'   : [ Prop, color ]
      , 'border-bottom-color'  : [ Prop, color ]
      , 'border-left-color'    : [ Prop, color ]
      , 'border-width'         : [ Prop, length ]
      , 'border-top-width'     : [ Prop, length ]
      , 'border-right-width'   : [ Prop, length ]
      , 'border-bottom-width'  : [ Prop, length ]
      , 'border-left-width'    : [ Prop, length ]
      , 'border-spacing'       : [ Prop, length ]
      , 'letter-spacing'       : [ Prop, length ]
      , 'margin'               : [ Prop, length ]
      , 'margin-top'           : [ Prop, length ]
      , 'margin-right'         : [ Prop, length ]
      , 'margin-bottom'        : [ Prop, length ]
      , 'margin-left'          : [ Prop, length ]
      , 'padding'              : [ Prop, length ]
      , 'padding-top'          : [ Prop, length ]
      , 'padding-right'        : [ Prop, length ]
      , 'padding-bottom'       : [ Prop, length ]
      , 'padding-left'         : [ Prop, length ]
      , 'outline-width'        : [ Prop, length ]
      , 'opacity'              : [ Prop, number ]
      , 'top'                  : [ Prop, length, percent ]
      , 'right'                : [ Prop, length, percent ]
      , 'bottom'               : [ Prop, length, percent ]
      , 'left'                 : [ Prop, length, percent ]
      , 'font-size'            : [ Prop, length, percent ]
      , 'text-indent'          : [ Prop, length, percent ]
      , 'word-spacing'         : [ Prop, length, percent ]
      , 'width'                : [ Prop, length, percent ]
      , 'min-width'            : [ Prop, length, percent ]
      , 'max-width'            : [ Prop, length, percent ]
      , 'height'               : [ Prop, length, percent ]
      , 'min-height'           : [ Prop, length, percent ]
      , 'max-height'           : [ Prop, length, percent ]
      , 'background-position'  : [ Prop, length, percent ]
      , 'line-height'          : [ Prop, number, length, percent ]
      , 'transform'            : [ Transform ]
      , 'transform-origin'     : [ Prop, length, percent ]
    };
  }(Property));
  
  // --------------------------------------------------
  // Utils
  
  // Log warning message if supported
  var warn = (function () {
    var warn = 'warn';
    var console = window.console;
    if (console && console[warn] && support.bind) return console[warn].bind(console);
    return function () {};
  }());
  
  // Lo-Dash compact()
  // Creates an array with all falsey values of `array` removed
  // MIT license <http://lodash.com/license>
  function compact(array) {
    var index = -1,
        length = array ? array.length : 0,
        result = [];

    while (++index < length) {
      var value = array[index];
      if (value) {
        result.push(value);
      }
    }
    return result;
  }
  
  // --------------------------------------------------
  // Export public module.
  return $.tram = tram;
