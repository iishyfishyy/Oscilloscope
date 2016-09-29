var WebGLLines = function(attrs) {
    this.minimapEnabled = attrs.minimapEnabled;
    this.canvas         = attrs.canvas;
    this.canvasParent   = attrs.parentNode;
    this.gl;
    this.minimapGL;
    this.minimapCanvas  = document.createElement('canvas');
    this.ymin           = attrs.ymin;
    this.ymax           = attrs.ymax;
    try {
        this.gl = this.canvas.getContext('experimental-webgl', {
            antialias: false,
            alpha: true,
            premultipliedAlpha: false,
            preserveDrawingBuffer: false
        });
        if (this.minimapEnabled) {
            this.minimapGL = this.minimapCanvas.getContext('experimental-webgl', {
                antialias: false,
                alpha: true,
                premultipliedAlpha: false,
                preserveDrawingBuffer: false
            });
            this.minimapCanvas.setAttribute('id', 'minimapcanvas');
        }
        if (this.gl.getParameter(this.gl.SAMPLES) === 0) console.info('No antialiasing.');
    } catch (e) {
        alert('WebGL not supported.');
    }

    this.helpBox ={
      modal: null,
      span : null,
    };
    this.generateHelpBoxElement = function(){
        this.helpBox.modal = document.createElement('div');
        this.helpBox.modal.className = 'modal';
        this.helpBox.modal.setAttribute('id', 'helpbox');
        this.helpBox.span = document.createElement('span');
        this.helpBox.span.className = 'close';
        this.helpBox.span.innerHTML = 'X';
        var modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        var modalHeader  = document.createElement('div');
        modalHeader.className = 'modal-header';
        modalHeader.appendChild(this.helpBox.span);
        var headerText = document.createElement('h2');
        headerText.innerHTML = 'Controls';
        modalHeader.appendChild(headerText);
        var modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        var infoText = document.createElement('p');
        infoText.innerHTML = "\n\
        <h4>Mouse Controls</h4>\n\
        <ul>\n\
            <li>Drag left mouse on main canvas to select & zoom.</li>\n\
            <li>When zoomed, drag right mouse to pan around main canvas. Hold shift for horizontal movement, and ctrl for vertical movement.</li>\n\
            <li>Zoom in/out to your mouse pointer using mouse wheel.</li>\n\
            <li>When zoomed and minimap is enabled, drag the black box in minimap to where you want to position yourself on the main canvas.</li>\n\
            <li>Double click to zoom out.</li>\n\
            <li>When cursors are enabled, hold alt and move mouse near cursor to move it. If both cursors are enabled, you can move both cursors at their intersection.</li>\n\
        </ul>\n\
        <h4>Control Panel</h4>\n\
        <ul>\n\
            <li>Toggle run switch to stop/run the application.</li>\n\
            <li>Pressing Single stops the program automatically and displays the next channel data points.</li>\n\
            <li>Adjusting persistance to far left shows latest data points, and as you go right, you get a fade effect until you reach far right.</li>\n\
            <li>Double click color box corresponding to the channel wave to toggle it's visibility.</li>\n\
            <li>Enable cursor checkboxes to see cursors and their values.</li>\n\
        </ul>\n\
        <h4>HTML Attribute Changes</h4>\n\
        <ul>\n\
            <li>Change channel labels and colors from index.html directive attributes.</li>\n\
            <li>Adjust the canvas color scheme by providing new colors in hexadecimal format.</li>\n\
            <li>Enable/disable minimap, and help box button by changing values to 1/0 respectively.</li>\n\
            </ul>\n\
        \n\
        ";
        modalBody.appendChild(infoText);
        var modalFooter = document.createElement('div');
        modalFooter.className = 'modal-footer';
        var footerText = document.createElement('h3');
        footerText.innerHTML = ''; //add footer text here if needed
        modalFooter.appendChild(footerText);
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modalContent.appendChild(modalFooter);
        this.helpBox.modal.appendChild(modalContent);
    };
    this.generateHelpBoxElement();
    
    this.getHelpBox = function(){
      return this.helpBox;
    }

    /*
     * Vertex shader for drawing waveforms.
     */
    this.vtxShader = "\n\
  attribute vec2 position;\n\
  uniform vec2 u_viewport;\n\
  uniform mat4 u_matrix;\n\
  \n\
  void main(void){\n\
    \n\
    gl_Position = u_matrix * (vec4((position/u_viewport)*2.0-1.0, 0.0, 1.0));\n\
  }";
    /*
     * Fragment shader for drawing waveforms.
     */
    this.fmtShader = "\n\
  precision mediump float;\n\
  \n\
  \n\
  uniform vec4 u_color;\n\
  \n\
  void main(void){\n\
    gl_FragColor = u_color;\n\
  }";
    /*
     * Vertex shader for drawing the quad buffer.
     */
    this.vtxQuadShader = "\n\
  attribute vec2 position;\n\
  attribute vec2 texcoord;\n\
  varying vec2 v_texcoord;\n\
  \n\
  void main(void){\n\
    v_texcoord = position*0.5+0.5;\n\
    gl_Position = vec4(position, 0., 1.);\n\
  }";
    /*
     * Fragment shader for calculating color of the fading texture.
     */
    this.fmtFadeShader = "\n\
  precision mediump float;\n\
  \n\
  \n\
  uniform float u_mixAmount;\n\
  uniform vec4 u_fadeColor;\n\
  uniform sampler2D u_texture;\n\
  varying vec2 v_texcoord;\n\
  const float cutoff = 0.15;\n\
  \n\
  void main(void){\n\
    vec4 color = texture2D(u_texture, v_texcoord);\n\
    vec4 mixed_clr = mix(color, u_fadeColor, u_mixAmount);\n\
    if(mixed_clr[0] < cutoff && mixed_clr[1] < cutoff && mixed_clr[2] < cutoff){ discard; }\n\
    //if(mixed_clr[0] < cutoff){ mixed_clr[0] = 0.; }\n\
    //if(mixed_clr[1] < cutoff){ mixed_clr[1] = 0.; }\n\
    //if(mixed_clr[2] < cutoff){ mixed_clr[2] = 0.; }\n\
    //mixed_clr[3] = mixed_clr[3] * 0.9;\n\
    if(mixed_clr[3] < cutoff){ mixed_clr[3] = 0.; }\n\
    gl_FragColor = mixed_clr;\n\
  }";
    /*
     * Fragment shader to allow copying of textures.
     */
    this.fmtCopyShader = "\n\
  precision mediump float;\n\
  \n\
  \n\
  uniform sampler2D u_texture;\n\
  varying vec2 v_texcoord;\n\
  const float cutoff = 0.2;\n\
  \n\
  void main(void){\n\
    gl_FragColor = texture2D(u_texture, v_texcoord);\n\
  }";
    /*
     * Vertex shader for the canvas grids.
     */
    this.vtxGridShader = "\n\
  attribute vec2 position;\n\
  \n\
  void main() {\n\
    gl_Position = vec4(position, 1., 1.);\n\
  }\n\
  ";
    /*
     * Fragment shader for the canvas grids.
     */
    this.fmtGridShader = "\n\
  precision mediump float;\n\
  uniform vec4 u_color;\n\
  \n\
  void main() {\n\
    gl_FragColor = u_color;\n\
  }\n\
  ";

    this.mixAmt    = 0.03; //0: no fade     0<x<1: fade effect     1: instant fade
    this.numDivs   = parseInt(attrs.numDivs);    //number of divisions on all four sides of center point (i.e. value 5 = 10 divisions)

    this.fadeColor            = [0, 0, 0, 0];  //careful if you decide to change this. Always leave the alpha to 0.0.
    this.unzoomedParentHeight = attrs.unzoomedParentHeight;

    this.clearFlag      = true; //signal drawing of black screen to draw buffer, we clear on first iteration of this.draw()
    this.zoomed         = false;
    this.zoomedXmax     = this.zoomedYmax = 0.125;
    this.unzoomedLeft   = -1;
    this.unzoomedRight  = +1;
    this.unzoomedTop    = +1;
    this.unzoomedBottom = -1;
    this.currentLeft    = -1;
    this.currentRight   = +1;
    this.currentTop     = +1;
    this.currentBottom  = -1;
    this.mouseDragging  = false;
    this.mousePanning   = false;
    this.mouseStart     = {
        x: null,
        y: null
    };
    this.mouseEnd       = {
        x: null,
        y: null
    };
    this.mouseStartScaled={
        x: null,
        y: null
    };
    this.mouseEndScaled = {
        x: null,
        y: null
    };
    this.panDown        = {
        x: null,
        y: null,
        inCameraSpace: false
    };
    this.minimapPanDown = {
        x: null,
        y: null,
        inCameraSpace: false
    };

    this.verticalCursorIntersect   = false;
    this.horizontalCursorIntersect = false;

    this.rainbow_cursors     = false;  // easter egg ;))
    this.fillCursors         = false;  // if both horizontal & vertical cursors are enabled, fill the enclosing box
    this.horizontal_cursor   = false;
    this.vertical_cursor     = false;
    this.horizontal_cursor_sum=0;
    this.vertical_cursor_sum = 0;
    this.max_time            = 0;
    this.h_cursor_val_pos    = 0;
    this.h_cursor_x          = 0;
    this.v_cursor_val_pos    = 0;
    this.v_cursor_y          = 0;
    this.selectionBufferInfo;
    this.selectPositions     = [];
    this.drawPositions       = [];
    this.minimapBoxPositions = [];
    this.backgroundBox       = [
        this.unzoomedLeft , this.unzoomedTop,
        this.unzoomedRight, this.unzoomedTop,
        this.unzoomedRight, this.unzoomedBottom,
        this.unzoomedRight, this.unzoomedBottom,
        this.unzoomedLeft , this.unzoomedBottom,
        this.unzoomedLeft , this.unzoomedTop,
    ];

    /*
     * Framebuffer attachments that define textures.
     */
    this.fadeAttachments        = [{
        format: this.gl.RGBA,
        min:    this.gl.LINEAR,
        max:    this.gl.LINEAR,
        wrap:   this.gl.CLAMP_TO_EDGE,
    }/*, {
        format: this.gl.DEPTH_STENCIL
    }, */];
    if(this.minimapEnabled) this.minimapFadeAttachments = [{
        format: this.minimapGL.RGBA,
        min:    this.minimapGL.LINEAR,
        max:    this.minimapGL.LINEAR,
        wrap:   this.minimapGL.CLAMP_TO_EDGE,
    }/*, {
        format: this.minimapGL.DEPTH_STENCIL
    }, */];

    /*
     * WebGL framebuffer width/height must be a power of two. We calculate it here.
     */
    this.nextPowerOfTwo = function(n) {
        return Math.pow(2, Math.round(Math.log(n) / Math.log(2)));
    };

    /*
     * Handles cursor events, i.e. holding alt key and moving the cursors around.
     * The select_width variable is the 'trigger zone' where cursors can be selected.
     */
    this.dragCursors = function(x, y){
        var xadj = (this.currentRight - this.currentLeft) / this.canvasParent.offsetWidth;
        var xoff = this.currentLeft;
        var yadj = (this.currentBottom - this.currentTop) / this.canvasParent.offsetHeight;
        var yoff = this.currentTop;

        x = x * xadj + xoff;
        y = y * yadj + yoff;

        x = this.scaleBetween(x, this.unzoomedLeft, this.unzoomedRight,this.currentLeft  , this.currentRight);
        y = this.scaleBetween(y  , this.unzoomedLeft, this.unzoomedRight,this.currentBottom, this.currentTop);

        var select_width = 0.025;
        var snap_range   = select_width / 2;

        if(y < this.horizontalCursorY[0] + select_width && y > this.horizontalCursorY[0] - select_width){
            y = (y < this.unzoomedBottom - (this.unzoomedBottom * snap_range)) ? this.unzoomedBottom : (y > this.unzoomedTop - (this.unzoomedTop * snap_range)) ? this.unzoomedTop : y;
            this.horizontalCursorY[0] = y;
        } else if(y < this.horizontalCursorY[1] + select_width && y > this.horizontalCursorY[1] - select_width){
            y =  (y < this.unzoomedBottom - (this.unzoomedBottom * snap_range)) ? this.unzoomedBottom : (y > this.unzoomedTop - (this.unzoomedTop * snap_range)) ? this.unzoomedTop : y;
            this.horizontalCursorY[1] = y;
        }

        if(x < this.verticalCursorX[0] + select_width && x > this.verticalCursorX[0] - select_width){
            x = (x < this.unzoomedLeft - (this.unzoomedLeft * snap_range)) ? this.unzoomedLeft : (x > this.unzoomedRight - (this.unzoomedRight * snap_range)) ? this.unzoomedRight : x;
            this.verticalCursorX[0] = x;
        } else if(x < this.verticalCursorX[1] + select_width && x > this.verticalCursorX[1] - select_width){
            x =  (x < this.unzoomedLeft - (this.unzoomedLeft * snap_range)) ? this.unzoomedLeft : (x > this.unzoomedRight - (this.unzoomedRight * snap_range)) ? this.unzoomedRight : x;
            this.verticalCursorX[1] = x;
        }

    };

    /*
     * Start dragging of a rectangle selection box.
     */
    this.startDrag = function(x, y) {
        var xadj = (this.currentRight - this.currentLeft) / this.canvasParent.offsetWidth;
        var xoff = this.currentLeft;
        var yadj = (this.currentBottom - this.currentTop) / this.canvasParent.offsetHeight;
        var yoff = this.currentTop;

        this.mouseStart.x = x * xadj + xoff;
        this.mouseStart.y = y * yadj + yoff;
        this.mouseEnd.x   = x * xadj + xoff;
        this.mouseEnd.y   = y * yadj + yoff;

        this.selectPositions = [
            this.mouseStart.x, this.mouseStart.y,
            this.mouseEnd.x  , this.mouseStart.y,
            this.mouseEnd.x  , this.mouseEnd.y,
            this.mouseEnd.x  , this.mouseEnd.y,
            this.mouseStart.x, this.mouseEnd.y,
            this.mouseStart.x, this.mouseStart.y,
        ];

        this.mouseStartScaled.x = this.scaleBetween(this.mouseStart.x, this.unzoomedLeft, this.unzoomedRight,this.currentLeft  , this.currentRight);
        this.mouseStartScaled.y = this.scaleBetween(this.mouseStart.y, this.unzoomedLeft, this.unzoomedRight,this.currentBottom, this.currentTop);
        this.mouseEndScaled.x   = this.scaleBetween(this.mouseEnd.x  , this.unzoomedLeft, this.unzoomedRight,this.currentLeft  , this.currentRight);
        this.mouseEndScaled.y   = this.scaleBetween(this.mouseEnd.y  , this.unzoomedLeft, this.unzoomedRight,this.currentBottom, this.currentTop);

        this.drawPositions = [
            this.mouseStartScaled.x, this.mouseStartScaled.y,
            this.mouseEndScaled.x  , this.mouseStartScaled.y,
            this.mouseEndScaled.x  , this.mouseEndScaled.y,
            this.mouseEndScaled.x  , this.mouseEndScaled.y,
            this.mouseStartScaled.x, this.mouseEndScaled.y,
            this.mouseStartScaled.x, this.mouseStartScaled.y,
        ];

        this.mouseDragging = true;
    };

    /*
     * Assuming the user is dragging a mouse and startDrag(x, y) function has been called, update the drag as user updates the positions.
     */
    this.updateDrag = function(x, y) {
        if (this.mouseDragging) {
            var xadj = (this.currentRight - this.currentLeft) / this.canvasParent.offsetWidth;
            var xoff = this.currentLeft;
            var yadj = (this.currentBottom - this.currentTop) / this.canvasParent.offsetHeight;
            var yoff = this.currentTop;

            this.mouseEnd.x = x * xadj + xoff;
            this.mouseEnd.y = y * yadj + yoff;

            this.selectPositions = [
                this.mouseStart.x, this.mouseStart.y,
                this.mouseEnd.x  , this.mouseStart.y,
                this.mouseEnd.x  , this.mouseEnd.y,
                this.mouseEnd.x  , this.mouseEnd.y,
                this.mouseStart.x, this.mouseEnd.y,
                this.mouseStart.x, this.mouseStart.y,
            ];

            this.mouseEndScaled.x   = this.scaleBetween(this.mouseEnd.x  , this.unzoomedLeft, this.unzoomedRight,this.currentLeft  , this.currentRight);
            this.mouseEndScaled.y   = this.scaleBetween(this.mouseEnd.y  , this.unzoomedLeft, this.unzoomedRight,this.currentBottom, this.currentTop);

            this.drawPositions = [
                this.mouseStartScaled.x, this.mouseStartScaled.y,
                this.mouseEndScaled.x  , this.mouseStartScaled.y,
                this.mouseEndScaled.x  , this.mouseEndScaled.y,
                this.mouseEndScaled.x  , this.mouseEndScaled.y,
                this.mouseStartScaled.x, this.mouseEndScaled.y,
                this.mouseStartScaled.x, this.mouseStartScaled.y,
            ];
        }
    };

    /*
     * Once the user stops the dragging and lets go of the mouse click, zoom to the appropriate coordinates.
     */
    this.stopDrag = function(x, y) {
        if (this.mouseDragging) {
            this.mouseDragging = false;

            var left   = this.mouseStart.x < this.mouseEnd.x ? this.mouseStart.x : this.mouseEnd.x;
            var right  = this.mouseStart.x > this.mouseEnd.x ? this.mouseStart.x : this.mouseEnd.x;
            var top    = this.mouseStart.y > this.mouseEnd.y ? this.mouseStart.y : this.mouseEnd.y;
            var bottom = this.mouseStart.y < this.mouseEnd.y ? this.mouseStart.y : this.mouseEnd.y;

            if (Math.abs(this.mouseStart.x - this.mouseEnd.x) > this.zoomedXmax && Math.abs(this.mouseStart.y - this.mouseEnd.y) > this.zoomedYmax) {
                this.clearFlag = true;
                this.zoomTo(left, right, bottom, top, true);
            }

            return true; //wasn't a blank call
        }
        return false;    //was a blank call
    };

    /*
     * Handle panning of camera on right click. 
     * If user tries to pan outside of the GL canvas bounds, snap to the edge. Hold em back.
     */
    this.panCamera = function(x, y, shift, ctrl) {
        if (this.zoomed) {
            var xadj = (this.currentRight - this.currentLeft) / this.canvasParent.offsetWidth;
            var xoff = this.currentLeft;
            var yadj = (this.currentBottom - this.currentTop) / this.canvasParent.offsetHeight;
            var yoff = this.currentTop;

            if (!this.panDown.inCameraSpace) {
                this.panDown.x = this.panDown.x * xadj + xoff;
                this.panDown.y = this.panDown.y * yadj + yoff;
                this.panDown.inCameraSpace = true;
            }

            x = x * xadj + xoff;
            y = y * yadj + yoff;

            var left, right, top, bottom;

            var ignore = false;
            if(shift && ctrl) ignore = true;
            if(shift && !ignore){
                left   = this.currentLeft   - (x - this.panDown.x);
                right  = this.currentRight  - (x - this.panDown.x);
                top    = this.currentTop;
                bottom = this.currentBottom;
            } else if (ctrl && !ignore){
                left   = this.currentLeft;
                right  = this.currentRight;
                top    = this.currentTop    - (y - this.panDown.y);
                bottom = this.currentBottom - (y - this.panDown.y);
            } else {
                left   = this.currentLeft   - (x - this.panDown.x);
                right  = this.currentRight  - (x - this.panDown.x);
                top    = this.currentTop    - (y - this.panDown.y);
                bottom = this.currentBottom - (y - this.panDown.y);
            }

            var difference = 0;
            if (left < this.unzoomedLeft) {
                difference = Math.abs(left - this.unzoomedLeft);
                left       = this.unzoomedLeft;
                right     += difference;
            }
            if (right > this.unzoomedRight) {
                difference = Math.abs(right - this.unzoomedRight);
                right      = this.unzoomedRight;
                left      -= difference;
            }
            if (top > this.unzoomedTop) {
                difference = Math.abs(top - this.unzoomedTop);
                top        = this.unzoomedTop;
                bottom    -= difference;
            }
            if (bottom < this.unzoomedBottom) {
                difference = Math.abs(bottom - this.unzoomedBottom);
                bottom     = this.unzoomedBottom;
                top       += difference;
            }
            this.mousePanning = true;
            this.zoomTo(left, right, bottom, top, true);
        }
    };

    /*
     * Fancy shmancy google-maps-like mouse zoom. Camera zooms to the user's mouse pointer on the canvas 
     * instead of zooming same amount from all sides. 
     */
    this.zoomWheel = function(x, y, dir) {
        var xadj = (this.currentRight - this.currentLeft) / this.canvasParent.offsetWidth;
        var xoff = this.currentLeft;
        var yadj = (this.currentBottom - this.currentTop) / this.canvasParent.offsetHeight;
        var yoff = this.currentTop;

        x = x * xadj + xoff;
        y = y * yadj + yoff;

        var height = Math.abs(this.currentTop  - this.currentBottom);
        var width  = Math.abs(this.currentLeft - this.currentRight);
        var mid_x  = (width  / 2) + this.currentLeft;
        var mid_y  = (height / 2) + this.currentBottom;

        var x_percentage = ((mid_x - x) / (width / 2)) * -1;
        var y_percentage = ((mid_y - y) / (height / 2));

        if (dir > 0) { //zoom in
            var new_height = Math.abs(this.currentTop  - this.currentBottom) * 0.95;
            var new_width  = Math.abs(this.currentLeft - this.currentRight) * 0.95;
            mid_x          = mid_x + ((width  - new_width) / 2 * x_percentage);
            mid_y          = mid_y - ((height - new_height) / 2 * y_percentage);
            var left       = mid_x - (new_width  / 2);
            var right      = mid_x + (new_width  / 2);
            var top        = mid_y + (new_height / 2);
            var bottom     = mid_y - (new_height / 2);
            if (Math.abs(left - right) > this.zoomedXmax && Math.abs(top - bottom) > this.zoomedYmax)
                this.zoomTo(left, right, bottom, top, true);
            return true;
        } else { //zoom out
            if (this.zoomed) {
                var new_height = Math.abs(this.currentTop  - this.currentBottom) * 1.1;
                var new_width  = Math.abs(this.currentLeft - this.currentRight) * 1.1;
                mid_x          = mid_x + ((width  - new_width)  / 2 * x_percentage);
                mid_y          = mid_y - ((height - new_height) / 2 * y_percentage);
                var left       = mid_x - (new_width  / 2);
                var right      = mid_x + (new_width  / 2);
                var top        = mid_y + (new_height / 2);
                var bottom     = mid_y - (new_height / 2);
                if (left > this.unzoomedLeft && right < this.unzoomedRight && top < this.unzoomedTop && bottom > this.unzoomedBottom)
                    this.zoomTo(left, right, bottom, top, true);
                else
                    this.unzoom();
                return true;
            }
            return false;
        }
    };

    /*
     * Move camera around using the arrow keys.
     * Each move is applied by a factor of horizontal/vertical shift which is defined by the division width in the
     * appropriate direction.
     */
    this.keyAdjustCamera = function(keycode, horizontalShift, verticalShift) {
        if (this.zoomed) {
            var left   = this.currentLeft;
            var right  = this.currentRight;
            var top    = this.currentTop;
            var bottom = this.currentBottom;

            var difference = 0;

            switch (keycode) {
                case 37:
                    if (left == this.unzoomedLeft) return;
                    left  = left  - horizontalShift;
                    right = right - horizontalShift;
                    if (left < this.unzoomedLeft) {
                        difference = Math.abs(left - this.unzoomedLeft);
                        left       = this.unzoomedLeft;
                        right     += difference;
                    }
                    break;
                case 38:
                    if (top == this.unzoomedTop) return;
                    top    = top    + verticalShift;
                    bottom = bottom + verticalShift;
                    if (top > this.unzoomedTop) {
                        difference = Math.abs(top - this.unzoomedTop);
                        top        = this.unzoomedTop;
                        bottom    -= difference;
                    }
                    break;
                case 39:
                    if (right == this.unzoomedRight) return;
                    right = right + horizontalShift;
                    left  = left  + horizontalShift;
                    if (right > this.unzoomedRight) {
                        difference = Math.abs(right - this.unzoomedRight);
                        right      = this.unzoomedRight;
                        left      -= difference;
                    }
                    break;
                case 40:
                    if (bottom == this.unzoomedBotton) return;
                    bottom = bottom - verticalShift;
                    top    = top    - verticalShift;
                    if (bottom < this.unzoomedBottom) {
                        difference = Math.abs(bottom - this.unzoomedBottom);
                        bottom     = this.unzoomedBottom;
                        top       += difference;
                    }
                    break;
                default:
                    console.warn('Unknown keycode in WebGLLines.keyAdjustCamera(keycode).')
            }
            this.zoomTo(left, right, bottom, top, true);
        }
    };

    /*
     * Handles panning of camera in the minimap view. 
     * Changes are made in the gl context, NOT minimapGL context.
     */
    this.minimapMovePosition = function(x, y) {
        if (this.currentLeft   < this.unzoomedLeft  ||
            this.currentRight  > this.unzoomedRight ||
            this.currentTop    > this.unzoomedTop   ||
            this.currentBottom < this.unzoomedBottom) return;
        var xadj = (this.unzoomedRight - this.unzoomedLeft) / this.canvasParent.offsetWidth;
        var xoff = this.unzoomedLeft;
        var yadj = (this.unzoomedBottom - this.unzoomedTop) / this.minimapCanvas.offsetHeight;
        var yoff = this.unzoomedTop;
        if (!this.minimapPanDown.inCameraSpace) {
            this.minimapPanDown.x = this.minimapPanDown.x * xadj + xoff;
            this.minimapPanDown.y = this.minimapPanDown.y * yadj + yoff;
            this.minimapPanDown.inCameraSpace = true;
        }
        x = x < 0 ? 0 : x;
        y = y < 0 ? 0 : y;
        x = x * xadj + xoff;
        y = y * yadj + yoff;

        var height       = Math.abs(this.currentTop - this.currentBottom);
        var width        = Math.abs(this.currentLeft - this.currentRight);
        var horizontal_r = width / 2;
        var vertical_r   = height / 2;

        var left   = x - horizontal_r;
        var right  = x + horizontal_r;
        var top    = y + vertical_r;
        var bottom = y - vertical_r;

        var difference = 0;
        if (left < this.unzoomedLeft) {
            difference = Math.abs(left - this.unzoomedLeft);
            left       = this.unzoomedLeft;
            right     += difference;
        }
        if (right > this.unzoomedRight) {
            difference = Math.abs(right - this.unzoomedRight);
            right      = this.unzoomedRight;
            left      -= difference;
        }
        if (top > this.unzoomedTop) {
            difference = Math.abs(top - this.unzoomedTop);
            top        = this.unzoomedTop;
            bottom    -= difference;
        }
        if (bottom < this.unzoomedBottom) {
            difference = Math.abs(bottom - this.unzoomedBottom);
            bottom     = this.unzoomedBottom;
            top       += difference;
        }
        if (left >= this.unzoomedLeft && right <= this.unzoomedRight && top <= this.unzoomedTop && bottom >= this.unzoomedBottom){
            this.mousePanning = true;
            this.zoomTo(left, right, bottom, top, true);
        }
    };

    /*
     * Unzoom to original coordinates.
     */
    this.unzoom = function() {
        this.clearFlag = true;
        this.zoomTo(this.unzoomedLeft, this.unzoomedRight, this.unzoomedBottom, this.unzoomedTop, false);
    };

    /*
     * Zoom to the passed-in dimensions of the near clipping plane.
     */
    this.zoomTo = function(left, right, bottom, top, zoomed) {
        twgl.m4.ortho(left, right, bottom, top, 1, 10, this.matrix); //let left, right, bottom, top of position matrix
        this.currentTop    = top;
        this.currentBottom = bottom;
        this.currentLeft   = left;
        this.currentRight  = right;
        this.zoomed        = zoomed;
        if (this.minimapEnabled && this.zoomed) {
            this.canvasParent.style.height = '84%';
            this.canvasParent.appendChild(this.minimapCanvas); //if we are zoomed, we add the minimap canvas to see where we are relative to the whole canvas
            this.minimapBoxPositions = [
                left , top,
                right, top,
                right, bottom,
                right, bottom,
                left , bottom,
                left , top,
            ];
        } else if (this.minimapEnabled && !this.zoomed) {
            if (this.canvasParent.style.height != this.unzoomedParentHeight) {
                this.canvasParent.style.height  = this.unzoomedParentHeight;
                this.canvasParent.removeChild(this.minimapCanvas);
            }
        }
    };

    /*
     * Compile shaders into it's appropriate program info.
     * Variables contain the program, attribute/uniform locations & setters.
     */
    this.programInfo            = twgl.createProgramInfo(this.gl, [this.vtxShader, this.fmtShader]);
    this.fadeProgramInfo        = twgl.createProgramInfo(this.gl, [this.vtxQuadShader, this.fmtFadeShader]);
    this.copyProgramInfo        = twgl.createProgramInfo(this.gl, [this.vtxQuadShader, this.fmtCopyShader]);
    this.gridProgramInfo        = twgl.createProgramInfo(this.gl, [this.vtxGridShader, this.fmtGridShader]);
    if(this.minimapEnabled){
      this.minimapFadeProgramInfo = twgl.createProgramInfo(this.minimapGL, [this.vtxQuadShader, this.fmtFadeShader]);
      this.minimapCopyProgramInfo = twgl.createProgramInfo(this.minimapGL, [this.vtxQuadShader, this.fmtCopyShader]);
      this.minimapProgramInfo     = twgl.createProgramInfo(this.minimapGL, [this.vtxShader, this.fmtShader]);
      this.minimapGridProgramInfo = twgl.createProgramInfo(this.minimapGL, [this.vtxGridShader, this.fmtGridShader]);
    }

    /*
     * These positions are required to enable low-level line drawing for flexibility.
     */
    this.wave_position_location            = this.gl.getAttribLocation(this.programInfo.program, 'position');
    this.viewport_location                 = this.gl.getUniformLocation(this.programInfo.program, 'u_viewport');
    this.color_location                    = this.gl.getUniformLocation(this.programInfo.program, 'u_color');
    this.matrix_location                   = this.gl.getUniformLocation(this.programInfo.program, 'u_matrix');
    this.grid_position_location            = this.gl.getAttribLocation(this.gridProgramInfo.program, 'position');
    this.grid_color_position               = this.gl.getUniformLocation(this.gridProgramInfo.program, 'u_color');
    this.grid_lengthsofar_location         = this.gl.getAttribLocation(this.gridProgramInfo.program, 'a_lengthSoFar');
    if(this.minimapEnabled){
      this.minimap_grid_position_location    = this.minimapGL.getAttribLocation(this.minimapGridProgramInfo.program, 'position');
      this.minimap_viewport_location         = this.minimapGL.getUniformLocation(this.minimapProgramInfo.program, 'u_viewport');
      this.minimap_color_location            = this.minimapGL.getUniformLocation(this.minimapProgramInfo.program, 'u_color');
      this.minimap_matrix_location           = this.minimapGL.getUniformLocation(this.minimapProgramInfo.program, 'u_matrix');
      this.minimap_grid_color_position       = this.minimapGL.getUniformLocation(this.minimapGridProgramInfo.program, 'u_color');
      this.minimap_wave_position_location    = this.minimapGL.getAttribLocation(this.minimapProgramInfo.program, 'position');
      this.minimap_grid_lengthsofar_location = this.minimapGL.getAttribLocation(this.minimapGridProgramInfo.program, 'a_lengthSoFar');
    }

    /*
     * Calculating the size for the framebuffers according to the canvas size
     * then setting the lineWidth according to the framebuffer size.
     */
    this.pow = this.nextPowerOfTwo(this.canvas.width) * 2;
    if(this.minimapEnabled) this.minimapGL.lineWidth(Math.ceil(this.pow / 1000));

    /*
     * Initialize the framebuffers using the attachments given above.
     */
    this.fbi_one   = twgl.createFramebufferInfo(this.gl, this.fadeAttachments);
    this.fbi_two   = twgl.createFramebufferInfo(this.gl, this.fadeAttachments);
    this.selection_framebuffer = twgl.createFramebufferInfo(this.gl, this.fadeAttachments);
    this.grid_framebuffer      = twgl.createFramebufferInfo(this.gl, this.fadeAttachments);
    if(this.minimapEnabled){
      this.minimap_fbi_one = twgl.createFramebufferInfo(this.minimapGL, this.minimapFadeAttachments);
      this.minimap_fbi_two = twgl.createFramebufferInfo(this.minimapGL, this.minimapFadeAttachments);
      this.minimap_box_framebuffer       = twgl.createFramebufferInfo(this.minimapGL, this.minimapFadeAttachments);
      this.minimap_selection_framebuffer = twgl.createFramebufferInfo(this.minimapGL, this.minimapFadeAttachments);
    }

    /*
     * this.gl.enableVertexAttribArray() enables us to provide line coordinates to GLSL Shader.
     * We then create the buffers to hold the vertices and indices.
     */
    this.gl.enableVertexAttribArray(this.wave_position_location);
    if(this.minimapEnabled) this.minimapGL.enableVertexAttribArray(this.minimap_wave_position_location);

    this.vertexBuffer         = this.gl.createBuffer();
    this.indicesBuffer        = this.gl.createBuffer();
    if(this.minimapEnabled) {
      this.minimapIndicesBuffer = this.minimapGL.createBuffer();
      this.minimapVertexBuffer  = this.minimapGL.createBuffer();
    }

    this.lineVertices = [];
    this.indicesCount = [];

    this.gl.enableVertexAttribArray(this.grid_position_location);
    if(this.minimapEnabled) this.minimapGL.enableVertexAttribArray(this.minimap_grid_position_location);

    this.majorGridPositions = [];
    this.majorGridPositions.push(-1,  0);
    this.majorGridPositions.push(+1,  0);
    this.majorGridPositions.push( 0, -1);
    this.majorGridPositions.push( 0, +1);

    this.horizontalCursorY         = [0.5, -0.5];
    this.horizontalCursorPositions = [];
    this.horizontalCursorPositions.push(-1, this.horizontalCursorY[0]);
    this.horizontalCursorPositions.push(+1, this.horizontalCursorY[0]);
    this.horizontalCursorPositions.push(-1, this.horizontalCursorY[1]);
    this.horizontalCursorPositions.push(+1, this.horizontalCursorY[1]);

    this.verticalCursorX           = [0.5, -0.5];
    this.verticalCursorPositions   = [];
    this.verticalCursorPositions.push(this.verticalCursorX[0], -1);
    this.verticalCursorPositions.push(this.verticalCursorX[0], +1);
    this.verticalCursorPositions.push(this.verticalCursorX[1], -1);
    this.verticalCursorPositions.push(this.verticalCursorX[1], +1);

    this.gridPositions = [];
    this.dashlen       = 0.01;
    for (var i = -this.numDivs; i <= this.numDivs; i++) {
        for (var j = -1; j <= 1; j += this.dashlen) {
            this.gridPositions.push(j + this.dashlen, i / this.numDivs);
        }
        for (var j = -1; j <= 1; j += this.dashlen) {
            this.gridPositions.push(i / this.numDivs, j);
        }
    }

    this.tickPositions = [];
    for (var i = -this.numDivs; i < this.numDivs; i++) {
        this.tickPositions.push(-1    , i / this.numDivs);
        this.tickPositions.push(-0.975, i / this.numDivs);
        
        this.tickPositions.push(i / this.numDivs, -1);
        this.tickPositions.push(i / this.numDivs, -0.965);
        
        this.tickPositions.push(1    , i / this.numDivs);
        this.tickPositions.push(0.975, i / this.numDivs);
        
        this.tickPositions.push(i / this.numDivs, 1);
        this.tickPositions.push(i / this.numDivs, 0.965);
    }

    this.boundaryPositions = [];
    this.boundaryPositions.push(-1, -0.99875);
    this.boundaryPositions.push(+1, -0.99875);
    this.boundaryPositions.push(-1, +0.99875);
    this.boundaryPositions.push(+1, +0.99875);
    this.boundaryPositions.push(-1, -1);
    this.boundaryPositions.push(-1, +1);
    this.boundaryPositions.push(+1, -1);
    this.boundaryPositions.push(+1, +1);


    /*
     * These functions bind the buffers created above to gl.ARRAY_BUFFER & gl.ELEMENT_ARRAY_BUFFER respectively.
     */
    this.bindVertexBuffer = function(array) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(array), this.gl.STATIC_DRAW);
    };
    this.bindIndicesBuffer = function(array) {
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indicesBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(array), this.gl.STATIC_DRAW);
    };

    this.bindVertexBuffer(this.lineVertices);
    this.bindIndicesBuffer(this.indicesCount);

    /*
     * Variable linesToDraw contains lines of different channels.
     * Variable colors contains different colors used by different channels.
     */
    this.linesToDraw = [];
    this.colors      = [];

    /*
     * Returns the color of waveform given the waveform number.
     */
    this.getColor = function(waveformNumber) {
        return waveformNumber < this.colors.length ? this.colors[waveformNumber] : null;
    }
    this.hexToRgb = function(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16) / 255, /*r*/
            parseInt(result[2], 16) / 255, /*g*/
            parseInt(result[3], 16) / 255, /*b*/
            0.0,                           /*a; leave 0 for now*/
            ] : null;
    };
    /*
     * Initialize colors passed in by controller
     */
    this.backgroundColor     = this.hexToRgb(attrs.backgroundColor);
    this.boundaryColor       = this.hexToRgb(attrs.gridColor);
    this.gridColor           = this.hexToRgb(attrs.gridColor);   
    this.cursorColor         = this.hexToRgb(attrs.cursorColor);
    this.wireframeColor      = this.hexToRgb(attrs.wireframeColor);
    this.fillColor           = this.hexToRgb(attrs.fillColor);
    this.minimapFillColor    = this.hexToRgb(attrs.fillColor);
    this.cursorDistanceColor = this.hexToRgb(attrs.fillColor);

    /*
     * Set alpha values of initialized colors
     */
    this.backgroundColor[3]     = 1.;
    this.boundaryColor[3]       = 1.;
    this.gridColor[3]           = 0.8;   
    this.cursorColor[3]         = 1.;
    this.wireframeColor[3]      = 0.9;
    this.fillColor[3]           = 0.7;
    this.minimapFillColor[3]    = 0.8;
    this.cursorDistanceColor[3] = 0.9;

    /*
     * Quad buffer needed to render textures onto screen.
     */
    this.quadBufferInfo          = twgl.primitives.createXYQuadBufferInfo(this.gl);
    this.quadBufferInfo_2        = twgl.primitives.createXYQuadBufferInfo(this.gl);
    this.quadBufferInfo_3        = twgl.primitives.createXYQuadBufferInfo(this.gl);
    if(this.minimapEnabled){ 
      this.minimapQuadBufferInfo   = twgl.primitives.createXYQuadBufferInfo(this.minimapGL);
      this.minimapQuadBufferInfo_2 = twgl.primitives.createXYQuadBufferInfo(this.minimapGL);
      this.minimapQuadBufferInfo_3 = twgl.primitives.createXYQuadBufferInfo(this.minimapGL);
    }
    /*
     * Orthographic matrix, controllable as Orthographic camera.
     * Three.JS equivalent camera.left   = -1
     * Three.JS equivalent camera.right  =  1
     * Three.JS equivalent camera.top    =  1
     * Three.JS equivalent camera.bottom = -1
     */
    this.matrix          = twgl.m4.ortho(this.unzoomedLeft, this.unzoomedRight, this.unzoomedBottom, this.unzoomedTop, 1, 10);
    if(this.minimapEnabled) 
      this.minimapMatrix = twgl.m4.ortho(this.unzoomedLeft, this.unzoomedRight, this.unzoomedBottom, this.unzoomedTop, 1, 10);

    /*
     * This function is called from the controller to set up number of incoming channels and the linesToDraw variable.
     */
    this.initChannels = function(maxchannels, colors) {
        if (this.linesToDraw.length != maxchannels) {
            for (var i = 0; i < maxchannels; i++) {
                this.linesToDraw.push();
                this.colors.push(colors[i]);
            }
        }
    };

    /*
     * Update the vertices & indices for the next line.
     */
    this.update = function(newPts, waveformNumber, visible) {
        var faces  = [];
        for (var i = 0; i < this.lineVertices.length; i++) faces.push(i);
        this.linesToDraw[waveformNumber] = {
            vertices: newPts,
            indicesCount: faces,
            visible: visible //if visible is false, we will not draw this channel in drawLines()
        }
    };

    /*
     * Intensity of mixing the fade colors.
     * 0: no mix
     * 0 < x < 1: fade effect
     * 1: complete mix
     */
    this.setMixAmount = function(value) {
        this.mixAmt   = value;
    };

    /*
     * The sole purpose of this function is to draw boundaries. I draw boundaries separate (and after) from
     * the grids as grids are drawn behind the lines, but the boundaries must be drawn on top of the lines, 
     * in all four corners.
     */
    this.drawBoundaries = function() {
        this.gl.lineWidth((this.pow / 1000));
        this.gl.useProgram(this.gridProgramInfo.program);
        var color = this.boundaryColor;
        this.bindVertexBuffer(this.boundaryPositions);
        this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.uniform4fv(this.grid_color_position, color);
        this.gl.drawArrays(this.gl.LINES, 0, this.boundaryPositions.length / 2);
    };

    /*
     * Draw grids on the minimap renderer, in our case, only the boundaries.
     */
    this.minimapDrawGrids = function() {
        this.boundaryPositions[8]  = -0.9988;
        this.boundaryPositions[10] = -0.9988;
        this.minimapGL.useProgram(this.minimapGridProgramInfo.program);
        var color = this.boundaryColor;
        this.minimapGL.lineWidth(1);
        this.minimapGL.bindBuffer(this.minimapGL.ARRAY_BUFFER, this.minimapVertexBuffer);
        this.minimapGL.bufferData(this.minimapGL.ARRAY_BUFFER, new Float32Array(this.boundaryPositions), this.minimapGL.STATIC_DRAW);
        this.minimapGL.vertexAttribPointer(this.minimap_grid_position_location, 2, this.minimapGL.FLOAT, false, 0, 0);
        this.minimapGL.uniform4fv(this.minimap_grid_color_position, color);
        this.minimapGL.drawArrays(this.minimapGL.LINES, 0, this.boundaryPositions.length / 2);
        this.boundaryPositions[8]  = -1;
        this.boundaryPositions[10] = -1;
    };

    /*
     * Lines are drawn using raw WebGL for flexibility.
     */
    this.drawLines = function() {
        this.gl.lineWidth(Math.ceil(this.pow / 1000)*1.5);
        this.gl.useProgram(this.programInfo.program);
        for (var i = 0; i < this.linesToDraw.length; i++) {
            if (this.linesToDraw[i].visible) { //draw only if channel visible
                var color         = [this.colors[i].r / 255, this.colors[i].g / 255, this.colors[i].b / 255, 1.0];
                this.lineVertices = this.linesToDraw[i].vertices;
                this.bindVertexBuffer(this.lineVertices);
                this.indicesCount = this.linesToDraw[i].indicesCount;
                this.bindIndicesBuffer(this.indicesCount);
                if (this.linesToDraw[i].indicesCount.length > 0) {
                    this.gl.vertexAttribPointer(this.wave_position_location, 2, this.gl.FLOAT, false, 8 * 2, 0);
                    this.gl.uniform2f(this.viewport_location, this.canvas.width, this.canvas.height);
                    this.gl.uniform4fv(this.color_location, color);
                    this.gl.uniformMatrix4fv(this.matrix_location, false, this.matrix);
                    this.gl.drawElements(this.gl.LINE_STRIP, this.indicesCount.length / 4, this.gl.UNSIGNED_SHORT, 0);
                }
            }
        }
        this.gl.lineWidth((this.pow / 1000));
    };

    /*
     * Grids are drawn on the grid_framebuffer's texture attachment then drawn onto the display buffer.
     * This gets rid of the fade effect we use for lines. (REMOVING gl.clear DRAWS GRIDS ON TOP OF EACH OTHER)
     */
    this.drawGridsOnBuffer = function(){
        this.gl.lineWidth(3/*(this.pow / 1000)*1.45*/);
        twgl.bindFramebufferInfo(this.gl, this.grid_framebuffer);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);    //clears grid_framebuffer, NOT the null buffer (i.e. clears current bound buffer, not necessarily the draw buffer)
        this.gl.useProgram(this.gridProgramInfo.program);
        var color = this.gridColor; //color for minor grid lines
        this.bindVertexBuffer(this.gridPositions);
        this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.uniform4fv(this.grid_color_position, color);
        this.gl.drawArrays(this.gl.LINES, 0, this.gridPositions.length / 2);
        color = this.boundaryColor;
        this.bindVertexBuffer(this.majorGridPositions);
        this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.uniform4fv(this.grid_color_position, color);
        this.gl.drawArrays(this.gl.LINES, 0, this.majorGridPositions.length / 2);
        this.bindVertexBuffer(this.tickPositions);
        this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.uniform4fv(this.grid_color_position, color);
        this.gl.drawArrays(this.gl.LINES, 0, this.tickPositions.length / 2);
        twgl.bindFramebufferInfo(this.gl, null);
        this.gl.useProgram(this.copyProgramInfo.program);
        twgl.setBuffersAndAttributes(this.gl, this.copyProgramInfo, this.quadBufferInfo_3);
        twgl.setUniforms(this.copyProgramInfo, {
            u_texture: this.grid_framebuffer.attachments[0],
        });
        twgl.drawBufferInfo(this.gl, this.gl.TRIANGLES, this.quadBufferInfo_3);
        this.gl.lineWidth((this.pow / 1000));
    };

    /*
     * This function accepts boolean values horizontal and vertical denoting whether or not those cursors are visible.
     * We use the same function to draw either, or both, cursors. 
     */
    this.rainbowColor = [Math.random(), Math.random(), Math.random(), 1.];
    this.rainbowFactor= [0.005, 0.005, 0.005];
    this.drawCursors = function(horizontal, vertical){
        twgl.bindFramebufferInfo(this.gl, this.grid_framebuffer);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);   
        this.gl.useProgram(this.gridProgramInfo.program);
        this.gl.lineWidth(Math.ceil(this.pow / 1000)*1.5);
        
        var color;
        if(this.rainbow_cursors){     // pls don't delete :(
            if(this.rainbowColor[0] >= 1 || this.rainbowColor[0] <= 0) this.rainbowFactor[0] *= -1;
            if(this.rainbowColor[1] >= 1 || this.rainbowColor[1] <= 0) this.rainbowFactor[1] *= -1;
            if(this.rainbowColor[2] >= 1 || this.rainbowColor[2] <= 0) this.rainbowFactor[2] *= -1;

            this.rainbowColor[0] = this.rainbowColor[0] + this.rainbowFactor[0];
            this.rainbowColor[1] = this.rainbowColor[1] + this.rainbowFactor[1];
            this.rainbowColor[2] = this.rainbowColor[2] + this.rainbowFactor[2];

            color = this.rainbowColor;
        } else {
            color = this.cursorColor; //bright, stand-out color
        }
        
        if(horizontal){
            for(var i = 0; i < this.horizontalCursorPositions.length; i++){
                var startIndex = i < this.horizontalCursorPositions.length / 2 ? 0 : 1;
                if(i % 2 != 0){ //odd positions contain the Y values we need to move the cursors up/down
                    this.horizontalCursorPositions[i] = this.horizontalCursorY[startIndex];
                }
            }
            var left_triangle_one = [
                this.horizontalCursorPositions[0], this.horizontalCursorPositions[1] + 0.02,
                this.horizontalCursorPositions[0], this.horizontalCursorPositions[1] - 0.02,
                this.horizontalCursorPositions[0] + 0.02, this.horizontalCursorPositions[1]
            ];
            var left_triangle_two = [
                this.horizontalCursorPositions[4], this.horizontalCursorPositions[5] + 0.02,
                this.horizontalCursorPositions[4], this.horizontalCursorPositions[5] - 0.02,
                this.horizontalCursorPositions[4] + 0.02, this.horizontalCursorPositions[5]
            ];
            var right_triangle_one = [
                this.horizontalCursorPositions[2], this.horizontalCursorPositions[3] + 0.02,
                this.horizontalCursorPositions[2], this.horizontalCursorPositions[3] - 0.02,
                this.horizontalCursorPositions[2] - 0.02, this.horizontalCursorPositions[1]
            ];
            var right_triangle_two = [
                this.horizontalCursorPositions[6], this.horizontalCursorPositions[7] + 0.02,
                this.horizontalCursorPositions[6], this.horizontalCursorPositions[7] - 0.02,
                this.horizontalCursorPositions[6] - 0.02, this.horizontalCursorPositions[7]
            ];

            this.bindVertexBuffer(left_triangle_one);
            this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.uniform4fv(this.grid_color_position, color);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, left_triangle_one.length / 2);

            this.bindVertexBuffer(left_triangle_two);
            this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.uniform4fv(this.grid_color_position, color);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, left_triangle_two.length / 2);

            this.bindVertexBuffer(right_triangle_one);
            this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.uniform4fv(this.grid_color_position, color);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, right_triangle_one.length / 2);

            this.bindVertexBuffer(right_triangle_two);
            this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.uniform4fv(this.grid_color_position, color);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, right_triangle_two.length / 2);

            var distance_line_positions = [];
            distance_line_positions.push(-0.8, this.horizontalCursorY[0]);
            distance_line_positions.push(-0.8, this.horizontalCursorY[1]);
            this.bindVertexBuffer(distance_line_positions);
            this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.uniform4fv(this.grid_color_position, this.cursorDistanceColor);
            this.gl.drawArrays(this.gl.LINES, 0, distance_line_positions.length / 2);
            this.h_cursor_val_pos = (this.horizontalCursorY[0] - 0.05 - this.unzoomedTop) / ((this.unzoomedBottom - this.unzoomedTop) / this.canvasParent.offsetHeight);
            this.h_cursor_x       = (-0.78 - this.unzoomedLeft) / ((this.unzoomedRight - this.unzoomedLeft) / this.canvasParent.offsetWidth);

            var distance_line_triangle_left = [
                -0.8        , this.horizontalCursorY[0],
                -0.8 + 0.015, this.horizontalCursorY[0] - 0.02,
                -0.8 - 0.015, this.horizontalCursorY[0] - 0.02,
            ];

            var distance_line_triangle_right = [
                -0.8        , this.horizontalCursorY[1],
                -0.8 + 0.015, this.horizontalCursorY[1] + 0.02,
                -0.8 - 0.015, this.horizontalCursorY[1] + 0.02,
            ];
            
            this.bindVertexBuffer(distance_line_triangle_left);
            this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.uniform4fv(this.grid_color_position, this.cursorDistanceColor);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, distance_line_triangle_left.length / 2);

            this.bindVertexBuffer(distance_line_triangle_right);
            this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.uniform4fv(this.grid_color_position, this.cursorDistanceColor);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, distance_line_triangle_right.length / 2);

            this.bindVertexBuffer(this.horizontalCursorPositions);
            this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.uniform4fv(this.grid_color_position, color);
            this.gl.drawArrays(this.gl.LINES, 0, this.horizontalCursorPositions.length / 2);
        }
        if(vertical){
            for(var i = 0; i < this.verticalCursorPositions.length; i++){
                var startIndex = i < this.verticalCursorPositions.length / 2 ? 0 : 1;
                if(i % 2 == 0){ //even positions contain the X values we need to move the cursors left/right
                    this.verticalCursorPositions[i] = this.verticalCursorX[startIndex];
                }
            }

            var left_triangle_one = [
                this.verticalCursorPositions[0] + 0.015, this.verticalCursorPositions[1],
                this.verticalCursorPositions[0] - 0.015, this.verticalCursorPositions[1],
                this.verticalCursorPositions[0], this.verticalCursorPositions[1] + 0.03
            ];
            var left_triangle_two = [
                this.verticalCursorPositions[4] + 0.015, this.verticalCursorPositions[5],
                this.verticalCursorPositions[4] - 0.015, this.verticalCursorPositions[5],
                this.verticalCursorPositions[4], this.verticalCursorPositions[5] + 0.03
            ];
            var right_triangle_one = [
                this.verticalCursorPositions[2] + 0.015, this.verticalCursorPositions[3],
                this.verticalCursorPositions[2] - 0.015, this.verticalCursorPositions[3],
                this.verticalCursorPositions[2], this.verticalCursorPositions[3] - 0.03
            ];
            var right_triangle_two = [
                this.verticalCursorPositions[6] + 0.015, this.verticalCursorPositions[7],
                this.verticalCursorPositions[6] - 0.015, this.verticalCursorPositions[7],
                this.verticalCursorPositions[6], this.verticalCursorPositions[7] - 0.03
            ];
            
            this.bindVertexBuffer(left_triangle_one);
            this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.uniform4fv(this.grid_color_position, color);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, left_triangle_one.length / 2);

            this.bindVertexBuffer(left_triangle_two);
            this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.uniform4fv(this.grid_color_position, color);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, left_triangle_two.length / 2);

            this.bindVertexBuffer(right_triangle_one);
            this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.uniform4fv(this.grid_color_position, color);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, right_triangle_one.length / 2);

            this.bindVertexBuffer(right_triangle_two);
            this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.uniform4fv(this.grid_color_position, color);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, right_triangle_two.length / 2);

            var distance_line_positions = [];
            distance_line_positions.push(this.verticalCursorX[0], -0.8);
            distance_line_positions.push(this.verticalCursorX[1], -0.8);
            this.bindVertexBuffer(distance_line_positions);
            this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.uniform4fv(this.grid_color_position, this.cursorDistanceColor);
            this.gl.drawArrays(this.gl.LINES, 0, distance_line_positions.length / 2);
            this.v_cursor_val_pos = (this.verticalCursorX[1] + 0.05 - this.unzoomedLeft) / ((this.unzoomedRight - this.unzoomedLeft) / this.canvasParent.offsetWidth);
            this.v_cursor_y       = (-0.75 - this.unzoomedTop) / ((this.unzoomedBottom - this.unzoomedTop) / this.canvasParent.offsetHeight);

            var distance_line_triangle_left = [
                this.verticalCursorX[1]        , -0.8,
                this.verticalCursorX[1] + 0.015, -0.8 + 0.02,
                this.verticalCursorX[1] + 0.015, -0.8 - 0.02,
            ];

            var distance_line_triangle_right = [
                this.verticalCursorX[0]        , -0.8,
                this.verticalCursorX[0] - 0.015, -0.8 + 0.02,
                this.verticalCursorX[0] - 0.015, -0.8 - 0.02,
            ];

            this.bindVertexBuffer(distance_line_triangle_left);
            this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.uniform4fv(this.grid_color_position, this.cursorDistanceColor);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, distance_line_triangle_left.length / 2);

            this.bindVertexBuffer(distance_line_triangle_right);
            this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.uniform4fv(this.grid_color_position, this.cursorDistanceColor);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, distance_line_triangle_right.length / 2);

            this.bindVertexBuffer(this.verticalCursorPositions);
            this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.uniform4fv(this.grid_color_position, color);
            this.gl.drawArrays(this.gl.LINES, 0, this.verticalCursorPositions.length / 2);
        }
        if(this.fillCursors && horizontal && vertical){
            var enclosed_positions = [
                this.verticalCursorX[0], this.horizontalCursorY[0],
                this.verticalCursorX[1], this.horizontalCursorY[0],
                this.verticalCursorX[1], this.horizontalCursorY[1],
                this.verticalCursorX[1], this.horizontalCursorY[1],
                this.verticalCursorX[0], this.horizontalCursorY[1],
                this.verticalCursorX[0], this.horizontalCursorY[0],
            ];
            this.gl.useProgram(this.gridProgramInfo.program);
            this.bindVertexBuffer(enclosed_positions);
            color = this.fillColor;
            this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.uniform4fv(this.grid_color_position, color);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, enclosed_positions.length / 2);
        }

        twgl.bindFramebufferInfo(this.gl, null);
        this.gl.useProgram(this.copyProgramInfo.program);
        twgl.setBuffersAndAttributes(this.gl, this.copyProgramInfo, this.quadBufferInfo_3);
        twgl.setUniforms(this.copyProgramInfo, {
            u_texture: this.grid_framebuffer.attachments[0],
        });
        twgl.drawBufferInfo(this.gl, this.gl.TRIANGLES, this.quadBufferInfo_3);
        this.gl.lineWidth((this.pow / 1000));
    };

    /*
     * Calculate and display the correct cursor values. 
     */
    this.displayCursorValues = function(horizontal, vertical){
        if(horizontal){
            var unscaledY1 = this.horizontalCursorY[0];
            var unscaledY2 = this.horizontalCursorY[1];
            var a = this.scaleBetween(unscaledY1, this.scaleBetween(this.currentBottom, -1000, 1000, -1, 1), this.scaleBetween(this.currentTop, -1000, 1000, -1, 1), -1, +1);
            var b = this.scaleBetween(unscaledY2, this.scaleBetween(this.currentBottom, -1000, 1000, -1, 1), this.scaleBetween(this.currentTop, -1000, 1000, -1, 1), -1, +1) * -1;
            this.horizontal_cursor_sum = Math.abs(a + b);
            //this.horizontal_cursor_elem.innerHTML = this.horizontal_cursor_sum.toFixed(2);
        }   
        if(vertical){
            var unscaledX1 = this.verticalCursorX[0];
            var unscaledX2 = this.verticalCursorX[1];
            var a = this.scaleBetween(unscaledX1, this.scaleBetween(this.currentLeft, 0, this.max_time, -1, 1), this.scaleBetween(this.currentRight, 0, this.max_time, -1, 1), -1, +1);
            var b = this.scaleBetween(unscaledX2, this.scaleBetween(this.currentLeft, 0, this.max_time, -1, 1), this.scaleBetween(this.currentRight, 0, this.max_time, -1, 1), -1, +1) * -1;
            this.vertical_cursor_sum = Math.abs(a + b);
            //this.vertical_cursor_elem.innerHTML = this.vertical_cursor_sum.toFixed(2);
        }
    };

    /*
     * Used to return the cursor values back to the controller
     */
    this.getHorizontalCursorValue = function() { return this.horizontal_cursor_sum.toFixed(2); };
    this.getVerticalCursorValue   = function() { return this.vertical_cursor_sum.toFixed(2);   };

    /*
     * Mouse selection box is drawn on the selection_framebuffer's texture attachment then drawn onto the display buffer.
     * This gets rid of the fade effect we use for lines. (MUST CLEAR COLOR_BUFFER_BIT AFTER BINDING selection_framebuffer)
     */
    this.drawSelectionBox = function(){
        this.gl.lineWidth(Math.ceil(this.pow / 1000)*1.5);
        twgl.bindFramebufferInfo(this.gl, this.selection_framebuffer);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);    //clears selection_framebuffer, NOT the null buffer (i.e. clears currently bound buffer, not necessarily the draw buffer)
        this.gl.useProgram(this.gridProgramInfo.program);
        this.bindVertexBuffer(this.drawPositions);
        var color = this.fillColor;
        this.gl.vertexAttribPointer(this.grid_position_location, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.uniform4fv(this.grid_color_position, color);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.drawPositions.length / 2);
        color     = this.wireframeColor;
        this.gl.uniform4fv(this.grid_color_position, color);
        this.gl.drawArrays(this.gl.LINE_LOOP, 0, this.drawPositions.length / 2);
        twgl.bindFramebufferInfo(this.gl, null);
        this.gl.useProgram(this.copyProgramInfo.program);
        twgl.setBuffersAndAttributes(this.gl, this.copyProgramInfo, this.quadBufferInfo_2);
        twgl.setUniforms(this.copyProgramInfo, {
            u_texture: this.selection_framebuffer.attachments[0],
        });
        twgl.drawBufferInfo(this.gl, this.gl.TRIANGLES, this.quadBufferInfo_2);
        this.gl.lineWidth(Math.ceil(this.pow / 1000)*1);
    };

    /*
     * Used to clear each buffer after zooming in or out to get rid of 
     * the confusing trail effect.
     * WARNING: please be careful when calling this function without passing an argument. The placement matters.
     *          This function, when done, will have the null (draw) buffer binded.
     *          You can choose to pass in the last buffer that was bound and set it to the same
     *          buffer when returning.
     */
    this.blackout = function(previousBuffer) {
        twgl.bindFramebufferInfo(this.gl, this.fbi_two);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        twgl.bindFramebufferInfo(this.gl, this.fbi_one);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        twgl.bindFramebufferInfo(this.gl, null);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        if(previousBuffer)
            twgl.bindFramebufferInfo(this.gl, previousBuffer);
    };

    if(this.minimapEnabled){
        this.minimapGL.clearColor(this.backgroundColor.r, this.backgroundColor.g, this.backgroundColor.b, 0.0);
        this.minimapGL.enable(this.minimapGL.BLEND);
        this.minimapGL.blendFunc(this.minimapGL.SRC_ALPHA, this.minimapGL.ONE_MINUS_SRC_ALPHA);
    }

    /*
     * Draw everything on the minimap display, if enabled.
     */
    this.drawMinimap = function(){

        twgl.bindFramebufferInfo(this.minimapGL, this.minimap_fbi_two);
        this.minimapGL.useProgram(this.minimapFadeProgramInfo.program);
        twgl.setBuffersAndAttributes(this.minimapGL, this.minimapFadeProgramInfo, this.minimapQuadBufferInfo);
        twgl.setUniforms(this.minimapFadeProgramInfo, {
            u_texture:   this.minimap_fbi_one.attachments[0],
            u_mixAmount: this.mixAmt,
            u_fadeColor: [this.backgroundColor.r, this.backgroundColor.g, this.backgroundColor.b, 0],
        });
        twgl.drawBufferInfo(this.minimapGL, this.minimapGL.TRIANGLES, this.minimapQuadBufferInfo);
        twgl.bindFramebufferInfo(this.minimapGL, this.minimap_fbi_two);

        this.minimapDrawGrids();
        this.minimapDrawLines();

        twgl.bindFramebufferInfo(this.minimapGL, null);
        this.minimapGL.useProgram(this.minimapCopyProgramInfo.program);
        twgl.setBuffersAndAttributes(this.minimapGL, this.minimapCopyProgramInfo, this.minimapQuadBufferInfo);
        twgl.setUniforms(this.minimapCopyProgramInfo, {
            u_texture: this.minimap_fbi_two.attachments[0],
        });

        twgl.drawBufferInfo(this.minimapGL, this.minimapGL.TRIANGLES, this.minimapQuadBufferInfo);

        var temp             = this.minimap_fbi_one;
        this.minimap_fbi_one = this.minimap_fbi_two;
        this.minimap_fbi_two = temp;

        if(this.mouseDragging) this.minimapDrawMouseSelection();
        this.minimapDrawBox();

    };

    this.minimapDrawBox = function() {
        twgl.bindFramebufferInfo(this.minimapGL, this.minimap_box_framebuffer);
        this.minimapGL.clear(this.minimapGL.COLOR_BUFFER_BIT);
        this.minimapGL.useProgram(this.minimapGridProgramInfo.program);
        this.minimapGL.bindBuffer(this.minimapGL.ARRAY_BUFFER, this.minimapVertexBuffer);
        this.minimapGL.bufferData(this.minimapGL.ARRAY_BUFFER, new Float32Array(this.backgroundBox), this.minimapGL.STATIC_DRAW);
        var color = this.minimapFillColor;
        this.minimapGL.vertexAttribPointer(this.minimap_grid_position_location, 2, this.minimapGL.FLOAT, false, 0, 0);
        this.minimapGL.uniform4fv(this.minimap_grid_color_position, color);
        this.minimapGL.drawArrays(this.minimapGL.TRIANGLES, 0, this.backgroundBox.length / 2);
        this.minimapGL.useProgram(this.minimapGridProgramInfo.program);
        this.minimapGL.bindBuffer(this.minimapGL.ARRAY_BUFFER, this.minimapVertexBuffer);
        this.minimapGL.bufferData(this.minimapGL.ARRAY_BUFFER, new Float32Array(this.minimapBoxPositions), this.minimapGL.STATIC_DRAW);
        this.minimapGL.blendFunc(this.minimapGL.ZERO, this.minimapGL.ZERO);
        color = [0., 0., 0., 0.]; //color doesn't matter because of the line above. We use zero pixels from source color and destination color, resulting in transparency 
        this.minimapGL.vertexAttribPointer(this.minimap_grid_position_location, 2, this.minimapGL.FLOAT, false, 0, 0);
        this.minimapGL.uniform4fv(this.minimap_grid_color_position, color);
        this.minimapGL.drawArrays(this.minimapGL.TRIANGLES, 0, this.minimapBoxPositions.length / 2);
        this.minimapGL.blendFunc(this.minimapGL.SRC_ALPHA, this.minimapGL.ONE_MINUS_SRC_ALPHA);
        twgl.bindFramebufferInfo(this.minimapGL, null);
        this.minimapGL.useProgram(this.minimapCopyProgramInfo.program);
        twgl.setBuffersAndAttributes(this.minimapGL, this.minimapCopyProgramInfo, this.minimapQuadBufferInfo_2);
        twgl.setUniforms(this.minimapCopyProgramInfo, {
            u_texture: this.minimap_box_framebuffer.attachments[0],
        });
        twgl.drawBufferInfo(this.minimapGL, this.minimapGL.TRIANGLES, this.minimapQuadBufferInfo_2);
    };

    this.minimapDrawLines = function(scale) {
        this.minimapGL.lineWidth(1);
        this.minimapGL.useProgram(this.minimapProgramInfo.program);
        for (var i = 0; i < this.linesToDraw.length; i++) {
            if (this.linesToDraw[i].visible) {
                var color = [this.colors[i].r / 255, this.colors[i].g / 255, this.colors[i].b / 255, 1.];
                this.lineVertices = this.linesToDraw[i].vertices;
                this.minimapGL.bindBuffer(this.minimapGL.ARRAY_BUFFER, this.minimapVertexBuffer);
                this.minimapGL.bufferData(this.minimapGL.ARRAY_BUFFER, new Float32Array(this.lineVertices), this.gl.STATIC_DRAW);
                this.indicesCount = this.linesToDraw[i].indicesCount;
                this.minimapGL.bindBuffer(this.minimapGL.ELEMENT_ARRAY_BUFFER, this.minimapIndicesBuffer);
                this.minimapGL.bufferData(this.minimapGL.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.indicesCount), this.gl.STATIC_DRAW);
                if (this.linesToDraw[i].indicesCount.length > 0) {
                    this.minimapGL.vertexAttribPointer(this.minimap_wave_position_location, 2, this.minimapGL.FLOAT, false, 8 * 2, 0);
                    this.minimapGL.uniform2f(this.minimap_viewport_location, this.canvas.width, this.canvas.height);
                    this.minimapGL.uniform4fv(this.minimap_color_location, color);
                    this.minimapGL.uniformMatrix4fv(this.minimap_matrix_location, false, this.minimapMatrix);
                    this.minimapGL.drawElements(this.minimapGL.LINE_STRIP, this.indicesCount.length / 4, this.minimapGL.UNSIGNED_SHORT, 0);
                }
            }
        }
    };

    this.minimapDrawMouseSelection = function(){
        twgl.bindFramebufferInfo(this.minimapGL, this.minimap_selection_framebuffer);
        this.minimapGL.clear(this.minimapGL.COLOR_BUFFER_BIT);
        this.minimapGL.useProgram(this.minimapGridProgramInfo.program);
        this.minimapGL.bindBuffer(this.minimapGL.ARRAY_BUFFER, this.minimapVertexBuffer);
        this.minimapGL.bufferData(this.minimapGL.ARRAY_BUFFER, new Float32Array(this.selectPositions), this.minimapGL.STATIC_DRAW);
        var color = this.fillColor;
        this.minimapGL.vertexAttribPointer(this.minimap_grid_position_location, 2, this.minimapGL.FLOAT, false, 0, 0);
        this.minimapGL.uniform4fv(this.minimap_grid_color_position, color);
        this.minimapGL.drawArrays(this.minimapGL.TRIANGLES, 0, this.selectPositions.length / 2);
        var color = this.wireframeColor;
        this.minimapGL.uniform4fv(this.minimap_grid_color_position, color);
        this.minimapGL.drawArrays(this.minimapGL.LINE_LOOP, 0, this.selectPositions.length / 2);
        twgl.bindFramebufferInfo(this.minimapGL, null);
        this.minimapGL.useProgram(this.minimapCopyProgramInfo.program);
        twgl.setBuffersAndAttributes(this.minimapGL, this.minimapCopyProgramInfo, this.minimapQuadBufferInfo_3);
        twgl.setUniforms(this.minimapCopyProgramInfo, {
            u_texture: this.minimap_selection_framebuffer.attachments[0],
        });
        twgl.drawBufferInfo(this.minimapGL, this.minimapGL.TRIANGLES, this.minimapQuadBufferInfo_3);
    };

    this.isZoomed = function() {
        return this.zoomed;
    };

    this.maxX = function() {
        return this.zoomed ? Math.abs(this.currentLeft - this.currentRight) : this.unzoomedRight - this.unzoomedLeft;
    };

    this.maxY = function() {
        return this.zoomed ? Math.abs(this.currentTop - this.currentBottom) : this.unzoomedTop - this.unzoomedBottom;
    };

    /*
     * Mainly used to scale unscaledNum between current coordinates and unzoomed coordinates
     */ 
    this.scaleBetween = function(unscaledNum, minAllowed, maxAllowed, min, max) {
        return (maxAllowed - minAllowed) * (unscaledNum - min) / (max - min) + minAllowed;
    }

    /*
     * Resize canvas if size changes.
     * Super Sampling Antialiasing handled here through changes in variable overdraw.
     */
    this.devicePixelRatio = window.devicePixelRatio || 1;
    this.overdraw         = 1;  //over draw by this factor. The higher this goes, the more performance is negatively affected. Can safely put it down to 1 if antialiasing is implemented.
    this.canvasscale      = this.devicePixelRatio * this.overdraw;
    this.resize = function() {
        var canvasHeight, canvasWidth;
        canvasWidth         = this.canvas.offsetWidth || 2;
        canvasHeight        = this.canvas.offsetHeight || 2;
        minimapCanvasWidth  = this.minimapCanvas.offsetWidth || 2;
        minimapCanvasHeight = this.minimapCanvas.offsetHeight || 2;
        var temp            = this.pow;
        this.pow            = this.nextPowerOfTwo(this.canvas.offsetWidth) * 2;
        this.pow            = this.pow > 2048 ? 2048 : this.pow; //going higher than this has no aesthetic benefits
        if (this.pow != temp) {
            twgl.resizeFramebufferInfo(this.gl, this.fbi_two, this.fadeAttachments, this.pow, this.pow);
            twgl.resizeFramebufferInfo(this.gl, this.fbi_one, this.fadeAttachments, this.pow, this.pow);
            if (this.minimapEnabled) {
                twgl.resizeFramebufferInfo(this.minimapGL, this.minimap_fbi_two, this.minimapFadeAttachments, 0, 0);
                twgl.resizeFramebufferInfo(this.minimapGL, this.minimap_fbi_one, this.minimapFadeAttachments, 0, 0);
                twgl.resizeFramebufferInfo(this.minimapGL, this.minimap_box_framebuffer, this.minimapFadeAttachments, 0, 0);
                twgl.resizeFramebufferInfo(this.minimapGL, this.minimap_selection_framebuffer, this.minimapFadeAttachments, 0, 0);
            }
            twgl.resizeFramebufferInfo(this.gl, this.selection_framebuffer, this.fadeAttachments, this.pow, this.pow);
            twgl.resizeFramebufferInfo(this.gl, this.grid_framebuffer , this.fadeAttachments, this.pow, this.pow);
            this.gl.lineWidth((this.pow / 1000));
            this.blackout();
            if(this.minimapEnabled) this.minimapGL.lineWidth(1);
        }
        if (this.canvas.width !== canvasWidth || this.canvas.height !== canvasHeight) {
            this.gl.viewport(0, 0, canvasWidth, canvasHeight);
            this.canvas.width        = canvasWidth  * this.canvasscale;
            this.canvas.height       = canvasHeight * this.canvasscale;
            this.canvas.style.width  = canvasWidth  + 'px';
            this.canvas.style.height = canvasHeight + 'px';
        }
        if (this.minimapEnabled && this.zoomed) {
            this.minimapGL.viewport(0, 0, minimapCanvasWidth, minimapCanvasHeight);
            this.minimapCanvas.height = window.innerHeight - (this.canvasParent.offsetHeight) - 30;
            this.minimapCanvas.width  = minimapCanvasWidth;
        }
    };

    /*
     * If you enable both DEPTH_TEST & BLEND at once, things disappear.
     */
    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendEquation(this.gl.FUNC_ADD);
    /*
     * Called by the controller.
     * We fade by copying from this.fbi_one into this.fbi_two using this.mixAmt.
     * this.fbi_two will contain mix(this.fbi_one.texture, u_fadeColor, u_mixAmount).
     * NOTE: no calls to gl.clear() made.
     */
    this.draw = function(scale) {
        this.resize();

        if(this.mousePanning){ this.mixAmt = 0.1; this.mousePanning = false; }

        this.drawGridsOnBuffer();

        /*
         * We will first bind a framebuffer, and draw the lines on it's texture attachment.
         */
        twgl.bindFramebufferInfo(this.gl, this.fbi_two);
        this.gl.useProgram(this.fadeProgramInfo.program);
        twgl.setBuffersAndAttributes(this.gl, this.fadeProgramInfo, this.quadBufferInfo);
        twgl.setUniforms(this.fadeProgramInfo, {
            u_texture:   this.fbi_one.attachments[0],
            u_mixAmount: this.mixAmt,
            u_fadeColor: this.fadeColor,
        });
        twgl.drawBufferInfo(this.gl, this.gl.TRIANGLES, this.quadBufferInfo);
        twgl.bindFramebufferInfo(this.gl, this.fbi_two);

        this.gl.blendFunc(this.gl.ONE, this.gl.ONE);                       //enable additive blending!!!
        this.drawLines();                                                  //draw lines!!!
        this.gl.blendFunc(this.gl.SRC_COLOR, this.gl.ONE_MINUS_SRC_ALPHA);           //end additive blending!!!
        this.drawBoundaries();
        if (this.clearFlag) {
            this.blackout();
            this.clearFlag = false;
        }
        
        /*
         * Copy this.fbi_two's texture contents to the canvas
         */
        twgl.bindFramebufferInfo(this.gl, null);
        this.gl.useProgram(this.copyProgramInfo.program);
        twgl.setBuffersAndAttributes(this.gl, this.copyProgramInfo, this.quadBufferInfo);
        twgl.setUniforms(this.copyProgramInfo, {
            u_texture: this.fbi_two.attachments[0],
        });
        twgl.drawBufferInfo(this.gl, this.gl.TRIANGLES, this.quadBufferInfo);
        
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        /*
         * Swap framebuffers so we render to the opposite textures next iteration
         */
        var temp     = this.fbi_one;
        this.fbi_one = this.fbi_two;
        this.fbi_two = temp;

        /*
         * Handle additional events below
         */

        if (this.minimapEnabled && this.zoomed)
            this.drawMinimap();

        if(this.horizontal_cursor || this.vertical_cursor){
            this.drawCursors(this.horizontal_cursor, this.vertical_cursor);
            this.displayCursorValues(this.horizontal_cursor, this.vertical_cursor);
        }
        
        if (this.mouseDragging) 
            this.drawSelectionBox();
    };

};