"use strict";
var _setupTrackingContext = _interopRequireDefault(require("./lib/setupTrackingContext"));
var _setupWatchingContext = _interopRequireDefault(require("./lib/setupWatchingContext"));
var _processTailwindFeatures = _interopRequireDefault(require("./processTailwindFeatures"));
var _sharedState = require("./lib/sharedState");
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
module.exports = function tailwindcss(configOrPath) {
    return {
        postcssPlugin: 'tailwindcss',
        plugins: [
            _sharedState.env.DEBUG && function(root) {
                console.log('\n');
                console.time('JIT TOTAL');
                return root;
            },
            function(root, result) {
                let setupContext = _sharedState.env.TAILWIND_MODE === 'watch' ? (0, _setupWatchingContext).default(configOrPath) : (0, _setupTrackingContext).default(configOrPath);
                (0, _processTailwindFeatures).default(setupContext)(root, result);
            },
            _sharedState.env.DEBUG && function(root) {
                console.timeEnd('JIT TOTAL');
                console.log('\n');
                return root;
            }, 
        ].filter(Boolean)
    };
};
module.exports.postcss = true;
