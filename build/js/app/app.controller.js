'use strict';
var ADC_LSB = 0.030517578125;
// padding left
String.prototype.padLeft = function(paddingChar, length) {
    var s = new String(this);
    if ((this.length < length) && (paddingChar.toString().length > 0)) {
        for (var i = 0; i < (length - this.length); i++) s = paddingChar.toString().charAt(0).concat(s);
    }
    return s;
};
angular.module('griffinApp').controller('appController', appController);
appController.$inject = ['$mdSidenav', '$scope', '$timeout', 'frontendSocket'];

function appController($mdSidenav, $scope, $timeout, frontendSocket) {
    var ctrl = this;
    var i;
    var n;
    var last_updated;
    // Initialize Constructor
    (function init() {
        ctrl.title = "GRIF-C";
        ctrl.channelSelected = null;
        ctrl.channel = [];
        ctrl.channel.display = {};
        ctrl.channel.data = "";
        ctrl.channel.last_updated = Date.now();
    })();
    ctrl.onChannelSelect = function(key) {
        ctrl.channelSelected = ctrl.channels[key];
    };
    ctrl.updateChart = function() {
        if (ctrl.channel.ready == 1) {
            ctrl.channel.display.seqID = ctrl.channel.seqID;
            ctrl.channel.display.hwID = ctrl.channel.hwID;
            ctrl.channel.display.build = ctrl.channel.build;
            ctrl.channel.display.timestamp = ctrl.channel.timestamp;
            ctrl.channel.display.offset = ctrl.channel.offset;
            ctrl.channel.display.moduleId = ctrl.channel.moduleId;
            ctrl.channel.display.channelType = ctrl.channel.channelType;
            ctrl.channel.display.channelID = ctrl.channel.channelID;
            ctrl.channel.display.sampleCnt = ctrl.channel.sampleCnt;
            ctrl.channel.updated = Date.now();
        }
        $timeout(ctrl.updateChart, 15);
    }
    frontendSocket.on('udp_message', function(data) {
        var dv = new DataView(data.message);
        var sample_offset = 30;
        ctrl.channel.seqID = dv.getUint16(0, false);
        ctrl.channel.hwID = "0x" + (dv.getUint32(2, false).toString(16) + dv.getUint32(6, false).toString(16)).toUpperCase().padLeft(
            '0', 16);
        var t = new Date(parseInt(dv.getUint32(10, false)) * 1000);
        ctrl.channel.build = t.toLocaleString();
        ctrl.channel.timestamp = "0x" + (dv.getUint16(16, false) * Math.pow(2, 32) + dv.getUint32(18, false)).toString(16).toUpperCase()
            .padLeft('0', 12);
        ctrl.channel.offset = dv.getInt32(22, false);
        ctrl.channel.moduleId = dv.getUint8(26, false);
        ctrl.channel.channelType = dv.getUint8(27, false);
        ctrl.channel.channelID = dv.getUint8(27, false);
        ctrl.channel.sampleCnt = dv.getUint16(28, false);
        if (ctrl.channel.data == "") {
            ctrl.channel.data = [];
            ctrl.channel.num_series = 1;
            for (i = 0; i < ctrl.channel.sampleCnt; i++) {
                ctrl.channel.data.push([]);
                ctrl.channel.data[i].push(i * 10);
                for (n = 0; n < ctrl.channel.num_series; n++) {
                    ctrl.channel.data[i].push(0);
                }
            }
        }
        if (ctrl.channel.last_updated != ctrl.channel.updated) {
            ctrl.channel.last_updated = ctrl.channel.updated;
            // Break out data into series
            for (i = 0; i < ctrl.channel.sampleCnt; i++) {
                for (n = 0; n < ctrl.channel.num_series; n++) {
                    ctrl.channel.data[i][n + 1] = dv.getInt16(sample_offset + (i * 2) + (ctrl.channel.sampleCnt * n * 2), false) *
                        ADC_LSB;
                }
            }
        }
        ctrl.channel.ready = 1;
    });
    $timeout(ctrl.updateChart, 15);
}
angular.module('griffinApp').factory('frontendSocket', frontendSocketFactory);

function frontendSocketFactory(socketFactory) {
    return socketFactory();
};
angular.module('griffinApp').directive('chart', function($compile) {
    return {
        restrict: 'E',
        link: function(scope, elem, attrs) {
            var allowToFire = true;
            var chart;
            var defaultLabelHTML = undefined;
            scope.$watch(attrs.updated, function() {
                if (!chart) {
                    Init();
                }
                if (chart && allowToFire) {
                    chart.updateOptions({
                        "title": attrs.channeltitle,
                        "file": scope.app.channel.data
                    });
                }
                if (chart) {
                    chart.resize();
                }
            }, true);

            function Init() {
                var legend = document.getElementById(attrs.legend);
                var labels = attrs.labels.split(",");
                labels.unshift("X");
                chart = new Dygraph(elem[0], scope.app.channel.data, {
                    //adding tick options
                    axes: {},
                    //end
                    title: attrs.channeltitle,
                    xlabel: attrs.xtitle,
                    ylabel: attrs.ytitle,
                    labels: labels,
                    strokeWidth: 1.5,
                    highlightCircleSize: 0,
                    axisLabelColor: '#EFEFEF',
                    axisLineColor: '#999999',
                    gridLineColor: '#999999',
                    titleHeight: 22,
                    animatedZooms: false,
                    stepPlot: false,
                    labelsDiv: legend,
                    legend: 'always',
                    showRangeSelector: false,
                    yRangePad: 0, // Adding this makes sure the top the of the yAxis has a tick
                    xRangePad: 2, // Adding this makes sure the right the of the xAxis has a tick
                    includeZero: true,
                    colors: ['#F1C40F', '#2ECC71', '#E74C3C', '#4C30F1', '#1ABC9C', '#E67E22', '#9B59B6'],
                    valueRange: [parseInt(attrs.ymin), parseInt(attrs.ymax)],
                    interactionModel: {
                        'mousedown': function(event, g, context) {
                            allowToFire = false;
                            context.initializeMouseDown(event, g, context);
                            Dygraph.startZoom(event, g, context);
                            event.preventDefault();
                            event.stopPropagation();
                        },
                        'mousemove': function(event, g, context) {
                            Dygraph.moveZoom(event, g, context);
                            event.preventDefault();
                            event.stopPropagation();
                        },
                        'mouseup': function(event, g, context) {
                            Dygraph.endZoom(event, g, context);
                            allowToFire = true;
                            event.preventDefault();
                            event.stopPropagation();
                        },
                        'dblclick': function(event, g, context) {
                            chart.updateOptions({
                                dateWindow: null,
                                "valueRange": [parseInt(attrs.ymin), parseInt(attrs.ymax)]
                            });
                        }
                    },
                    zoomCallback: function(minDate, maxDate, yRanges) {
                        chart.updateOptions({
                            "valueRange": yRanges[0]
                        });
                    }
                });
            }
        }
    }
});
angular.module('griffinApp').directive('heatmap', function() {
    return {
        restrict: 'E',
        bindToController: true,
        controllerAs: 'ctrl',
        controller: ['frontendSocket',
            function(frontendSocket) {
                var ctrl = this;
                ctrl.multiply = 0.9;
                ctrl.blur = false;
                ctrl.size = 6;
                ctrl.intensity = 0.9;
                ctrl.last_timestamp = null;
                frontendSocket.on('udp_message', function(data) {
                    var dv = new DataView(data.message);
                    var sample_offset = 30;
                    var sampleCnt = dv.getUint16(28, false);
                    var xadjust = ctrl.heatmap.canvas.width / (sampleCnt - 1);
                    var yadjust = ctrl.heatmap.canvas.height / 65536;
                    for (var n = 0; n < sampleCnt; n++) {
                        ctrl.heatmap.addPoint(n * xadjust, dv.getInt16(sample_offset + (n * 2), false) * yadjust + (
                            ctrl.heatmap.canvas.height / 2), ctrl.size, ctrl.intensity);
                    }
                    ctrl.heatmap.update();
                });
                ctrl.animate = function(timestamp) {
                    ctrl.stats.begin();
                    if (!ctrl.last_timestamp) ctrl.last_timestamp = timestamp;
                    var time_diff = timestamp - ctrl.last_timestamp;
                    var multi = ctrl.multiply * (16.6666666 / time_diff);
                    ctrl.last_timestamp = timestamp;
                    ctrl.heatmap.canvas.width = ctrl.heatmap.canvas.parentNode.clientWidth;
                    ctrl.heatmap.canvas.height = ctrl.heatmap.canvas.parentNode.clientHeight;
                    ctrl.heatmap.adjustSize();
                    if (ctrl.blur) {
                        ctrl.heatmap.blur();
                    }
                    ctrl.heatmap.display();
                    ctrl.heatmap.multiply(multi);
                    ctrl.stats.end();
                    window.requestAnimationFrame(ctrl.animate);
                }
                window.requestAnimationFrame(ctrl.animate);
            }],
        link: function(scope, elem, attrs) {
                var canvas = document.createElement("canvas");
                scope.ctrl.heatmap = createWebGLHeatmap({
                    canvas: canvas,
                    intensityToAlpha: true,
                    //gradientTexture: 'img/skyline-gradient.png'
                });
                scope.ctrl.stats = new Stats();
                scope.ctrl.stats.setMode(0); // 0: fps, 1: ms, 2: mb, 3+: custom
                scope.ctrl.stats.domElement.style.position = 'absolute';
                scope.ctrl.stats.domElement.style.right = '0px';
                scope.ctrl.stats.domElement.style.top = '0px';
                elem[0].appendChild(scope.ctrl.heatmap.canvas);
                elem[0].appendChild(scope.ctrl.stats.domElement);

            }

        /*,template:
            '<div layout=column style="background-color: #1F1F1F; opacity: 0.8; position: absolute; top: 0; left: 0;">'+
            '<md-input-container flex-gt-sm>' +
            '<label>Multiply</label>' +
            '<input type=number min=0.0 max=100.0 step=0.005 ng-model="ctrl.multiply">' +
            '</md-input-container>' +
            '<md-input-container flex-gt-sm>' +
            '<label>Size</label>' +
            '<input type=number min=0.5 max=20.0 step=0.5 ng-model="ctrl.size">' +
            '</md-input-container>' +
            '<md-input-container flex-gt-sm>' +
            '<label>Intensity</label>' +
            '<input type=number min=0.0 max=5.0 step=0.1 ng-model="ctrl.intensity">' +
            '</md-input-container>' +
            '<md-switch ng-model="ctrl.blur">' +
            'Blur</md-switch>' +
            '</div>'*/
        
    }
});

angular.module('griffinApp').directive('chart3d', function() {
    return {
        restrict: 'E',
        bindToController: true,
        controllerAs: 'ctrl',
        controller: ['frontendSocket',
            function(frontendSocket) {
                var ctrl = this;
                var dv;
                var lines_init = false;
                ctrl.clear          = false;
                ctrl.last_timestamp = null;
                ctrl.zoomx          = 1.02;
                ctrl.zoomed         = false;
                ctrl.just_zoomed    = false;
                ctrl.just_unzoomed  = false;
                ctrl.mix_amount     = -0.03;
                ctrl.run            = true;
                ctrl.single         = false;
                ctrl.manual_control = false;
                ctrl.controls_hidden= false;
                ctrl.runstop_status = 'Run';
                ctrl.begin_timestamp;
                ctrl.refresh_sec    = 10;
                ctrl.max_time       = 0;    //will update when receiving info
                ctrl.x_mult         = 1;
                ctrl.mouse_dragging = false;
                ctrl.l_mouse_down   = false;
                ctrl.time_division  = 1;
                ctrl.colors         = [];
                ctrl.channels       = [];
                ctrl.currentChannel = 0;
                ctrl.prezoom_increments = [];
                ctrl.minimap_mousedown  = false;
                ctrl.minimum_window_sz  = 400;
                ctrl.horizontal_cursor  = false;
                ctrl.vertical_cursor    = false;
                ctrl.h_cursor_output    = '';
                ctrl.h_cursor_val_pos   = 0;
                ctrl.v_cursor_val_pos   = 0;
                ctrl.prev_mix_amount    = 0;
                ctrl.helpbox            = null;
                ctrl.helpbox_displayed  = false;
                ctrl.horizontal_cursor_elem = document.getElementById('horizontal_cursor_value');
                ctrl.vertical_cursor_elem   = document.getElementById('vertical_cursor_value');
                var Channel = function(){
                    this.color      = '';
                    this.name       = '';
                    this.wf_num;
                    this.visible    = true;
                    this.y_mult     = 1;
                    this.y_division = 1;
                    this.updateDivision = function(newValue){
                        if(angular.isDefined(newValue) && parseInt(newValue) > 0){
                            this.y_division = parseInt(newValue);
                            if(this.divisionValueValid()){
                                var top     = Math.round(ctrl.scaleBetween(ctrl.lines.currentTop, -1000, 1000, -1, 1));
                                var bottom  = Math.round(ctrl.scaleBetween(ctrl.lines.currentBottom, -1000, 1000, -1, 1));
                                this.y_mult = (Math.abs(top - bottom) / ctrl.num_divs) / this.y_division;
                            }
                        }
                        return this.y_division;
                    };
                    this.divisionValueValid = function(){
                        if (Math.ceil(this.y_division) > 0 && Math.round(this.y_division) <= 400) {
                            var elems = document.getElementsByClassName('div_info');
                            var step  = 0;
                            if (this.y_division >= 10 && this.y_division <= 50) {
                                step  = 5;
                            } else if (this.y_division > 50 && this.y_division <= 200) {
                                step  = 10;
                            } else if (this.y_division > 200 && this.y_division <= 500) {
                                step  = 10;
                            } else {
                                step  = 1;
                            }
                            for (var i = 0; i < elems.length; i++) elems[i].step = step;
                            return true;
                        }
                        this.y_division = this.y_division < 0 ? 0 : this.y_division > 200 ? 400 : 200;
                        return false;
                    };
                };
                ctrl.rgbToHex = function(rgb){ //bit fiddles
                    return "#" + ((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1);
                };
                ctrl.hexToRgb = function(hex){
                    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                    return result ? {
                        r: parseInt(result[1], 16), /*r*/
                        g: parseInt(result[2], 16), /*g*/
                        b: parseInt(result[3], 16), /*b*/
                    } : null;
                };
                frontendSocket.on('udp_message', function(data) {
                    if(ctrl.single && ctrl.run){ 
                        ctrl.run = !ctrl.run;
                        ctrl.lines.clearFlag = true;
                    } 
                    if(ctrl.run || ctrl.single) dv = new DataView(data.message);
                    var sample_offset  = 31;
                    var sampleCnt      = dv.getUint16(28, false);
                    ctrl.max_time      = parseInt(sampleCnt);
                    ctrl.lines.max_time= ctrl.max_time;
                    var num_channels   = dv.getUint8(30, false);
                    var xadjust        = (ctrl.lines.canvas.width / (sampleCnt - 1))*1.02;
                    var yadjust        = ctrl.lines.canvas.height / 65536;
                    var next_channel_multiplier = 0;
                    var next_channel_counter    = 0;
                    if(!lines_init) { 
                        for(var i = 0; i < num_channels; i++){
                            ctrl.channels.push(new Channel());
                            ctrl.channels[i].color = ctrl.rgbToHex(ctrl.colors[i]);
                            ctrl.channels[i].name  = ctrl.channel_labels[i];
                            ctrl.channels[i].wf_num= i;
                        }
                        ctrl.lines.initChannels(num_channels, ctrl.colors); 
                        lines_init = true; 
                    }
                    if (num_channels != ctrl.channels.length) location.reload();
                    for(var i = 0 ; i < num_channels; i++){
                        var pts = [];
                        for (var n = 0; n < sampleCnt; n++) {
                            pts.push(n * xadjust * ctrl.x_mult);
                            pts.push((dv.getInt16((sample_offset + (next_channel_multiplier)) + (n * 2), false) * ctrl.channels[i].y_mult * yadjust + (
                                                            ctrl.lines.canvas.height / 2)));
                        }
                        next_channel_counter   += 2;
                        next_channel_multiplier = sampleCnt * next_channel_counter;
                        ctrl.lines.update(pts, i, ctrl.channels[i].visible);
                    }
                    ctrl.single = false;
                });
                ctrl.buildColorArray = function(colors){
                    var arr = colors.split(',');
                    var index;
                    for(index in arr){
                        ctrl.colors.push(ctrl.hexToRgb(arr[index]));
                    }
                };
                ctrl.getTitleElement = function(title){
                    var elem              = document.createElement('p');
                    elem.setAttribute('id','title_element');
                    elem.innerHTML        = '&nbsp;&nbsp;' + title;
                    elem.style.position   = 'absolute';
                    elem.style.fontFamily = 'Monospace';
                    elem.style.left       = 0;
                    elem.style.top        = '0.7%';
                    elem.style.lineHeight = '0px';
                    elem.className        = 'noselect noIbar unselectable';
                    return elem;
                };
                ctrl.getXAxisIncrements = function(){
                    var canvasWidth = ctrl.lines.canvasParent.offsetWidth;
                    var elem                = document.createElement('label');
                    elem.setAttribute('id','xaxis_element');
                    elem.style.position     = 'absolute';
                    elem.style.left         = 0;
                    elem.style.bottom       = 0;
                    elem.style.fontFamily   = 'Monospace';
                    for(var i = 0, j = 0; j <= ctrl.num_divs/*i <= canvasWidth*/; i += Math.floor(canvasWidth/10), j++){
                        var text              = document.createElement('span');
                        text.setAttribute('id','xlabel' + j);
                        text.style.left       = j === 10 ? (i - 20) + 'px' : i + 'px';
                        text.style.fontFamily = 'Monospace';
                        text.style.position   = 'absolute';
                        text.innerHTML        = 0;
                        text.className        = 'noselect noIbar unselectable';
                        elem.appendChild(text);
                    }
                    return elem;
                };
                ctrl.getYAxisIncrements = function(){
                    var width_adj = -65;
                    var height    = ctrl.lines.canvasParent.offsetHeight;
                    var elem      = document.createElement('p');
                    elem.setAttribute('id','yaxis_element');
                    elem.style.marginLeft = width_adj + 'px';
                    elem.style.fontFamily = 'Monospace';
                    for(var i = height, j = 0; j <= ctrl.num_divs; i -= Math.round(height / 10), j++){
                        var text = document.createElement('span');
                        text.setAttribute('id','ylabel' + j);
                        text.className      = 'noselect';
                        text.innerHTML      = 0;
                        text.style.position = 'absolute';
                        text.style.bottom   = i + 'px';
                        elem.appendChild(text);
                    }
                    return elem;
                };
                ctrl.scaleBetween = function(unscaledNum, minAllowed, maxAllowed, min, max) {
                    return (maxAllowed - minAllowed) * (unscaledNum - min) / (max - min) + minAllowed;
                }
                ctrl.updateAxisValues = function(){
                    var max_x_value  = ctrl.lines.maxX();
                    var num_divs     = ctrl.lines.numDivs * 2;
                    for(var i = 0, j = ctrl.lines.currentLeft, k = 0; i <= ctrl.lines.canvas.offsetWidth; i += Math.floor((ctrl.lines.canvas.offsetWidth)/num_divs), j += max_x_value/num_divs, k++){
                        var text = document.getElementById('xlabel' + k);
                        if(text){
                            var out         = Math.round(ctrl.scaleBetween(j, 0, ctrl.max_time, -1, 1));
                            text.innerHTML  = out + 'ns';
                            text.style.left = k === num_divs ? (i - 33) + 'px' : i + 'px';
                        }
                    }
                    var max_y_value = ctrl.lines.maxY();
                    for(var i = ctrl.lines.canvas.offsetHeight, j = ctrl.lines.currentTop, k = 0; i > 0; i -= Math.floor(ctrl.lines.canvas.offsetHeight/num_divs), j -= max_y_value/num_divs, k++){
                        var text = document.getElementById('ylabel' + k);
                        if(text){
                            var out           = Math.round(ctrl.scaleBetween(j, -1000, 1000, -1, 1));
                            text.innerHTML    = out === 0 ? '0.00mV' : (out > 0 ? '+' : '') + out + 'mV';
                            text.style.bottom = k === num_divs ? i  + 'px' : k === 0 ? (i - 20) + 'px' : (i - 10) + 'px';
                        }
                    }
                };
                ctrl.updateRunStopSwitch = function(state) {
                    ctrl.runstop_status  = ctrl.runstop_status == "Stop" ? "Run" : "Stop";
                };
                ctrl.updateDivisionValues = function(){
                    if(!ctrl.manual_control){
                        var left           = Math.round(ctrl.scaleBetween(ctrl.lines.currentLeft, 0, ctrl.max_time, -1, 1));
                        var right          = Math.round(ctrl.scaleBetween(ctrl.lines.currentRight, 0, ctrl.max_time, -1, 1));
                        ctrl.time_division = (right - left) / ctrl.num_divs;
                        var top            = Math.round(ctrl.scaleBetween(ctrl.lines.currentTop, -1000, 1000, -1, 1));
                        var bottom         = Math.round(ctrl.scaleBetween(ctrl.lines.currentBottom, -1000, 1000, -1, 1));
                        for (var i = 0; i < ctrl.channels.length; i++) 
                            ctrl.channels[i].y_division = Math.ceil(Math.abs(top - bottom) / ctrl.num_divs);
                    }
                };
                ctrl.updateTimeDivision = function(newTimeValue) {
                    if (angular.isDefined(newTimeValue) && parseInt(newTimeValue) > 0) {
                        ctrl.time_division = parseInt(newTimeValue) >= (ctrl.max_time/ctrl.num_divs) * 2 ? ctrl.max_time/ctrl.num_divs : parseInt(newTimeValue);
                        if (ctrl.timeDivisionValueValid()) {
                            ctrl.x_mult = (Math.ceil(Math.abs(Math.round(ctrl.scaleBetween(ctrl.lines.currentLeft, 0, ctrl.max_time, -1, 1)) - Math.round(ctrl.scaleBetween(ctrl.lines.currentRight, 0, ctrl.max_time, -1, 1))) / (ctrl.lines.numDivs * 2))) /
                                ctrl.time_division;
                        }
                    }
                    return ctrl.time_division;
                };
                ctrl.timeDivisionValueValid = function() {
                    var x_width = (ctrl.max_time / ctrl.num_divs);
                    if (Math.round(ctrl.time_division) > 0 && ctrl.time_division <= x_width * 2) {
                        var elem     = document.getElementById('div_time_info');
                        var step     = 1;
                        if (ctrl.time_division >= 10 && ctrl.time_division <= 50) {
                                step = 5;
                            } else if (ctrl.time_division > 50 && ctrl.time_division <= 200) {
                                step = 10;
                            } else if (ctrl.time_division > 200 && ctrl.time_division <= 500) {
                                step = 10;
                            } else {
                                step = 1;
                            }
                        elem.step = step;
                        return true;
                    }
                    ctrl.lines.unzoom();

                    return false;
                };
                ctrl.handleControls = function(){
                    document.getElementById('div_time_info').disabled = ctrl.zoomed;
                    for(var i = 0; i < ctrl.channels.length; i++){
                        document.getElementById(ctrl.channels[i].color+'input').disabled = ctrl.zoomed;
                    }
                    if(ctrl.zoomed && ctrl.prezoom_increments.length == 0){
                        for (var i = 0; i < ctrl.channels.length; i++) {
                          ctrl.prezoom_increments.push(ctrl.channels[i].y_division);
                        }
                    }
                    if(!ctrl.zoomed && ctrl.prezoom_increments.length == ctrl.channels.length){
                        for (var i = 0; i < ctrl.channels.length; i++) {
                          ctrl.channels[i].y_division = ctrl.prezoom_increments[i];
                        }
                        ctrl.prezoom_increments = [];
                    }
                };
                ctrl.toggleChannel = function(event) {
                    for (var i = 0; i < ctrl.channels.length; i++) {
                        if (ctrl.channels[i].color + 'box' === event.target.id) {
                            var enabled                = event.target.style.opacity == 1 ? false : true;
                            event.target.style.opacity = enabled ? 1 : 0.4;
                            if (ctrl.zoomed) {
                                document.getElementById(ctrl.channels[i].color + 'input').disabled = true;
                            } else {
                                document.getElementById(ctrl.channels[i].color + 'input').disabled = !document.getElementById(
                                    ctrl.channels[i].color + 'input').disabled;
                            }
                            ctrl.channels[i].visible = enabled;
                            return;
                        }
                    }
                };
                ctrl.calculateCursorValue = function(baseVal, divisionVal){
                    return (baseVal / (1000 / (divisionVal * (ctrl.num_divs / 2)))).toFixed(2);
                }
                ctrl.handleCursors = function(){
                    
                    ctrl.h_cursor_elem.style.visibility = ctrl.horizontal_cursor ? 'visible' : 'hidden';
                    ctrl.v_cursor_elem.style.visibility = ctrl.vertical_cursor ? 'visible' : 'hidden';

                    if(ctrl.horizontal_cursor){
                        ctrl.h_cursor_val_pos           = ctrl.lines.h_cursor_val_pos;
                        var x                           = ctrl.lines.h_cursor_x;
                        ctrl.horizontal_cursor_value    = ctrl.lines.getHorizontalCursorValue();
                        ctrl.h_cursor_output = '';
                        for(var i = 0; i < ctrl.channels.length; i++){
                            ctrl.h_cursor_output += '<span style="color:' + ctrl.channels[i].color + '">' + 
                                     ctrl.calculateCursorValue(ctrl.horizontal_cursor_value, ctrl.channels[i].y_division) + '&nbsp;mV' + '</span><br>';
                        }
                        ctrl.h_cursor_elem.innerHTML          = ctrl.h_cursor_output;
                        ctrl.horizontal_cursor_elem.innerHTML = ctrl.h_cursor_output;

                        ctrl.h_cursor_elem.style.top    = Math.floor(ctrl.h_cursor_val_pos) + 'px';
                        ctrl.h_cursor_elem.style.left   = Math.floor(x) + 'px';
                    }

                    if(ctrl.vertical_cursor){
                        ctrl.v_cursor_val_pos          = ctrl.lines.v_cursor_val_pos;
                        var y                          = ctrl.lines.v_cursor_y + ctrl.lines.canvasParent.offsetTop;
                        ctrl.vertical_cursor_value     = ctrl.lines.getVerticalCursorValue() + '&nbsp;ns';
                        ctrl.v_cursor_elem.innerHTML   = ctrl.vertical_cursor_value;
                        ctrl.v_cursor_elem.style.top   = y + 'px';
                        ctrl.v_cursor_elem.style.left  = ctrl.v_cursor_val_pos + 'px';
                        ctrl.vertical_cursor_elem.innerHTML = ctrl.vertical_cursor_value;
                    }

                };
                ctrl.selectBox = function(event) {
                    for (var i = 0; i < ctrl.channels.length; i++) {
                        if (ctrl.channels[i].color + 'input' === event.target.id) {
                            ctrl.currentChannel = i;
                            return;
                        }
                    }
                };
                ctrl.storePrezoomValues = function(){
                    for(var i = 0; i < ctrl.channels.length; i++){
                        ctrl.prezoom_increments.push(ctrl.channels[i].y_division);
                    }
                }
                ctrl.restorePrezoomValues = function(){
                    for(var i = 0; i < ctrl.prezoom_increments.length; i++){
                        ctrl.channels[i].y_division = ctrl.prezoom_increments[i];
                    }
                    ctrl.prezoom_increments = [];
                }
                ctrl.toggleVisibility = function(){
                    var height = ctrl.lines.canvasParent.offsetHeight;
                    var width  = ctrl.lines.canvasParent.offsetWidth;
                    if(height < ctrl.minimum_window_sz || width < ctrl.minimum_window_sz){
                        if(!ctrl.controls_hidden){
                            document.getElementById('xaxis_element').style.visibility = 'hidden';
                            document.getElementById('yaxis_element').style.visibility = 'hidden';
                            document.getElementById('c_box').style.visibility         = 'hidden';
                            ctrl.controls_hidden                                      = true;
                        }
                    } else{
                        if(ctrl.controls_hidden){
                            document.getElementById('xaxis_element').style.visibility = 'visible';
                            document.getElementById('yaxis_element').style.visibility = 'visible';
                            document.getElementById('c_box').style.visibility         = 'visible';
                            ctrl.controls_hidden                                      = false;
                        }
                    }
                    document.getElementById('horizontal_cursor_value').style.visibility = ctrl.horizontal_cursor ? 'visible' : 'hidden';
                    document.getElementById('vertical_cursor_value').style.visibility   = ctrl.vertical_cursor   ? 'visible' : 'hidden';
                };
                ctrl.animate = function(timestamp) {
                    ctrl.stats.begin();
                    var mix = -ctrl.mix_amount;
                    ctrl.lines.canvas.width     = ctrl.lines.canvas.parentNode.clientWidth;
                    ctrl.lines.canvas.height    = ctrl.lines.canvas.parentNode.clientHeight;
                    ctrl.lines.horizontal_cursor= ctrl.horizontal_cursor;
                    ctrl.lines.vertical_cursor  = ctrl.vertical_cursor;
                    if(ctrl.lines.minimapEnabled) ctrl.lines.minimapCanvas.width = ctrl.lines.canvas.parentNode.clientWidth;
                    ctrl.zoomed = ctrl.lines.zoomed;
                    ctrl.lines.setMixAmount(mix);
                    ctrl.lines.draw();
                    ctrl.handleCursors();
                    ctrl.updateAxisValues();
                    ctrl.updateDivisionValues();
                    ctrl.handleControls();
                    ctrl.toggleVisibility();
                    ctrl.stats.end();
                    window.requestAnimationFrame(ctrl.animate);
                };
                window.requestAnimationFrame(ctrl.animate);
            }],
        link: function(scope, elem, attrs) {
                var canvas = document.createElement("canvas");
                canvas.setAttribute('id','maincanvas');
                canvas.style.background = attrs.backgroundcolor;
                scope.ctrl.buildColorArray(attrs.channelcolors);
                scope.ctrl.unzoomedParentHeight = '94.9%';
                scope.ctrl.lines = new WebGLLines({canvas: canvas, 
                                                   parentNode: elem[0], 
                                                   unzoomedParentHeight: scope.ctrl.unzoomedParentHeight,
                                                   backgroundColor: attrs.backgroundcolor,
                                                   gridColor: attrs.gridcolor,
                                                   cursorColor: attrs.cursorcolor,
                                                   wireframeColor: attrs.wireframecolor,
                                                   fillColor: attrs.fillcolor,
                                                   minimapEnabled: parseInt(attrs.minimapmode),
                                                   numDivs: parseInt(attrs.numdivs)/2,
                                                   stroke: require('extrude-polyline')({thickness: 0.002})});
                scope.ctrl.num_divs         = scope.ctrl.lines.numDivs * 2;
                scope.ctrl.channel_labels   = attrs.channellabels.split(',');
                scope.ctrl.stats = new Stats();
                scope.ctrl.stats.setMode(0);   // 0: fps, 1: ms, 2: mb, 3+: custom
                scope.ctrl.stats.domElement.style.className= 'noselect noIbar unselectable';
                scope.ctrl.stats.domElement.style.position = 'absolute';
                scope.ctrl.stats.domElement.style.left     = '0px';
                scope.ctrl.stats.domElement.style.top      = '0px';
                elem[0].style.height     = scope.ctrl.unzoomedParentHeight;
                elem[0].style.marginLeft = (((window.innerWidth / window.innerHeight) * 0.0184844) * 100) + '%';
                elem[0].appendChild(scope.ctrl.lines.canvas);
                elem[0].position         = 'relative';
                //elem[0].appendChild(scope.ctrl.stats.domElement);
                elem[0].appendChild(scope.ctrl.getTitleElement(attrs.channeltitle));
                elem[0].appendChild(scope.ctrl.getYAxisIncrements());
                elem[0].appendChild(scope.ctrl.getXAxisIncrements());
                scope.ctrl.h_cursor_elem                = document.createElement('label');
                scope.ctrl.h_cursor_elem.style.position = 'absolute';
                scope.ctrl.h_cursor_elem.className      = 'unselectable noIbar noselect cursor_text';
                elem[0].appendChild(scope.ctrl.h_cursor_elem);
                scope.ctrl.v_cursor_elem                = document.createElement('label');
                scope.ctrl.v_cursor_elem.style.position = 'absolute';
                scope.ctrl.v_cursor_elem.className      = 'unselectable noIbar noselect cursor_text';
                elem[0].appendChild(scope.ctrl.v_cursor_elem);

                if(parseInt(attrs.helpboxbutton)){
                    scope.ctrl.helpbox_button = document.createElement('input');
                    scope.ctrl.helpbox_button.type = 'button';
                    scope.ctrl.helpbox_button.value = 'Help';
                    scope.ctrl.helpbox_button.style.background = 'black';
                    scope.ctrl.helpbox_button.style.color = 'white';
                    scope.ctrl.helpbox_button.style.position = 'absolute';
                    scope.ctrl.helpbox_button.style.left = 0;
                    scope.ctrl.helpbox_button.style.bottom = 0;
                    scope.ctrl.helpbox_button.onclick = function(){
                        scope.ctrl.helpbox.modal.style.display = 'block';
                        scope.ctrl.helpbox_displayed           = true;
                    }
                    elem[0].appendChild(scope.ctrl.helpbox_button);
                }

                scope.ctrl.helpbox = scope.ctrl.lines.getHelpBox();
                scope.ctrl.helpbox.span.onclick = function(){
                  scope.ctrl.helpbox.modal.style.display = 'none';
                  ctrl.helpbox_displayed                 = false;
                }
                elem[0].appendChild(scope.ctrl.helpbox.modal);

                   /* Next line gives keyboard focus to canvas. */
                  scope.ctrl.lines.canvas.setAttribute('tabindex', 0);
                  /* Prevent right click context menu. */
                  scope.ctrl.lines.canvasParent.oncontextmenu = function(e){
                    e.preventDefault();
                  };

                  window.addEventListener('keydown', function(e){
                    if(e.keyCode == 72) {
                        if(!scope.ctrl.helpbox_displayed){
                            scope.ctrl.helpbox.modal.style.display = 'block';
                            scope.ctrl.helpbox_displayed           = true;
                        } else {
                            scope.ctrl.helpbox.modal.style.display = 'none';
                            scope.ctrl.helpbox_displayed           = false;
                        }
                    }
                  });

                  window.onclick = function(e) {
                    if (e.target == scope.ctrl.helpbox.modal) {
                        scope.ctrl.helpbox.modal.style.display = "none";
                    }
                  }

                  scope.ctrl.lines.canvas.addEventListener('keydown', function(e){
                    if (e.keyCode > 36 && e.keyCode < 41){ //keycodes for arrow keys, left:37 up:38 right:39 down:40
                      scope.ctrl.lines.keyAdjustCamera(e.keyCode, 
                                                       scope.ctrl.time_division/scope.ctrl.max_time,
                                                       scope.ctrl.scaleBetween(scope.ctrl.channels[scope.ctrl.currentChannel].y_division, -1, 1, -1000, 1000)
                                                       );
                      scope.ctrl.lines.mousePanning = true;
                    }
                  });

                  scope.ctrl.lines.canvas.addEventListener('mousedown', function(e){
                    var canvasX = e.pageX - scope.ctrl.lines.canvasParent.offsetLeft;
                    var canvasY = e.pageY - scope.ctrl.lines.canvasParent.offsetTop;
                    if(e.button === 0){ //left click
                      scope.ctrl.l_mouse_down = true;
                      scope.ctrl.lines.startDrag(canvasX, canvasY);
                    } else if (e.button === 1){ //middle mouse click
                    } else if (e.button === 2){ //right click
                      scope.ctrl.lines.panDown.x = canvasX;
                      scope.ctrl.lines.panDown.y = canvasY;
                    }
                    e.stopPropagation();
                  }, false);

                  scope.ctrl.lines.canvas.addEventListener('mouseup', function(e){
                    var canvasX = e.pageX - scope.ctrl.lines.canvasParent.offsetLeft;
                    var canvasY = e.pageY - scope.ctrl.lines.canvasParent.offsetTop;
                    if(e.button === 0){ //left click
                        if(scope.ctrl.mouse_dragging){
                            if(scope.ctrl.lines.stopDrag(canvasX, canvasY)){
                            }
                            scope.ctrl.manual_control = false;
                            scope.ctrl.mouse_dragging = false;
                        }
                        scope.ctrl.l_mouse_down   = false;
                    } else if (e.button === 1){ //middle mouse click

                    } else if (e.button === 2){ //right click
                      document.body.style.cursor = 'default';
                      scope.ctrl.lines.panDown.inCameraSpace = false;
                    } 
                    e.stopPropagation();
                  }, false);

                  scope.ctrl.lines.canvas.addEventListener('mouseout', function(e){
                    var canvasX = e.pageX - scope.ctrl.lines.canvasParent.offsetLeft;
                    var canvasY = e.pageY - scope.ctrl.lines.canvasParent.offsetTop;
                    e.stopPropagation();
                  }, false);

                  scope.ctrl.lines.canvas.addEventListener('mousemove', function(e){
                    var canvasX = e.pageX - scope.ctrl.lines.canvasParent.offsetLeft;
                    var canvasY = e.pageY - scope.ctrl.lines.canvasParent.offsetTop;
                    if(e.button === 0){ //left click
                      if(e.altKey){
                        scope.ctrl.lines.dragCursors(canvasX, canvasY);
                        return;
                      }
                      if(scope.ctrl.l_mouse_down){
                          scope.ctrl.mouse_dragging = true;
                          scope.ctrl.lines.updateDrag(canvasX, canvasY);
                      }
                    } else if (e.button === 1){ //middle mouse click

                    } else if (e.button === 2){ //right click
                      document.body.style.cursor    = 'move';
                      scope.ctrl.lines.panCamera(canvasX, canvasY, e.shiftKey, e.ctrlKey);
                    }
                    e.stopPropagation();
                  }, false);

                  scope.ctrl.lines.canvas.addEventListener('dblclick', function(e){
                    if(scope.ctrl.zoomed) scope.ctrl.lines.unzoom();
                    scope.ctrl.x_mult = 1;
                    for(var i = 0; i < scope.ctrl.channels.length; i++){
                        scope.ctrl.channels[i].y_mult = 1;
                    }
                    scope.ctrl.just_unzoomed  = false;
                    scope.ctrl.just_zoomed    = false;
                    scope.ctrl.manual_control = false;
                    e.stopPropagation();
                  }, false);

                  scope.ctrl.lines.canvas.addEventListener('mousewheel', function(e){
                    var canvasX = e.pageX - scope.ctrl.lines.canvasParent.offsetLeft;
                    var canvasY = e.pageY - scope.ctrl.lines.canvasParent.offsetTop;
                    scope.ctrl.manual_control = false;
                    if(!scope.ctrl.lines.zoomWheel(canvasX, canvasY, Math.max(-1, Math.min(1, (
                                   e.wheelDelta || -e.detail))))){
                        scope.ctrl.x_mult = 1;
                        for(var i = 0; i < scope.ctrl.channels.length; i++){
                            scope.ctrl.channels[i].y_mult = 1;
                        } 
                    } else { 
                    }
                    e.stopPropagation();
                  }, false);

                  //Minimap view event listeners below

                  scope.ctrl.lines.minimapCanvas.addEventListener('mousedown', function(e){
                    var canvasX = e.pageX - scope.ctrl.lines.canvasParent.offsetLeft;
                    var canvasY = e.pageY - (scope.ctrl.lines.minimapCanvas.offsetTop + 10);
                    scope.ctrl.minimap_mousedown = true;
                    scope.ctrl.lines.minimapPanDown.x = canvasX;
                    scope.ctrl.lines.minimapPanDown.y = canvasY;
                    scope.ctrl.lines.minimapMovePosition(scope.ctrl.lines.minimapPanDown.x,
                                                         scope.ctrl.lines.minimapPanDown.y);
                    e.stopPropagation();
                  }, false);

                  scope.ctrl.lines.minimapCanvas.addEventListener('mousemove', function(e){
                    var canvasX = e.pageX - scope.ctrl.lines.canvasParent.offsetLeft;
                    var canvasY = e.pageY - (scope.ctrl.lines.minimapCanvas.offsetTop + 10);
                    if(scope.ctrl.minimap_mousedown){
                        document.body.style.cursor = 'move';
                        scope.ctrl.lines.minimapMovePosition(canvasX, canvasY);
                    }
                    e.stopPropagation();
                  }, false);

                  scope.ctrl.lines.minimapCanvas.addEventListener('mouseup', function(e){
                    var canvasX = e.pageX - scope.ctrl.lines.canvasParent.offsetLeft;
                    var canvasY = e.pageY - (scope.ctrl.lines.minimapCanvas.offsetTop + 10);
                    scope.ctrl.minimap_mousedown = false;
                    scope.ctrl.lines.minimapPanDown.inCameraSpace = false;
                    document.body.style.cursor = 'default';
                    e.stopPropagation();
                  }, false);

            }
        ,template: '<div layout=column id="c_box" class="unselectable noIbar noselect" ng-click="$event.stopPropagation();" style="position: absolute; right: 0px; visibility: visible; background-color: rgba(0, 0, 0, 0.5);width:130px;">' +
            '<md-switch id="runstop" ng-change="ctrl.updateRunStopSwitch()" ng-model="ctrl.run">{{ctrl.runstop_status}}</md-switch>' +
            '<md-button id="single" class="md-primary fade" style="padding: 0; margin-bottom: 15%; margin-right: 15%; background-color:rgba(68,69,81, 0.7);" ng-click="ctrl.single = true;">Single</md-button>' +
            '<div class="adjustedmargin">' + '<md-input-container flex-gt-sm>' + '<label>Nanosecs/Div</label>' +
            '<input id="div_time_info" class="input" type="number" ng-mousedown="ctrl.manual_control = true;" step="1" ng-model="ctrl.updateTimeDivision" ng-model-options="{ getterSetter: true, allowInvalid: true }"' +
            '</md-input-container>' + '<md-input-container flex-gt-sm> <label>Persistance</label>' + '<input id="mix_amt_handler" class="input" type="range" step="0.005" min="-0.15" max="0.0" ng-model="ctrl.mix_amount"' +
            '</md-input-container>' + '</div>' + '<div class="adjustedmargin" ng-repeat="channel in ctrl.channels">' +
            '<p align="left" style="font-family: Monospace; margin: -3px; color:{{channel.color}}">{{channel.name}}</p>' +
            '<div class="colorbox shrink" ng-dblclick="ctrl.toggleChannel($event)" id="{{channel.color}}box" style="background:{{channel.color}}; margin-top: 15px; opacity: 1"></div>' +
            '<md-input-container flex-gt-sm style="width:96px">' + '<label>mV/Div</label>' +
            '<input id="{{channel.color}}input" type="number" class="div_info" step="1" ng-mousedown="ctrl.manual_control = true;" ng-model="channel.updateDivision" ng-mouseover="ctrl.selectBox($event)" ng-model-options="{ getterSetter: true, allowInvalid: true }"' +
            '</md-input-container>' + '</div>' +
            '<label style="font-family: Monospace;"><input type="checkbox" ng-model="ctrl.horizontal_cursor"/> H Cursor</label>'+
            '<label style="font-family: Monospace;" id="horizontal_cursor_value" ng-model="ctrl.h_cursor_output">0</label>'+
            '<label style="font-family: Monospace;"><input type="checkbox" ng-model="ctrl.vertical_cursor"/> V Cursor</label>'+
            '<label style="font-family: Monospace;" id="vertical_cursor_value">0</label>'+
            '</div>'
    }
});
