module.exports = function(grunt) {
	
  grunt.initConfig({
  clean: ['dist/'],
    browserify: {
      'dist/js/bundle.js': ['build/js/bundle.js']
    },
	
	uglify: {
		'dist/js/bundle.min.js': ['dist/js/bundle.js']
	},
	
	watch: {
	  configFiles: {
		 files: [ 'Gruntfile.js', 'build/css/*.css', 'build/js/*.js','build/lib/*.js', 'build/js/app/*.js', 'build/static/*.html'],
		 tasks: 'build',
		 options: {
			//reload: true,
			livereload: true
		 }
	  }
	},	 
    copy: {
		html: {
			expand: true, 
			cwd: 'build/static/', 
			src: ['**'], 
			dest: 'dist/', 
			filter: 'isFile'
		},
		js: {
			expand: true, 
			cwd: 'build/js/lib', 
			src: ['**'], 
			dest: 'dist/js/lib', 
			filter: 'isFile'			
		},
		css: {
			expand: true, 
			cwd: 'node_modules/angular-material', 
			src: ['angular-material.min.css'], 
			dest: 'dist/css', 
			filter: 'isFile'			
		}
    },
	connect: {
		server: {
			options: {
				debug: true,
				port: 8085,
				base: 'dist',
				onCreateServer: function(server, connect, options) {
					var io = require('socket.io').listen(server);
					var dgram = require('dgram');

					//Initialize a UDP server to listen for json payloads on port 50005
					var srv = dgram.createSocket("udp4");
					srv.on("message", function (msg, rinfo) {
					  //console.log("server got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
					  io.sockets.emit('udp_message', { 'message': msg });
					});

					srv.on("listening", function () {
					  var address = srv.address();
					  console.log("server listening " + address.address + ":" + address.port);
					});

					srv.on('error', function (err) {
					  console.error(err);
					  process.exit(0);
					});
					
					srv.bind(50005);

					io.sockets.on('connection', function (socket) {
					  socket.emit('message', 'connected');
						socket.on('udp_response', function (data) {
							 var address = srv.address();
							 var client = dgram.createSocket("udp4");
							 var message = new Buffer(data);
							 client.send(message, 0, message.length, address.port, address.address, function(err, bytes) {
								client.close();
							 });
						  });
						});
					

					
				}				
			}
		}
	}	 
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-browserify');

  grunt.registerTask('build', ['clean', 'browserify', /*'uglify',*/ 'copy' ]);
  grunt.registerTask('default', ['build', 'connect',  'watch']);
};
