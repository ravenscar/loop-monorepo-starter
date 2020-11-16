const CircularDependencyPlugin = require('circular-dependency-plugin');
const autoprefixer = require('autoprefixer');

module.exports = {
  devtool: 'source-map',
  stats: 'minimal',
  resolve: {
    extensions: ['.webpack.js', '.web.js', '.mjs', '.js', '.graphql', '.gql'],
  },
  externals: [],
  plugins: [
    new CircularDependencyPlugin({
      exclude: /a\.js|node_modules/,
      failOnError: true,
      allowAsyncCycles: false,
      cwd: process.cwd(),
    }),
  ],
  module: {
    rules: [
      {
        test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        use: [
          {
            loader: require.resolve('url-loader'),
            options: {
              limit: 10000,
              esModule: false,
              mimetype: 'application/font-woff',
            },
          },
        ],
      },
      {
        test: /\.(png|jp(e*)g)$/,
        use: [
          {
            loader: require.resolve('url-loader'),
            options: {
              esModule: false,
              limit: 10000,
            },
          },
        ],
      },
      {
        test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        use: [
          {
            loader: require.resolve('file-loader'),
            options: {
              esModule: false,
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: [require.resolve('style-loader'), require.resolve('css-loader')],
      },
      {
        test: /\.scss$/,
        use: [
          require.resolve('style-loader'),
          {
            loader: require.resolve('css-loader'),
            options: {
              importLoaders: 2,
            },
          },
          {
            loader: require.resolve('postcss-loader'),
            options: {
              postcssOptions: {
                plugins: [autoprefixer()],
              },
            },
          },
          require.resolve('sass-loader'),
        ],
      },
    ],
  },
};
