const { merge } = require('webpack-merge');

const { buildTemplateConfig, buildCopyConfig, buildIconConfig } = require('./helpers');
const { localDevServer, uxDevServer } = require('./dev-server');
const common = require('./webpack.common');
const dev = require('./webpack.dev');
const prod = require('./webpack.prod');

let devServer = undefined;
if (process.env.DEV_MODE === 'local') {
  devServer = localDevServer;
}
if (process.env.DEV_MODE === 'ux') {
  devServer = uxDevServer;
}

let modeConfig = prod;
if (process.env.BUILD_MODE === 'dev') modeConfig = dev;

const baseConfig = merge(common, modeConfig);

module.exports = {
  merge,
  devServer,
  baseConfig,
  buildTemplateConfig,
  buildCopyConfig,
  buildIconConfig,
};
