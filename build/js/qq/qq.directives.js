// qq directive 
angular
	.module('qqModule')
	.directive('qqChannel', qqChannelDirective);
	
qqChannelDirective.$inject = [ 'qqService' ];
	
function qqChannelDirective($qqService) {
	return {
		scope: {
			url: '@',
			dstID: '@',
			dstEP: '@',
			channel: '@',
		},
		link: function(scope, elem, attrs) {
			scope.name = $qqService.GetChannelInfo(scope.url, scope.dstID, scope.dstEP, scope.channel);
		},
		restrict: 'E',
		template: 'Testers: {{name}} End Test'		
	};	
}


/*
(function() {
	'use strict';

angular
	.module('grif16App')
	.directive('qqChannel', qqChannel)
	.directive('qqNode', qqNode);	

// ----------
// qq-channel
// ----------

function qqChannel() {
	return {
		scope: {
			channel: '=data',
		},
		restrict: 'E',
		template: '<div>{{channel.id}} : {{channel.name}}</div>',
	};
}

function qqNode() {
	return {
		scope: {
			node: '=data'
		},
		restrict: 'E',
		template: '<div>{{node.id}} : {{node.name}}</div>'		
	};
}

})();
*/