module.exports = {
	env: {
		es2021: true,
		'googleappsscript/googleappsscript': true,
	},
	extends: ['airbnb-base'],
	parserOptions: {
		ecmaVersion: 'latest',
	},
	plugins: ['googleappsscript'],
	rules: {
		'no-tabs': 'off',
		indent: ['error', 'tab'],
		'no-restricted-syntax': 'off',
		'no-unused-vars': 'off',
		'no-plusplus': ['off', {
			allowForLoopAfterthoughts: true,
		}],
	},
};
