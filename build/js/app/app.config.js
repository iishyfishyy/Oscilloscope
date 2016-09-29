'use strict';
	
angular
	.module('griffinApp')
	.config(configure);

configure.$inject = ['$compileProvider','$mdThemingProvider'];
	
function configure($compileProvider, $mdThemingProvider) {
	$compileProvider
		.debugInfoEnabled(true);
	
	$mdThemingProvider.theme('default')
		.primaryPalette('blue')
		.accentPalette('orange')
		.warnPalette('red');
			
	$mdThemingProvider.theme('default')
		.backgroundPalette('grey',{
			'default':'900',
		});

	$mdThemingProvider.theme('default').dark();		
}

