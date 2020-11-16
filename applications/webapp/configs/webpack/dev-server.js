const path = require('path');
const fs = require('fs');

const makeDevServerConfig = ({ apiHost, wsHost }) => {
  wsHost = wsHost || apiHost;
  const secureApi = !apiHost.match('localhost');
  const secureWs = !wsHost.match('localhost');

  return {
    devServer: {
      host: '0.0.0.0',
      port: process.env.PORT || 8080,
      hot: true,
      noInfo: true,
      disableHostCheck: true,
      proxy: [
        {
          context: ['/graphiql*', '/v1/public/**', '/local/**'],
          target: apiHost,
          secure: secureApi,
          changeOrigin: secureApi,
        },
        {
          context: ['/subscriptions*'],
          target: wsHost,
          ws: true,
          secure: secureWs,
          changeOrigin: secureWs,
        },
      ],
    },
  };
};

module.exports = {
  localDevServer: makeDevServerConfig({
    apiHost: 'http://localhost:3000',
  }),
  uxDevServer: makeDevServerConfig({
    apiHost: 'https://embedded.dev.communicate.smokeball.com.au',
    wsHost: 'https://push.dev.communicate.smokeball.com.au',
  }),
};
