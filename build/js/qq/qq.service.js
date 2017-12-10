/**
 * 
 */

// qq services 

angular
	.module('qqModule')
	.service('qqService', qqService)
	
qqService.$inject = [ '$http' ];

var REQUEST_TYPE_GET_ATTRIB_INFO = 1;
var REQUEST_TYPE_GET_CHANNEL_INFO = 1;

function qqService($http) {
	var sv = this;
	
	var client_list = {};
	var dev_list = {};
	
	this.GetDeviceInfo = function(client, dstID) { 
		var promises = [];
		
		// Populate the Channels if necessary
		return sv.GetEndpoints(url, dstID).then(				
			function(data) {
				angular.forEach(data, function(endpoint) {
					promises.push( sv.GetEndpointInfo(url, dstID, endpoint.id, 0) );					
				});
				
				return $q.all(promises).then( function(data) { 
					return sv.client_list[url];
				});
			}
		);		
	}
	
	sv.GetChannelInfo = function(client, dstID, endpoint, channel) {
		// Populate the Channels if necessary
		return sv.GetChannelInfo(url).then(				
			function(data) {
				sv.client_list[client].endpoint[endpoint].channel[channel] = sv.client_list[client].endpoint[endpoint].channel[channel] || $http.get(client + 
						'/qq?reqt=' + REQUEST_TYPE_GET_CHANNEL_INFO + '&dst=' + dstID + '&ep=' + endpoint + '&ch=' + channel).then(
					function(xhr) {
						return xhr.data;
					}
				);
				return sv.client_list[client].endpoint[endpoint].channel[channel];
			}
		);	
	};	
	
	this.GetParameterInfo = function(client, device, endpoint, key) {
		return key;
	}
	
	this.GetParameterValue = function() {
		
	}
}
/*
(function() {
	'use strict';

	angular
		.module('grif16App')
		.service('qq', QQService);

QQService.$inject = ['$http', '$q'];
	
function QQService($http, $q) {
	var sv = this;	
	
	sv.server_list = {};
	sv.channels = {};
	
	sv.getAll = function(url) {
		var promises = [];
		
		// Populate the Channels if necessary
		return sv.getChannels(url).then(				
			function(data) {
				angular.forEach(data, function(channel) {
					promises.push( sv.getNodes(url, channel.key, 0) );					
				});
				
				return $q.all(promises).then( function(data) { 
					return sv.channels[url];
				});
			}
		);	
	};
	
	sv.getChannels = function(url) {
		// Grab the request from the server and cache it!
		sv.server_list[url] = sv.server_list[url] || $http.get(url + '/GetChannels').then( 
			function(xhr) {		
				sv.server_list[url].node = {};
				sv.channels[url] = xhr.data;
				angular.forEach(sv.channels[url], function(channel) {
					channel.node = {};						
				});
				
				return sv.channels[url];
			}); 
		return sv.server_list[url];
	};

	sv.getChannelInfo = function(url, channel) {
		return sv.getChannels(url).then( 
			function(data) {
				// data = sv.channels[url] !
				return data[channel];
			}
		);
	};
	
	sv.getNodes = function(url, channel, group) {
		// Populate the Channels if necessary
		return sv.getChannels(url).then(				
			function(data) {
				sv.server_list[url].node[channel] = sv.server_list[url].node[channel] || $http.get(url + '/GetChannelNodes?channel=' + channel + '&group=' + group).then(
					function(xhr) {
						sv.channels[url][channel].nodes = xhr.data;
						return sv.channels[url][channel].nodes;
					}
				);
				return sv.server_list[url].node[channel];
			}
		);	
	};

	sv.getNodeInfo = function(url, channel, group, node) {
		// Populate the Channels if necessary
		return sv.getNodes(url, channel, group).then(				
			function(data) {
				return data[node];
			}
		);		
	};	
}

})();
*/