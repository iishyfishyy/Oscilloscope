angular.module('griffinApp').directive('chart3d', function($compile) {
    return {
        restrict: 'E',
        bindToController: true,
        controllerAs: 'ctrl',
        controller: ['frontendSocket',
            function(frontendSocket) {
                var ctrl = this;
                var wireframe_in_scene = false;
                var dv;
                ctrl.line_color = 0x3070F0;
                ctrl.last_timestamp = null;
                ctrl.active_line = 0;
                ctrl.num_lines_in_mem = 20;
                ctrl.OPACITY_FADE_RATE = -300;
                ctrl.OPACITY_CUTOFF = 0.0001;
                ctrl.init = null;
                ctrl.num_segments = 512;
                ctrl.colors = ['#006fff', '#ffffff', '#ff6600', '#ff0000', '#33cc33', '#ff3399', '#00ffff', '#ffff00'];
                ctrl.mouse_dragging = false;
                ctrl.zoomed = false;
                ctrl.minimap_mode;
                ctrl.mouse_start = {
                    x: 0,
                    y: 0
                };
                ctrl.mouse_end = {
                    x: 0,
                    y: 0
                };
                ctrl.pan_down = {
                    x: 0,
                    y: 0,
                    in_camera_space: false
                };
                ctrl.minimap_pan_down = {
                    x: 0,
                    y: 0,
                    in_camera_space: false
                };
                ctrl.max_zoom_allowed = 25;
                ctrl.selection_wireframe;
                ctrl.h_lines_mesh;
                ctrl.v_lines_mesh;
                ctrl.major_line_mesh;
                ctrl.grid_in_scene = false;
                ctrl.ticks_mesh;
                ctrl.ticks_in_scene = false;
                ctrl.minimum_window_sz = 400;
                ctrl.controls_hidden = false;
                ctrl.run = true;
                ctrl.single = false;
                ctrl.y_inc_per_div = 1;
                ctrl.runstop_status = "Run";
                ctrl.prezoom_increments = [];
                ctrl.y_mult = 1;
                ctrl.x_mult = 1;
                ctrl.unzoomed = false;
                ctrl.minimapViewMaterial;
                ctrl.minimapViewGeometry;
                ctrl.minimapViewMesh;
                ctrl.minimapViewHGrids;
                ctrl.minimapViewVGrids;
                ctrl.hidden = false;
                ctrl.minimap_camera_adjustment = 0;
                var Channel = function() {
                    this.mesh_renewal = [];
                    this.x_mult = 1;
                    this.y_mult = 1;
                    this.x_inc_per_div = 1;
                    this.geometry = [];
                    this.material = [];
                    this.mesh = [];
                    this.active_line = 0;
                    this.line_color = 0xffffff;
                    this.visible = true;
                    this.channel_label = '';
                    this.doubleArrays = function(doubleArrays) {
                        for (var j = 0; j < ctrl.num_lines_in_mem; j++) {
                            this.mesh_renewal.push(0);
                            this.geometry.push([]);
                            this.material.push([]);
                            this.mesh.push([]);
                        }
                    }
                    this.setColor = function(color) {
                        this.line_color = color;
                    }
                    this.getColor = function() {
                        return this.line_color;
                    }
                    this.updateDivision = function(newValue) {
                        if (angular.isDefined(newValue)) {
                            if (parseInt(newValue) > 0) {
                                this.x_inc_per_div = parseInt(newValue);
                                if (this.divisionValueValid()) {
                                    this.y_mult = (Math.abs(ctrl.camera.top - ctrl.camera.bottom) / ctrl.num_divs) /
                                        this.x_inc_per_div;
                                }
                            }
                        }
                        return this.x_inc_per_div;
                    }
                    this.divisionValueValid = function() {
                        if (Math.ceil(this.x_inc_per_div) > 0 && Math.round(this.x_inc_per_div) <= 400) {
                            var elems = document.getElementsByClassName('div_info');
                            var step = 0;
                            if (this.x_inc_per_div >= 10 && this.x_inc_per_div <= 50) {
                                step = 5;
                            } else if (this.x_inc_per_div > 50 && this.x_inc_per_div <= 200) {
                                step = 10;
                            } else if (this.x_inc_per_div > 200 && this.x_inc_per_div <= 500) {
                                step = 10;
                            } else {
                                step = 1;
                            }
                            for (var i = 0; i < elems.length; i++) elems[i].step = step;
                            return true;
                        }
                        this.x_inc_per_div = this.x_inc_per_div < 0 ? 0 : this.x_inc_per_div > 200 ? 400 : 200;
                        return false;
                    }
                }
                ctrl.currentChannel = 0;
                ctrl.channel_list = [];
                ctrl.updateTimeDivision = function(newTimeValue) {
                    if (angular.isDefined(newTimeValue)) {
                        if (parseInt(newTimeValue) > 0) {
                            ctrl.y_inc_per_div = parseInt(newTimeValue) >= (ctrl.unzoomed_xmax/ctrl.num_divs) * 2 ? ctrl.unzoomed_xmax/ctrl.num_divs : parseInt(newTimeValue);
                            if (ctrl.timeDivisionValueValid()) {
                                ctrl.x_mult = (Math.ceil(Math.abs(ctrl.camera.left - ctrl.camera.right) / ctrl.num_divs)) /
                                    ctrl.y_inc_per_div;
                                    console.log(ctrl.x_mult);
                            }
                        }
                    }
                    return ctrl.y_inc_per_div;
                };
                frontendSocket.on('udp_message', function(data) {
                    if (ctrl.single && ctrl.run) ctrl.run = !ctrl.run;
                    if (ctrl.run || ctrl.single) dv = new DataView(data.message);
                    ctrl.num_channels = dv.getUint8(30, false);
                    var sample_offset = 31;
                    var sampleCnt = dv.getUint16(28, false);
                    ctrl.num_segments = sampleCnt;
                    ctrl.unzoomed_xmax = sampleCnt;
                    ctrl.zoomed_xmax = sampleCnt / ctrl.max_zoom_allowed;
                    ctrl.unzoomed_width = ctrl.unzoomed_xmax;
                    if (!ctrl.zoomed) {
                        ctrl.camera.right = ctrl.unzoomed_xmax;
                        if(ctrl.minimap_mode != 2){
                          ctrl.minimap.right = ctrl.unzoomed_xmax;
                          ctrl.minimap.left = 0;
                          ctrl.camera.updateProjectionMatrix();
                          ctrl.minimap.updateProjectionMatrix();
                          }
                    }

                    if (typeof ctrl.channel_list[0] === 'undefined') {
                        for (var i = 0; i < ctrl.num_channels; i++) {
                            ctrl.channel_list.push(new Channel());
                            ctrl.channel_list[i].doubleArrays();
                            ctrl.channel_list[i].setColor(ctrl.colors[i]);
                            ctrl.channel_list[i].channel_label = ctrl.channel_labels[i];
                        }
                        ctrl.currentChannel = 0;
                    } else if (ctrl.num_channels != ctrl.channel_list.length) {
                        location.reload();
                    }
                    var next_channel_multiplier = 0;
                    var next_channel_counter = 0;
                    for (var i = 0; i < ctrl.num_channels; i++) {
                        if (ctrl.channel_list[i].mesh_renewal[ctrl.channel_list[i].active_line] != 0) {
                            ctrl.scene.remove(ctrl.channel_list[i].mesh[ctrl.channel_list[i].active_line]);
                            ctrl.channel_list[i].geometry[ctrl.channel_list[i].active_line].dispose();
                            ctrl.channel_list[i].material[ctrl.channel_list[i].active_line].dispose();
                        }
                        ctrl.channel_list[i].geometry[ctrl.channel_list[i].active_line] = new THREE.BufferGeometry();
                        ctrl.channel_list[i].material[ctrl.channel_list[i].active_line] = new THREE.LineBasicMaterial({
                            color: ctrl.channel_list[i].line_color,
                            opacity: 1.0,
                            linewidth: 2,
                            blending: THREE.AdditiveBlending,
                            transparent: true
                        });
                        var positions = new Float32Array(sampleCnt * 3); //3 vertices per point
                        for (var j = 0, l = sampleCnt; j < l; j++) {
                            positions[j * 3 + 0] = j * ctrl.x_mult;
                            positions[j * 3 + 1] = (dv.getInt16((sample_offset + (next_channel_multiplier)) + (j * 2),
                                false) * ADC_LSB) * ctrl.channel_list[i].y_mult;
                            positions[j * 3 + 2] = 5.0;
                        }
                        next_channel_counter += 2;
                        next_channel_multiplier = sampleCnt * next_channel_counter;
                        ctrl.channel_list[i].geometry[ctrl.channel_list[i].active_line].addAttribute('position', new THREE
                            .BufferAttribute(positions, 3));
                        ctrl.channel_list[i].mesh[ctrl.channel_list[i].active_line] = new THREE.Line(ctrl.channel_list[
                            i].geometry[ctrl.channel_list[i].active_line], ctrl.channel_list[i].material[ctrl.channel_list[
                            i].active_line]);
                        ctrl.channel_list[i].mesh[ctrl.channel_list[i].active_line].visible = ctrl.channel_list[i].visible;
                        ctrl.scene.add(ctrl.channel_list[i].mesh[ctrl.channel_list[i].active_line]);
                        ctrl.channel_list[i].mesh_renewal[ctrl.channel_list[i].active_line] = window.performance.now();
                        ctrl.channel_list[i].active_line++;
                        if (ctrl.channel_list[i].active_line >= ctrl.num_lines_in_mem) ctrl.channel_list[i].active_line = 0;
                    }
                    if (!ctrl.grid_in_scene) {
                        ctrl.drawTicksAndLines({preserve_divs: false});
                        ctrl.x_mult = Math.ceil(Math.abs(ctrl.camera.left - ctrl.camera.right) / ctrl.num_divs) /
                                    ctrl.y_inc_per_div;
                    }
                    ctrl.single = false;
                });
                ctrl.snapToAcceptable = function(new_value) {
                    if (new_value > ctrl.unzoomed_height / ctrl.num_divs) {
                        new_value = Math.ceil(new_value / 20) * 20;
                    } else {
                        if (new_value <= 10) {
                            new_value = Math.ceil(new_value);
                        } else if (new_value <= 50) {
                            new_value = Math.ceil(new_value / 5) * 5;
                        } else {
                            new_value = Math.ceil(new_value / 10) * 10;
                        }
                    }
                    return new_value;
                };
                ctrl.timeDivisionValueValid = function() {
                    var x_width = (ctrl.unzoomed_xmax / ctrl.num_divs);
                    if (Math.round(ctrl.y_inc_per_div) > 0 && ctrl.y_inc_per_div <= x_width * 2) {
                        var elem = document.getElementById('div_time_info');
                        var step = 1;
                        if (ctrl.y_inc_per_div >= 10 && ctrl.y_inc_per_div <= 50) {
                                step = 5;
                            } else if (ctrl.y_inc_per_div > 50 && ctrl.y_inc_per_div <= 200) {
                                step = 10;
                            } else if (ctrl.y_inc_per_div > 200 && ctrl.y_inc_per_div <= 500) {
                                step = 10;
                            } else {
                                step = 1;
                            }
                        elem.step = step;
                        return true;
                    }
                    ctrl.y_inc_per_div = ctrl.y_inc_per_div < 0 ? 0 : x_width;
                    return false;
                }
                ctrl.startDrag = function(x, y) {
                    if (!ctrl.mouse_dragging) {
                        ctrl.squareGeometry = new THREE.BufferGeometry();
                        ctrl.squareGeometry.dynamic = true;
                        var xadj = (ctrl.camera.right - ctrl.camera.left) / ctrl.renderer.domElement.parentNode.offsetWidth;
                        var xoff = ctrl.camera.left;
                        var yadj = (ctrl.camera.bottom - ctrl.camera.top) / ctrl.renderer.domElement.parentNode.offsetHeight;
                        var yoff = ctrl.camera.top;
                        ctrl.mouse_start.x = x * xadj + xoff;
                        ctrl.mouse_start.y = y * yadj + yoff;
                        ctrl.mouse_end.x = x * xadj + xoff;
                        ctrl.mouse_end.y = y * yadj + yoff;
                        var positions = new Float32Array([
                            ctrl.mouse_start.x, ctrl.mouse_start.y, 2.0,
                            ctrl.mouse_end.x, ctrl.mouse_start.y, 2.0,
                            ctrl.mouse_end.x, ctrl.mouse_end.y, 2.0,
                            ctrl.mouse_end.x, ctrl.mouse_end.y, 2.0,
                            ctrl.mouse_start.x, ctrl.mouse_end.y, 2.0,
                            ctrl.mouse_start.x, ctrl.mouse_start.y, 2.0
                        ]);
                        ctrl.squareGeometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                        // Create a white basic material and activate the 'doubleSided' attribute.
                        ctrl.squareMaterial = new THREE.MeshBasicMaterial({
                            color: 0xFFFFFF,
                            side: THREE.DoubleSide,
                            opacity: 0.1,
                            transparent: true
                        });
                        // Create a mesh and insert the geometry and the material. Translate the whole mesh
                        // by 1.5 on the x axis and by 4 on the z axis and add the mesh to the scene.
                        ctrl.squareMesh = new THREE.Mesh(ctrl.squareGeometry, ctrl.squareMaterial);
                        ctrl.scene.add(ctrl.squareMesh);
                        ctrl.mouse_dragging = true;
                    }
                };
                ctrl.stopDrag = function() {
                    if (ctrl.mouse_dragging) {
                        ctrl.scene.remove(ctrl.squareMesh);
                        ctrl.squareGeometry.dispose();
                        ctrl.squareMaterial.dispose();
                        ctrl.mouse_dragging = false;
                        if (wireframe_in_scene) {
                            ctrl.selection_wireframe.geometry.dispose();
                            ctrl.selection_wireframe.material.dispose();
                            ctrl.scene.remove(ctrl.selection_wireframe);
                            wireframe_in_scene = false;
                        }
                    }
                };
                ctrl.updateDrag = function(x, y) {
                    if (ctrl.mouse_dragging) {
                        var xadj = (ctrl.camera.right - ctrl.camera.left) / ctrl.renderer.domElement.parentNode.offsetWidth;
                        var xoff = ctrl.camera.left;
                        var yadj = (ctrl.camera.bottom - ctrl.camera.top) / ctrl.renderer.domElement.parentNode.offsetHeight;
                        var yoff = ctrl.camera.top;
                        ctrl.mouse_end.x = x * xadj + xoff;
                        ctrl.mouse_end.y = y * yadj + yoff;
                        var position = ctrl.squareGeometry.attributes.position.array;
                        position[3] = ctrl.mouse_end.x;
                        position[6] = ctrl.mouse_end.x;
                        position[7] = ctrl.mouse_end.y;
                        position[9] = ctrl.mouse_end.x;
                        position[10] = ctrl.mouse_end.y;
                        position[13] = ctrl.mouse_end.y;
                        ctrl.squareGeometry.attributes.position.needsUpdate = true;
                        if (wireframe_in_scene) {
                            ctrl.selection_wireframe.geometry.dispose();
                            ctrl.selection_wireframe.material.dispose();
                            ctrl.scene.remove(ctrl.selection_wireframe);
                        }
                        if (Math.abs(ctrl.mouse_end.x - ctrl.mouse_start.x) > 0 && Math.abs(ctrl.mouse_end.y - ctrl.mouse_start
                            .y) > 0) { //add wireframe if selection length & width are greater than 0
                            ctrl.selection_wireframe = new THREE.EdgesHelper(ctrl.squareMesh, 0x00ff00);
                            ctrl.selection_wireframe.geometry.attributes.position.dynamic = true;
                            ctrl.scene.add(ctrl.selection_wireframe);
                            wireframe_in_scene = true;
                        }
                    }
                };

                var first_run = true;
                ctrl.drawTicksAndLines = function(opts) {
                    if (ctrl.grid_in_scene) {
                        ctrl.scene.remove(ctrl.major_line_mesh);
                        ctrl.scene.remove(ctrl.h_lines_mesh);
                        ctrl.scene.remove(ctrl.v_lines_mesh);
                        ctrl.scene.remove(ctrl.ticks_mesh);
                        ctrl.scene.remove(ctrl.squareMesh);
                        ctrl.major_line_mesh.geometry.dispose();
                        ctrl.major_line_mesh.material.dispose();
                        ctrl.h_lines_mesh.geometry.dispose();
                        ctrl.h_lines_mesh.material.dispose();
                        ctrl.v_lines_mesh.geometry.dispose();
                        ctrl.v_lines_mesh.material.dispose();
                        ctrl.ticks_mesh.geometry.dispose();
                        ctrl.ticks_mesh.material.dispose();
                        if(ctrl.minimap_mode != 2){
                          ctrl.minimapViewGeometry.dispose();
                          ctrl.minimapViewMaterial.dispose();
                        }
                    }
                    ctrl.num_divs = 10;
                    var num_minor_ticks = 5;
                    var y_increment = Math.abs(ctrl.camera.top - ctrl.camera.bottom) / ctrl.num_divs;
                    var x_increment = Math.abs(ctrl.camera.left - ctrl.camera.right) / ctrl.num_divs;
                    var y_minor_inc = Math.abs(ctrl.camera.top - ctrl.camera.bottom) / (ctrl.num_divs * num_minor_ticks);
                    var x_minor_inc = Math.abs(ctrl.camera.left - ctrl.camera.right) / (ctrl.num_divs * num_minor_ticks);
                    var y_mid = (Math.abs(ctrl.camera.top - ctrl.camera.bottom) / 2) + ctrl.camera.bottom;
                    var x_mid = (Math.abs(ctrl.camera.left - ctrl.camera.right) / 2) + ctrl.camera.left;
                    var y_height = Math.abs(ctrl.camera.top - ctrl.camera.bottom);
                    var x_width = Math.abs(ctrl.camera.left - ctrl.camera.right);
                    if(!opts.preserve_divs)
                        for (var i = 0; i < ctrl.num_channels; i++) ctrl.channel_list[i].x_inc_per_div = ctrl.snapToAcceptable(
                            Math.ceil(y_height / ctrl.num_divs));
                    ctrl.y_inc_per_div = Math.round((x_width / ctrl.num_divs)*10)/10;
                    var h_line_material = new THREE.LineDashedMaterial({
                        color: 0x595959,
                        opacity: 0.8,
                        dashSize: 3 * (x_width / ctrl.renderer.domElement.parentNode.offsetWidth),
                        gapSize: 10 * (x_width / ctrl.renderer.domElement.parentNode.offsetWidth)
                    }); //horizontal lines
                    var v_line_material = new THREE.LineDashedMaterial({
                        color: 0x595959,
                        opacity: 0.8,
                        dashSize: 3 * (y_height / ctrl.renderer.domElement.parentNode.offsetHeight),
                        gapSize: 10 * (y_height / ctrl.renderer.domElement.parentNode.offsetHeight)
                    }); //vertical lines
                    var tick_material = new THREE.LineBasicMaterial({
                        color: 0x595959,
                        opacity: 1,
                        linewidth: 1.5
                    }); //tick marks
                    var major_line_material = new THREE.LineBasicMaterial({
                        color: 0x595959,
                        opacity: 1,
                        linewidth: 2
                    }); //background major lines
                    //enable opacity
                    h_line_material.transparent = true;
                    v_line_material.transparent = true;
                    tick_material.transparent = true;
                    major_line_material.transparent = true;
                    var h_line_geom = new THREE.Geometry();
                    var v_line_geom = new THREE.Geometry();
                    var tick_geom = new THREE.Geometry();
                    var major_line_geom = new THREE.Geometry();
                    var z = 0;
                    var n;
                    //horizontal lines
                    var hmaj_tick_len = 10 * (x_width / ctrl.renderer.domElement.parentNode.offsetWidth);
                    var hmin_tick_len = 5 * (x_width / ctrl.renderer.domElement.parentNode.offsetWidth);
                    for (var i = ctrl.camera.bottom, n = 0; n < ctrl.num_divs; i += y_increment, n++) {
                        if (n == (ctrl.num_divs / 2)) {
                            major_line_geom.vertices.push(new THREE.Vector3(ctrl.camera.left, y_mid, z), new THREE.Vector3(
                                ctrl.camera.right, y_mid, z));
                        } else {
                            h_line_geom.vertices.push(new THREE.Vector3(ctrl.camera.left, i, z), new THREE.Vector3(ctrl.camera
                                .right, i, z));
                        }
                        //major horizontal ticks
                        tick_geom.vertices.push(new THREE.Vector3(ctrl.camera.left, i, z), new THREE.Vector3(ctrl.camera.left +
                            hmaj_tick_len, i, z));
                        tick_geom.vertices.push(new THREE.Vector3(ctrl.camera.right, i, z), new THREE.Vector3(ctrl.camera.right -
                            hmaj_tick_len, i, z));
                        //minor horizontal ticks
                        for (var j = i; j < i + y_increment; j += y_minor_inc) {
                            tick_geom.vertices.push(new THREE.Vector3(ctrl.camera.left, j, z), new THREE.Vector3(ctrl.camera
                                .left + hmin_tick_len, j, z));
                            tick_geom.vertices.push(new THREE.Vector3(ctrl.camera.right, j, z), new THREE.Vector3(ctrl.camera
                                .right - hmin_tick_len, j, z));
                        }
                    }
                    //vertical lines, intervals of 10
                    var vmaj_tick_len = 10 * (y_height / ctrl.renderer.domElement.parentNode.offsetHeight);
                    var vmin_tick_len = 5 * (y_height / ctrl.renderer.domElement.parentNode.offsetHeight);
                    for (var i = ctrl.camera.left, n = 0; n < ctrl.num_divs; i += x_increment, n++) {
                        if (n == (ctrl.num_divs / 2)) {
                            major_line_geom.vertices.push(new THREE.Vector3(x_mid, y_mid, z), new THREE.Vector3(x_mid, ctrl
                                .camera.top, z));
                            major_line_geom.vertices.push(new THREE.Vector3(x_mid, y_mid, z), new THREE.Vector3(x_mid, ctrl
                                .camera.bottom, z));
                        } else {
                            v_line_geom.vertices.push(new THREE.Vector3(i, ctrl.camera.bottom, z), new THREE.Vector3(i,
                                ctrl.camera.top, z));
                        }
                        //major vertical ticks
                        tick_geom.vertices.push(new THREE.Vector3(i, ctrl.camera.bottom, z), new THREE.Vector3(i, ctrl.camera
                            .bottom + vmaj_tick_len, z));
                        tick_geom.vertices.push(new THREE.Vector3(i, ctrl.camera.top, z), new THREE.Vector3(i, ctrl.camera.top -
                            vmaj_tick_len, z));
                        //minor vertical ticks
                        for (var j = i; j < i + x_increment; j += x_minor_inc) {
                            tick_geom.vertices.push(new THREE.Vector3(j, ctrl.camera.bottom, z), new THREE.Vector3(j, ctrl.camera
                                .bottom + vmin_tick_len, z));
                            tick_geom.vertices.push(new THREE.Vector3(j, ctrl.camera.top, z), new THREE.Vector3(j, ctrl.camera
                                .top - vmin_tick_len, z));
                        }
                    }
                    h_line_geom.computeLineDistances();
                    v_line_geom.computeLineDistances();
                    ctrl.major_line_mesh = new THREE.LineSegments(major_line_geom, major_line_material);
                    ctrl.scene.add(ctrl.major_line_mesh);

                    ctrl.h_lines_mesh = new THREE.LineSegments(h_line_geom, h_line_material);

                    ctrl.scene.add(ctrl.h_lines_mesh); //add horizontal lines
                    ctrl.v_lines_mesh = new THREE.LineSegments(v_line_geom, v_line_material);

                    ctrl.scene.add(ctrl.v_lines_mesh); //add vertical lines
                    ctrl.grid_in_scene = true;
                    ctrl.ticks_mesh = new THREE.LineSegments(tick_geom, tick_material);

                    ctrl.scene.add(ctrl.ticks_mesh); //add ticks
                    ctrl.ticks_in_scene = true;
                    /*BELOW CODE FOR 'MINIMAP' VIEW*/
                    if(ctrl.minimap_mode != 2){
                      ctrl.minimapViewGeometry = new THREE.BufferGeometry();
                      ctrl.minimapViewGeometry.dynamic = true;
                      ctrl.minimapViewMaterial = new THREE.MeshBasicMaterial({
                          color: 0x000000,
                          side: THREE.DoubleSide,
                          opacity: 1,
                          transparent: true
                      });
                      var positions = new Float32Array([
                         ctrl.camera.left, ctrl.camera.top, 2.0,
                         ctrl.camera.right, ctrl.camera.top, 2.0,
                         ctrl.camera.right, ctrl.camera.bottom, 2.0,
                         ctrl.camera.right, ctrl.camera.bottom, 2.0,
                         ctrl.camera.left, ctrl.camera.bottom, 2.0,
                         ctrl.camera.left, ctrl.camera.top, 2.0
                     ]);
                      ctrl.minimapViewGeometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                      ctrl.minimapViewMesh = new THREE.Mesh(ctrl.minimapViewGeometry, ctrl.minimapViewMaterial);
                    }
                };
                ctrl.updateCameraPosition = function(left, right, top, bottom) {
                    for (var i = 0; i < ctrl.num_channels; i++) {
                        ctrl.prezoom_increments.push(ctrl.channel_list[i].x_inc_per_div);
                    }
                    ctrl.camera.left = left;
                    ctrl.camera.right = right;
                    ctrl.camera.top = top;
                    ctrl.camera.bottom = bottom;
                    ctrl.camera.updateProjectionMatrix();
                    ctrl.drawTicksAndLines({preserve_divs: false});
                };
                ctrl.adjustCamera = function(keycode) {
                    if (ctrl.zoomed) { //adjustment via keys only valid if already zoomed
                        var left = ctrl.camera.left;
                        var right = ctrl.camera.right;
                        var top = ctrl.camera.top;
                        var bottom = ctrl.camera.bottom;
                        if (keycode == 37) { //left
                            if (left === 0) return;
                            left = left - ctrl.y_inc_per_div;
                            right = right - ctrl.y_inc_per_div;
                            if (left < 0) {
                                var difference = Math.abs(left);
                                left = 0;
                                right -= difference;
                            }
                        } else if (keycode == 38) { //up
                            if (top === ctrl.unzoomed_ymax) return;
                            top = top + ctrl.channel_list[ctrl.currentChannel].x_inc_per_div;
                            bottom = bottom + ctrl.channel_list[ctrl.currentChannel].x_inc_per_div;
                            if (top > ctrl.unzoomed_ymax) {
                                var difference = top - ctrl.unzoomed_ymax;
                                top = ctrl.unzoomed_ymax;
                                bottom -= difference;
                            }
                        } else if (keycode == 39) { //right
                            if (right === ctrl.unzoomed_xmax) return;
                            right = right + ctrl.y_inc_per_div;
                            left = left + ctrl.y_inc_per_div;
                            if (right > ctrl.unzoomed_xmax) {
                                var difference = right - ctrl.unzoomed_xmax;
                                right = ctrl.unzoomed_xmax;
                                left -= difference;
                            }
                        } else if (keycode == 40) { //down
                            if (bottom === ctrl.unzoomed_ymin) return;
                            bottom = bottom - ctrl.channel_list[ctrl.currentChannel].x_inc_per_div;
                            top = top - ctrl.channel_list[ctrl.currentChannel].x_inc_per_div;
                            if (bottom < ctrl.unzoomed_ymin) {
                                var difference = ctrl.unzoomed_ymin - bottom;
                                bottom = ctrl.unzoomed_ymin;
                                top += difference;
                            }
                        } else {
                            console.log('Invalid keycode to adjust camera.');
                        }
                        if (left >= 0 && right <= ctrl.unzoomed_xmax && top <= ctrl.unzoomed_ymax && bottom >= ctrl.unzoomed_ymin) {
                            ctrl.updateCameraPosition(left, right, top, bottom);
                        }
                    }
                };

                ctrl.minimap_pandownInScreenBox = function(){
                    var pos = ctrl.minimapViewMesh.geometry.attributes.position.array;
                    return (ctrl.minimap_pan_down.x > pos[0] && ctrl.minimap_pan_down.x < pos[3]) && (ctrl.minimap_pan_down.y < pos[1] && ctrl.minimap_pan_down.y > pos[7]);
                };

                ctrl.minimap_pan = function(x, y){
                    if (ctrl.camera.left < 0 || ctrl.camera.top > ctrl.unzoomed_ymax || ctrl.camera.bottom < ctrl.unzoomed_ymin ||
                        ctrl.camera.right > ctrl.unzoomed_xmax) return;
                    var xadj = (ctrl.minimap.right - ctrl.minimap.left) / ctrl.minimap_renderer.domElement.parentNode.offsetWidth;
                    var xoff = ctrl.minimap.left;
                    var yadj = (ctrl.minimap.bottom - ctrl.minimap.top) / ctrl.minimap_renderer.domElement.offsetHeight;
                    var yoff = ctrl.minimap.top;

                    if (!ctrl.minimap_pan_down.in_camera_space) {
                        ctrl.minimap_pan_down.x = ctrl.minimap_pan_down.x * xadj + xoff;
                        ctrl.minimap_pan_down.y = ctrl.minimap_pan_down.y * yadj + yoff;
                        ctrl.minimap_pan_down.in_camera_space = true;
                    }
                    x = x < 0 ? 0 : x;
                    y = y < 0 ? 0 : y;
                    x = x * xadj + xoff;
                    y = y * yadj + yoff;

                    var y_height = Math.abs(ctrl.camera.top - ctrl.camera.bottom);
                    var x_width = Math.abs(ctrl.camera.left - ctrl.camera.right);
                    var horizontal_r = x_width / 2;
                    var vertical_r = y_height / 2;
                    var left = x - horizontal_r;
                    var right = x + horizontal_r;
                    var top = y + vertical_r;
                    var bottom = y - vertical_r;
                    var difference;
                    if (left < 0) {
                        difference = Math.abs(left);
                        left = 0;
                        right += difference;
                    }
                    if (top > ctrl.unzoomed_ymax) {
                        difference = top - ctrl.unzoomed_ymax;
                        top = ctrl.unzoomed_ymax;
                        bottom -= difference;
                    }
                    if (right > ctrl.unzoomed_xmax) {
                        difference = right - ctrl.unzoomed_xmax;
                        right = ctrl.unzoomed_xmax;
                        left -= difference;
                    }
                    if (bottom < ctrl.unzoomed_ymin) {
                        difference = ctrl.unzoomed_ymin - bottom;
                        bottom = ctrl.unzoomed_ymin;
                        top += difference;
                    }
                    if (left >= 0 && right <= ctrl.unzoomed_xmax && top <= ctrl.unzoomed_ymax && bottom >= ctrl.unzoomed_ymin) {
                        ctrl.updateCameraPosition(left, right, top, bottom);
                    }

                };

                ctrl.minimap_movePosition = function(x, y){
                    if (ctrl.camera.left < 0 || ctrl.camera.top > ctrl.unzoomed_ymax || ctrl.camera.bottom < ctrl.unzoomed_ymin ||
                        ctrl.camera.right > ctrl.unzoomed_xmax) return;
                    var xadj = (ctrl.minimap.right - ctrl.minimap.left) / ctrl.minimap_renderer.domElement.parentNode.offsetWidth;
                    var xoff = ctrl.minimap.left;
                    var yadj = (ctrl.minimap.bottom - ctrl.minimap.top) / ctrl.minimap_renderer.domElement.offsetHeight;
                    var yoff = ctrl.minimap.top;
                    if (!ctrl.minimap_pan_down.in_camera_space) {
                        ctrl.minimap_pan_down.x = ctrl.minimap_pan_down.x * xadj + xoff;
                        ctrl.minimap_pan_down.y = ctrl.minimap_pan_down.y * yadj + yoff;
                        x = ctrl.minimap_pan_down.x;
                        y = ctrl.minimap_pan_down.y;
                        ctrl.minimap_pan_down.in_camera_space = true;
                    }
                    var y_height = Math.abs(ctrl.camera.top - ctrl.camera.bottom);
                    var x_width = Math.abs(ctrl.camera.left - ctrl.camera.right);
                    var horizontal_r = x_width / 2;
                    var vertical_r = y_height / 2;
                    var left = x - horizontal_r;
                    var right = x + horizontal_r;
                    var top = y + vertical_r;
                    var bottom = y - vertical_r;
                    var difference;
                    if (left < 0) {
                        difference = Math.abs(left);
                        left = 0;
                        right += difference;
                    }
                    if (top > ctrl.unzoomed_ymax) {
                        difference = top - ctrl.unzoomed_ymax;
                        top = ctrl.unzoomed_ymax;
                        bottom -= difference;
                    }
                    if (right > ctrl.unzoomed_xmax) {
                        difference = right - ctrl.unzoomed_xmax;
                        right = ctrl.unzoomed_xmax;
                        left -= difference;
                    }
                    if (bottom < ctrl.unzoomed_ymin) {
                        difference = ctrl.unzoomed_ymin - bottom;
                        bottom = ctrl.unzoomed_ymin;
                        top += difference;
                    }
                    if (left >= 0 && right <= ctrl.unzoomed_xmax && top <= ctrl.unzoomed_ymax && bottom >= ctrl.unzoomed_ymin) {
                        ctrl.updateCameraPosition(left, right, top, bottom);
                    }
                };

                ctrl.panCamera = function(x, y, shftdwn, ctrldwn) {
                    if (ctrl.zoomed) {
                        if (ctrl.camera.left < 0 || ctrl.camera.top > ctrl.unzoomed_ymax || ctrl.camera.bottom < ctrl.unzoomed_ymin ||
                            ctrl.camera.right > ctrl.unzoomed_xmax) return;
                        var left;
                        var right;
                        var top;
                        var bottom;
                        var xadj = (ctrl.camera.right - ctrl.camera.left) / ctrl.renderer.domElement.parentNode.offsetWidth;
                        var xoff = ctrl.camera.left;
                        var yadj = (ctrl.camera.bottom - ctrl.camera.top) / ctrl.renderer.domElement.parentNode.offsetHeight;
                        var yoff = ctrl.camera.top;
                        if (!ctrl.pan_down.in_camera_space) {
                            ctrl.pan_down.x = ctrl.pan_down.x * xadj + xoff;
                            ctrl.pan_down.y = ctrl.pan_down.y * yadj + yoff;
                            ctrl.pan_down.in_camera_space = true;
                        }
                        x = x * xadj + xoff;
                        y = y * yadj + yoff;
                        var ignore = false;
                        if (shftdwn && ctrldwn) ignore = true;
                        if (shftdwn && !ignore) {
                            left = ctrl.camera.left - (x - ctrl.pan_down.x);
                            right = ctrl.camera.right - (x - ctrl.pan_down.x);
                            top = ctrl.camera.top;
                            bottom = ctrl.camera.bottom;
                        } else if (ctrldwn && !ignore) {
                            left = ctrl.camera.left;
                            right = ctrl.camera.right;
                            top = ctrl.camera.top - (y - ctrl.pan_down.y);
                            bottom = ctrl.camera.bottom - (y - ctrl.pan_down.y);
                        } else {
                            left = ctrl.camera.left - (x - ctrl.pan_down.x);
                            right = ctrl.camera.right - (x - ctrl.pan_down.x);
                            top = ctrl.camera.top - (y - ctrl.pan_down.y);
                            bottom = ctrl.camera.bottom - (y - ctrl.pan_down.y);
                        }
                        var difference;
                        if (left < 0) {
                            difference = Math.abs(left);
                            left = 0;
                            right += difference;
                        }
                        if (top > ctrl.unzoomed_ymax) {
                            difference = top - ctrl.unzoomed_ymax;
                            top = ctrl.unzoomed_ymax;
                            bottom -= difference;
                        }
                        if (right > ctrl.unzoomed_xmax) {
                            difference = right - ctrl.unzoomed_xmax;
                            right = ctrl.unzoomed_xmax;
                            left -= difference;
                        }
                        if (bottom < ctrl.unzoomed_ymin) {
                            difference = ctrl.unzoomed_ymin - bottom;
                            bottom = ctrl.unzoomed_ymin;
                            top += difference;
                        }
                        if (left >= 0 && right <= ctrl.unzoomed_xmax && top <= ctrl.unzoomed_ymax && bottom >= ctrl.unzoomed_ymin) {
                            ctrl.updateCameraPosition(left, right, top, bottom);
                        }
                    }
                };
                ctrl.toggleInputs = function() {
                    for (var i = 0; i < ctrl.num_channels; i++) {
                        document.getElementById(ctrl.channel_list[i].getColor() + 'input').disabled = ctrl.zoomed;
                        document.getElementById('div_time_info').disabled = ctrl.zoomed;
                    }
                };
                ctrl.zoom = function() {
                    if (ctrl.mouse_dragging && Math.abs(ctrl.mouse_start.x - ctrl.mouse_end.x) > ctrl.zoomed_xmax &&
                        Math.abs(ctrl.mouse_start.y - ctrl.mouse_end.y) > ctrl.zoomed_ymax) {
                        for (var i = 0; i < ctrl.num_channels; i++) {
                            document.getElementById(ctrl.channel_list[i].getColor() + 'input').disabled = true;
                        }
                        if(ctrl.mouse_end.x < ctrl.mouse_start.x){
                          var temp;
                          temp = ctrl.mouse_end.x;
                          ctrl.mouse_end.x = ctrl.mouse_start.x;
                          ctrl.mouse_start.x = temp;
                          temp = ctrl.mouse_end.y;
                          ctrl.mouse_end.y = ctrl.mouse_start.y;
                          ctrl.mouse_start.y = temp;
                        }
                        ctrl.mouse_start.x = Math.floor(ctrl.mouse_start.x / 10) * 10; //snap to nearest 10th value
                        ctrl.mouse_start.y = Math.ceil(ctrl.mouse_start.y / 10) * 10; //^
                        ctrl.mouse_end.x = Math.ceil(ctrl.mouse_end.x / 10) * 10; //^
                        ctrl.mouse_end.y = Math.floor(ctrl.mouse_end.y / 10) * 10; //^
                        ctrl.updateCameraPosition((ctrl.mouse_start.x < ctrl.mouse_end.x) ? ctrl.mouse_start.x : ctrl.mouse_end
                            .x, (ctrl.mouse_start.x < ctrl.mouse_end.x) ? ctrl.mouse_end.x : ctrl.mouse_start.x, (ctrl.mouse_start
                                .y < ctrl.mouse_end.y) ? ctrl.mouse_end.y : ctrl.mouse_start.y, (ctrl.mouse_start.y <
                                ctrl.mouse_end.y) ? ctrl.mouse_start.y : ctrl.mouse_end.y);
                        if(ctrl.minimap_mode != 2){
                          ctrl.renderer.domElement.parentNode.style.height = '84.7%';
                          ctrl.renderer.domElement.parentNode.appendChild(ctrl.minimap_renderer.domElement);
                        }
                        ctrl.zoomed = true;
                        ctrl.toggleInputs();
                    }
                };
                ctrl.unzoom = function() {
                    if (ctrl.zoomed) {
                        ctrl.updateCameraPosition(0, ctrl.unzoomed_xmax, ctrl.unzoomed_ymax, ctrl.unzoomed_ymin);
                        ctrl.x_mult = (Math.ceil(Math.abs(ctrl.camera.left - ctrl.camera.right) / ctrl.num_divs)) /
                                    ctrl.y_inc_per_div;
                        ctrl.y_mult = 1;
                        ctrl.shift_left = 0;
                        ctrl.zoomed = false;
                        ctrl.toggleInputs();
                        for (var i = 0; i < ctrl.num_channels; i++) {
                            ctrl.channel_list[i].x_inc_per_div = ctrl.prezoom_increments[i];
                        }
                        if(ctrl.minimap_mode != 2){
                          ctrl.renderer.domElement.parentNode.style.height = '95.9%';
                          ctrl.renderer.domElement.parentNode.removeChild(ctrl.minimap_renderer.domElement);
                        }
                        ctrl.toggleInputs();
                        ctrl.prezoom_increments = [];
                    }
                };
                ctrl.zoom_wheel = function(x, y, dir) {
                    var xadj = (ctrl.camera.right - ctrl.camera.left) / ctrl.renderer.domElement.parentNode.offsetWidth;
                    var xoff = ctrl.camera.left;
                    var yadj = (ctrl.camera.bottom - ctrl.camera.top) / ctrl.renderer.domElement.parentNode.offsetHeight;
                    var yoff = ctrl.camera.top;
                    x = x * xadj + xoff;
                    y = y * yadj + yoff;
                    var camera_height = Math.abs(ctrl.camera.top - ctrl.camera.bottom);
                    var camera_width = Math.abs(ctrl.camera.left - ctrl.camera.right);
                    var camera_mid_x = (camera_width / 2) + ctrl.camera.left;
                    var camera_mid_y = (camera_height / 2) + ctrl.camera.bottom;
                    var x_percentage = ((camera_mid_x - x) / (camera_width / 2)) * -1;
                    var y_percentage = ((camera_mid_y - y) / (camera_height / 2));
                    if (dir > 0) { //zoom in
                        var new_camera_height = Math.abs(ctrl.camera.top - ctrl.camera.bottom) * 0.9;
                        var new_camera_width = Math.abs(ctrl.camera.left - ctrl.camera.right) * 0.9;
                        camera_mid_x = camera_mid_x + ((camera_width - new_camera_width) / 2 * x_percentage);
                        camera_mid_y = camera_mid_y - ((camera_height - new_camera_height) / 2 * y_percentage);
                        var left = camera_mid_x - (new_camera_width / 2);
                        var right = camera_mid_x + (new_camera_width / 2);
                        var top = camera_mid_y + (new_camera_height / 2);
                        var bottom = camera_mid_y - (new_camera_height / 2);
                        if (Math.abs(left - right) > 10 && Math.abs(top - bottom) > 20) {
                            ctrl.updateCameraPosition(left, right, top, bottom);
                        }
                    } else { //zoom out
                        var new_camera_height = Math.abs(ctrl.camera.top - ctrl.camera.bottom) * 1.1;
                        var new_camera_width = Math.abs(ctrl.camera.left - ctrl.camera.right) * 1.1;
                        camera_mid_x = camera_mid_x + ((camera_width - new_camera_width) / 2 * x_percentage);
                        camera_mid_y = camera_mid_y - ((camera_height - new_camera_height) / 2 * y_percentage);
                        var left = camera_mid_x - (new_camera_width / 2);
                        var right = camera_mid_x + (new_camera_width / 2);
                        var top = camera_mid_y + (new_camera_height / 2);
                        var bottom = camera_mid_y - (new_camera_height / 2);
                        if (left > 0 && right < ctrl.unzoomed_xmax && top < ctrl.unzoomed_ymax && bottom > ctrl.unzoomed_ymin) {
                            ctrl.updateCameraPosition(left, right, top, bottom);
                        } else {
                            ctrl.unzoom();
                            return;
                        }
                    }
                    if(ctrl.minimap_mode != 2){
                      ctrl.renderer.domElement.parentNode.style.height = '84.7%';
                      ctrl.renderer.domElement.parentNode.appendChild(ctrl.minimap_renderer.domElement);
                    }
                    ctrl.zoomed = true;
                    ctrl.toggleInputs();
                };
                ctrl.update = function(timestamp) {
                    ctrl.stats.begin();
                    if (typeof ctrl.ticks_mesh != 'undefined' && ctrl.minimap_mode != 2) {
                        ctrl.scene.add(ctrl.major_line_mesh);
                        ctrl.scene.add(ctrl.h_lines_mesh);
                        ctrl.scene.add(ctrl.v_lines_mesh);
                        ctrl.scene.add(ctrl.ticks_mesh);
                    }
                    for (var k = 0; k < ctrl.num_channels; k++) {
                        for (var j = 0; j < ctrl.num_lines_in_mem; j++) {
                            if (ctrl.channel_list[k].mesh_renewal[j] != 0) {
                                var new_opacity = Math.exp((timestamp - ctrl.channel_list[k].mesh_renewal[j]) / ctrl.OPACITY_FADE_RATE);
                                ctrl.channel_list[k].mesh[j].material.opacity = new_opacity;
                                ctrl.channel_list[k].mesh[j].material.needsUpdate = true;
                            }
                        }
                    }
                    var height = ctrl.renderer.domElement.parentNode.offsetHeight;
                    var width = ctrl.renderer.domElement.parentNode.offsetWidth;
                    if (typeof ctrl.h_lines_mesh !== 'undefined' && typeof ctrl.major_line_mesh !== 'undefined') {
                        if (height < ctrl.minimum_window_sz || width < ctrl.minimum_window_sz) {
                            ctrl.h_lines_mesh.visible = false;
                            ctrl.v_lines_mesh.visible = false;
                            ctrl.major_line_mesh.visible = false;
                            document.getElementById('c_box').style.visibility = 'hidden';
                            document.getElementById('xnums').style.visibility = 'hidden';
                            document.getElementById('ynums').style.visibility = 'hidden';
                            ctrl.minimap_renderer.domElement.style.visibility = 'hidden';
                            ctrl.hidden = true;
                        } else {
                            if (ctrl.hidden) {
                                ctrl.h_lines_mesh.visible = true;
                                ctrl.v_lines_mesh.visible = true;
                                ctrl.major_line_mesh.visible = true;
                                document.getElementById('c_box').style.visibility = 'visible';
                                document.getElementById('xnums').style.visibility = 'visible';
                                document.getElementById('ynums').style.visibility = 'visible';
                                ctrl.minimap_renderer.domElement.style.visibility = 'visible';
                                ctrl.drawTicksAndLines({preserve_divs: false});
                                ctrl.hidden = false;
                            }
                        }
                    }
                    if ((ctrl.previous_width != width || ctrl.previous_height != height) && !ctrl.hidden) {
                        ctrl.previous_width = width;
                        ctrl.previous_height = height;
                        ctrl.drawTicksAndLines({
                            preserve_divs: true
                        });
                    }
                    ctrl.renderer.setSize(width, height);
                    if(ctrl.minimap_mode != 2)
                      ctrl.minimap_renderer.setSize(ctrl.renderer.domElement.parentNode.offsetWidth, ctrl.renderer.domElement
                          .parentNode.offsetHeight - (ctrl.renderer.domElement.parentNode.offsetHeight * 0.88));
                    var max_x_value = ctrl.zoomed ? Math.abs(ctrl.camera.left - ctrl.camera.right) : ctrl.unzoomed_xmax;
                    for (var i = 0, j = ctrl.camera.left, k = 0; i <= ctrl.renderer.domElement.offsetWidth; i += Math.floor(
                            (ctrl.renderer.domElement.offsetWidth) / ctrl.num_divs), j += Math.ceil((max_x_value) / ctrl.num_divs),
                        k++) {
                        var txt = document.getElementById('xlabel' + k);
                        if (txt) {
                            var out = Math.round(j);
                            txt.style.left = k === ctrl.num_divs ? (i - 33) + 'px' : (i) + 'px';
                            txt.innerHTML = out + 'ns';
                        }
                    }
                    var max_y_value = ctrl.zoomed ? Math.abs(ctrl.camera.top - ctrl.camera.bottom) : ctrl.unzoomed_height;
                    for (var i = ctrl.renderer.domElement.offsetHeight, j = ctrl.camera.top, k = 0; i > 0; i -= Math.floor(
                            (ctrl.renderer.domElement.offsetHeight / ctrl.num_divs)), j -= Math.ceil((max_y_value) / ctrl.num_divs),
                        k++) {
                        var txt = document.getElementById('ylabel' + k);
                        if (txt) {
                            var out = Math.round(j);
                            txt.innerHTML = out === 0 ? '0.00mV' : (out > 0 ? '+' : '') + out + 'mV';
                            txt.style.bottom = k === ctrl.num_divs ? (i) + 'px' : k === 0 ? (i - 20) + 'px' : (i - 10) +
                                'px';
                        }
                    }
                    ctrl.renderer.render(ctrl.scene, ctrl.camera);
                    if(ctrl.minimap_mode != 2){
                      ctrl.scene.remove(ctrl.ticks_mesh);
                      ctrl.scene.remove(ctrl.major_line_mesh);
                      ctrl.scene.remove(ctrl.h_lines_mesh);
                      ctrl.scene.remove(ctrl.v_lines_mesh);
                      if (typeof ctrl.minimapViewMesh == 'object' && ctrl.zoomed) {
                          ctrl.scene.add(ctrl.minimapViewMesh);
                      }
                      ctrl.minimap_renderer.render(ctrl.scene, ctrl.minimap);
                      if (typeof ctrl.minimapViewMesh == 'object' && ctrl.zoomed) {
                          ctrl.scene.remove(ctrl.minimapViewMesh);
                      }
                    }
                    ctrl.stats.end();
                    requestAnimationFrame(ctrl.update);
                };
                ctrl.getTitleElement = function(attrs, width) {
                    var t = document.createElement('p');
                    t.innerHTML = '&nbsp;&nbsp;' + attrs.channeltitle;
                    t.style.position = 'absolute';
                    t.setAttribute('id', 'title_p');
                    t.style.fontFamily = 'Monospace';
                    t.style.left = 0;
                    t.style.top = '0.7%';
                    t.style.lineHeight = '0px';
                    t.className = 'noselect noIbar unselectable';
                    return t;
                };
                ctrl.getXAxisIncrements = function(attrs, width) {
                    var x_nums = document.createElement('label');
                    x_nums.style.position = 'absolute';
                    x_nums.setAttribute('id', 'xnums');
                    x_nums.style.left = 0;
                    x_nums.style.marginTop = '-0.9%';
                    x_nums.style.fontFamily = 'Monospace';
                    for (var i = 0, j = 0; i <= ctrl.renderer.domElement.offsetWidth; i += Math.floor((ctrl.renderer.domElement
                        .offsetWidth) / 10), j++) {
                        var txt = document.createElement('span');
                        txt.setAttribute('id', 'xlabel' + j);
                        txt.style.left = j === 10 ? (i - 20) + 'px' : (i) + 'px';
                        txt.innerHTML = 0;
                        txt.style.fontFamily = 'Monospace';
                        txt.className = 'noselect noIbar unselectable';
                        txt.style.position = 'absolute';
                        x_nums.appendChild(txt);
                    }
                    return x_nums;
                };
                ctrl.getYAxisIncrements = function() {
                    var y_nums = document.createElement('p');
                    var width_adj = -65;
                    var height = ctrl.renderer.domElement.offsetHeight;
                    y_nums.setAttribute('id', 'ynums');
                    y_nums.style.marginLeft = width_adj + 'px';
                    y_nums.style.fontFamily = 'Monospace';
                    for (var i = height, j = 0; i > 0; i -= Math.round((height / 10)), j++) {
                        var txt = document.createElement('span');
                        txt.setAttribute('id', 'ylabel' + j);
                        txt.className = 'noselect';
                        txt.innerHTML = 0;
                        txt.style.position = 'absolute';
                        txt.style.bottom = (i) + 'px';
                        y_nums.appendChild(txt);
                    }
                    return y_nums;
                };
                ctrl.updateRunStopSwitch = function(state) {
                    ctrl.runstop_status = ctrl.runstop_status == "Stop" ? "Run" : "Stop";
                };
                ctrl.selectBox = function(event) {
                    for (var i = 0; i < ctrl.num_channels; i++) {
                        if (ctrl.channel_list[i].getColor() + 'input' === event.target.id) {
                            ctrl.currentChannel = i;
                            return;
                        }
                    }
                };
                ctrl.toggleChannel = function(event) {
                    for (var i = 0; i < ctrl.num_channels; i++) {
                        if (ctrl.channel_list[i].getColor() + 'box' === event.target.id) {
                            var enabled = event.target.style.opacity == 1 ? false : true;
                            event.target.style.opacity = enabled ? 1 : 0.4;
                            if (ctrl.zoomed) {
                                document.getElementById(ctrl.channel_list[i].getColor() + 'input').disabled = true;
                            } else {
                                document.getElementById(ctrl.channel_list[i].getColor() + 'input').disabled = !document.getElementById(
                                    ctrl.channel_list[i].getColor() + 'input').disabled;
                            }
                            ctrl.channel_list[i].visible = enabled;
                            return;
                        }
                    }
                }
                requestAnimationFrame(ctrl.update);
            }],
        link: function(scope, elem, attrs) {
            var legend = document.getElementById(attrs.legend);
            var ymin = parseInt(attrs.ymin);
            var ymax = parseInt(attrs.ymax);
            var height = ymax - ymin;
            var labels = attrs.labels.split(",");
            scope.ctrl.channel_labels = attrs.channellabels.split(',');
            scope.ctrl.minimap_mode = parseInt(attrs.minimapmode);
            scope.ctrl.line_color = attrs.linecolor; //set line color from DOM element
            labels.unshift("X");
            elem[0].style.marginLeft = (((window.innerWidth / window.innerHeight) * 0.0184844) * 100) + '%';
            elem[0].style.height = '95.9%';
            scope.ctrl.renderer = new THREE.WebGLRenderer({
                alpha: false,
                depth: true,
                antialias: true
            });
            scope.ctrl.renderer.setClearColor(attrs.backgroundcolor);
            scope.ctrl.renderer.setPixelRatio(window.devicePixelRatio);
            scope.ctrl.renderer.setSize(elem[0].offsetWidth, elem[0].offsetHeight);
            scope.ctrl.renderer.domElement.style.border = '1px solid #595959';
            scope.ctrl.unzoomed_ymin = ymin;
            scope.ctrl.unzoomed_ymax = ymax;
            scope.ctrl.unzoomed_height = ymax - ymin;
            scope.ctrl.zoomed_xmax = 1;
            scope.ctrl.zoomed_ymax = (ymax - ymin) / scope.ctrl.max_zoom_allowed;
            // setup initial camera, we'll adjust its X axis once we receive data
            scope.ctrl.camera = new THREE.OrthographicCamera(0, 0, ymax, ymin, 1, 10);
            scope.ctrl.camera.position.z = 9;
            scope.ctrl.scene = new THREE.Scene();
            //set up minimap camera
            if(scope.ctrl.minimap_mode != 2){
              scope.ctrl.minimap = new THREE.OrthographicCamera(0, 0, ymax, ymin, 1, 10);
              scope.ctrl.minimap.position.z = 9;
              scope.ctrl.minimap_renderer = new THREE.WebGLRenderer({
                  alpha: true,
                  depth: true,
                  antialias: true
              });
              scope.ctrl.minimap_renderer.setClearColor(0xFFFFFF, 0.1);
              scope.ctrl.minimap_renderer.setPixelRatio(window.devicePixelRatio);
              scope.ctrl.minimap_renderer.setSize(elem[0].offsetWidth - (elem[0].offsetWidth * 0.05), elem[0].offsetHeight - (
                  elem[0].offsetHeight * 0.88));
              scope.ctrl.minimap.top = scope.ctrl.unzoomed_ymax;
              scope.ctrl.minimap.bottom = scope.ctrl.unzoomed_ymin;
              scope.ctrl.minimap.updateProjectionMatrix();
              scope.ctrl.minimap_renderer.domElement.style.marginTop = '0.25%';
              scope.ctrl.minimap_renderer.domElement.style.left = 0;
              scope.ctrl.minimap_renderer.domElement.style.bottom = '2.1%';
              scope.ctrl.minimap_renderer.domElement.style.border = '1px solid #595959';
            }
            scope.ctrl.stats = new Stats();
            scope.ctrl.stats.setMode(0); // 0: fps, 1: ms, 2: mb, 3+: custom
            scope.ctrl.stats.domElement.style.position = 'absolute';
            scope.ctrl.stats.domElement.style.left = '0px';
            scope.ctrl.stats.domElement.style.top = '0px';
            scope.ctrl.previous_height = elem[0].offsetHeight;
            scope.ctrl.previous_width = elem[0].offsetWidth;
            /*comment/uncomment below to respectively hide/show FPS stats*/
            elem[0].appendChild( scope.ctrl.stats.domElement );
            elem[0].position = 'relative';
            elem[0].appendChild(scope.ctrl.getTitleElement(attrs, elem[0].offsetWidth));
            elem[0].appendChild(scope.ctrl.renderer.domElement);
            elem[0].appendChild(scope.ctrl.getYAxisIncrements());
            elem[0].appendChild(scope.ctrl.getXAxisIncrements(attrs, elem[0].offsetWidth));

            function mousedown(e) {
                if (e.button === 0) { //left click
                    scope.ctrl.startDrag(e.pageX - elem[0].offsetLeft, e.pageY - elem[0].offsetTop);
                    e.stopPropagation();
                } else if (e.button === 1) { //middle mouse button
                } else if (e.button === 2) { //right click
                    scope.ctrl.pan_down.x = e.pageX - elem[0].offsetLeft;
                    scope.ctrl.pan_down.y = e.pageY - elem[0].offsetTop;
                }
            }

            function moveminimap(e) {
                if (e.button === 0) { //left click
                    console.log((e.pageX - elem[0].offsetLeft) + ' ' + (e.pageY - elem[0].offsetTop));
                } else if (e.button === 1) { //middle mouse button
                } else if (e.button === 2) { //right click
                }
            }

            function mouseout(e) {
                scope.ctrl.stopDrag();
                e.stopPropagation();
            }

            function mousemove(e) {
                if (e.button === 0) { //left click
                    var height = e.pageY - elem[0].offsetTop;
                    scope.ctrl.updateDrag(e.pageX - elem[0].offsetLeft, height);
                    e.stopPropagation();
                } else if (e.button === 1) { //middle mouse button
                } else if (e.button === 2) { //right click
                    document.body.style.cursor = 'move';
                    scope.ctrl.panCamera(e.pageX - elem[0].offsetLeft, e.pageY - elem[0].offsetTop, e.shiftKey, e.ctrlKey);
                }
            }

            function mouseup(e) {
                if (e.button === 0) {
                    scope.ctrl.zoom();
                    scope.ctrl.stopDrag();
                    e.stopPropagation();
                } else if (e.button === 1) {} else if (e.button === 2) {
                    document.body.style.cursor = 'default';
                    scope.ctrl.pan_down.in_camera_space = false;
                }
            }

            function dblclick(e) {
                scope.ctrl.unzoom();
                e.stopPropagation();
            }

            function mousewheel(e) {
                scope.ctrl.zoom_wheel(e.pageX - elem[0].offsetLeft, e.pageY - elem[0].offsetTop, Math.max(-1, Math.min(1, (
                    e.wheelDelta || -e.detail))));
                e.stopPropagation();
            }

            function onkeydown(e) {
                if (e.keyCode > 36 && e.keyCode < 41) //keycodes for arrow keys, left:37 up:38 right:39 down:40
                    scope.ctrl.adjustCamera(e.keyCode);
                e.stopPropagation();
            }

            elem[0].oncontextmenu = function(e) {
                e.preventDefault(); //prevent right click menu
            };
            scope.ctrl.renderer.domElement.addEventListener('mousewheel', mousewheel, false);
            elem[0].setAttribute('tabindex', 0); // to give keyboard focus to canvas
            elem[0].addEventListener('keydown', onkeydown);
            scope.ctrl.renderer.domElement.addEventListener('mouseup', mouseup, false);
            scope.ctrl.renderer.domElement.addEventListener('mousedown', mousedown, false);
            scope.ctrl.renderer.domElement.addEventListener('mouseout', mouseout, false);
            scope.ctrl.renderer.domElement.addEventListener('mousemove', mousemove, false);
            scope.ctrl.renderer.domElement.addEventListener('dblclick', dblclick, false);

            if(scope.ctrl.minimap_mode != 2){
              scope.ctrl.minimap_ismousedown = false;
              scope.ctrl.minimap_ismousemoving = false;

              function minimap_mousedown(e){
                  //mouse down minimap
                  e.preventDefault();
                  scope.ctrl.minimap_ismousedown = true;
                  scope.ctrl.minimap_pan_down.x = e.pageX - elem[0].offsetLeft;
                  scope.ctrl.minimap_pan_down.y = e.pageY - (scope.ctrl.minimap_renderer.domElement.offsetTop + 10);
                  scope.ctrl.minimap_movePosition(scope.ctrl.minimap_pan_down.x, scope.ctrl.minimap_pan_down.y);
                  e.stopPropagation();
              }

              function minimap_mousemove(e){
                  //mouse move minimap
                  if(scope.ctrl.minimap_ismousedown){
                      document.body.style.cursor = 'move';
                      scope.ctrl.minimap_ismousemoving = true;
                      scope.ctrl.minimap_pan(e.pageX - elem[0].offsetLeft, e.pageY - (scope.ctrl.minimap_renderer.domElement.offsetTop + 10));
                  }
                  e.stopPropagation();
              }

              function minimap_mouseup(e){
                  //mouse up minimap
                  document.body.style.cursor = 'default';
                  scope.ctrl.minimap_pan_down.in_camera_space = false;
                  scope.ctrl.minimap_ismousedown = false;
                  scope.ctrl.minimap_ismousemoving = true;
                  e.stopPropagation();
              }
              scope.ctrl.minimap_renderer.domElement.addEventListener('mousedown', minimap_mousedown, false);
              scope.ctrl.minimap_renderer.domElement.addEventListener('mousemove', minimap_mousemove, false);
              scope.ctrl.minimap_renderer.domElement.addEventListener('drag', minimap_mousemove, false);
              scope.ctrl.minimap_renderer.domElement.addEventListener('mouseup', minimap_mouseup, false);
            }

        },
        template: '<div layout=column id="c_box" class="unselectable noIbar noselect" ng-click="$event.stopPropagation();" style="position: absolute; right: 0px; visibility: visible; background-color: rgba(0, 0, 0, 0.5);width:135px;">' +
            '<md-switch id="runstop" ng-change="ctrl.updateRunStopSwitch()" ng-model="ctrl.run">{{ctrl.runstop_status}}</md-switch>' +
            '<md-button id="single" class="md-primary fade" style="padding: 0; margin-bottom: 15%; margin-right: 15%; background-color:rgba(68,69,81, 0.7);" ng-click="ctrl.single = true;">Single</md-button>' +
            '<div class="adjustedmargin">' + '<md-input-container flex-gt-sm>' + '<label>Nanosecs/Div</label>' +
            '<input id="div_time_info" class="input" type="number" step="1" ng-model="ctrl.updateTimeDivision" ng-model-options="{ getterSetter: true, allowInvalid: true }"' +
            '</md-input-container>' + '</div>' + '<div class="adjustedmargin" ng-repeat="channel in ctrl.channel_list">' +
            '<p align="left" style="font-family: Monospace; margin: -3px; color:{{channel.getColor()}}">{{channel.channel_label}}</p>' +
            '<div class="colorbox shrink" ng-dblclick="ctrl.toggleChannel($event)" id="{{channel.getColor()}}box" style="background:{{channel.getColor()}}; margin-top: 15px; opacity: 1"></div>' +
            '<md-input-container flex-gt-sm style="width:96px">' + '<label>mV/Div</label>' +
            '<input id="{{channel.getColor()}}input" type="number" class="div_info" step="1" ng-model="channel.updateDivision" ng-mouseover="ctrl.selectBox($event)" ng-model-options="{ getterSetter: true, allowInvalid: true }"' +
            '</md-input-container>' + '</div>' + '</div>'
    }
});
