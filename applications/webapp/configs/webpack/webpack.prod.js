const path = require('path');

module.exports = {
  mode: 'production',
  optimization: {
    splitChunks: {
      chunks: 'all',
    },
  },
  output: {
    filename: '[name].[contenthash].bundle.js',
    chunkFilename: '[name].[contenthash].bundle.js',
    path: path.join(process.cwd(), 'bundle'),
  },
};
