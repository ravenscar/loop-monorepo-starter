const path = require('path');
const { merge, baseConfig, buildTemplateConfig, buildCopyConfig, buildIconConfig } = require('./configs/webpack');

const pages = {
  drop: ['example-drop'],
  landing: ['example-landing'],
};

module.exports = merge(
  baseConfig,
  ...pages.landing.map((p) => buildTemplateConfig({ template: `./assets/templates/${p}.ejs`, filename: `${p}.html` })),
  buildCopyConfig(pages.drop.map((p) => `./assets/templates/${p}.html`)),
  buildIconConfig(require.resolve('./assets/img/react_logo.svg')),
  buildTemplateConfig({
    template: require.resolve('./src/index.html.ejs'),
    filename: 'index.html',
  }),
  {
    context: __dirname,
    entry: {
      landing: ['./dist/index.js'],
    },
  },
);
