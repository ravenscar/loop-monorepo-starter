import * as React from 'react';
import { hot } from 'react-hot-loader';

const reactLogo = require('./../assets/img/react_logo.svg');
import './../assets/scss/App.scss';

class App extends React.Component<{}, undefined> {
  public render() {
    return (
      <div className="app">
        <h1>Hello World!</h1>
        <p>Foo to the barz</p>
        <img src={reactLogo} height="480" />
      </div>
    );
  }
}

declare let module: object;

export default hot(module)(App);
