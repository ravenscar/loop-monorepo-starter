const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');

const buildTemplateConfig = ({ template, filename }) => ({
  plugins: [
    new HtmlWebpackPlugin({
      template,
      filename,
    }),
  ],
});

const buildCopyConfig = (files) => ({
  plugins: [new CopyWebpackPlugin({ patterns: files.map((f) => ({ from: f })) })],
});

const buildIconConfig = (logo) => ({
  plugins: [
    new FaviconsWebpackPlugin({
      logo,
      favicons: {
        appName: 'Loop Monorepo Starter',
        appShortName: 'LMS',
        lang: 'en-US',
        background: '#fff',

        theme_color: '#fff',
        icons: {
          android: true,
          appleIcon: true,
          appleStartup: false,
          coast: true,
          favicons: true,
          firefox: true,
          windows: true,
          yandex: true,
        },
      },
    }),
  ],
});

module.exports = {
  buildTemplateConfig,
  buildCopyConfig,
  buildIconConfig,
};
