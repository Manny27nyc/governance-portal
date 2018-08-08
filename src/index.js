import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import ReduxThunk from 'redux-thunk';
import { composeWithDevTools } from 'redux-devtools-extension/developmentOnly';
import Raven from 'raven-js';

import rootReducer from './reducers';
import { isMobile } from './utils/misc';
import Router from './Routes';
import { localLinkProgress, updateAccountsAfterLink } from './middlewares';
import './global.css.js';
import { metamaskConnectInit } from './reducers/metamask';

const store = createStore(
  rootReducer,
  composeWithDevTools(
    applyMiddleware(ReduxThunk, localLinkProgress, updateAccountsAfterLink)
  )
);

store.dispatch(metamaskConnectInit());

if (process.env.NODE_ENV === 'production') {
  Raven.config(
    'https://3113186e2c5b4ef8b8eef1095b08a42b@sentry.io/1241257'
  ).install();
  Raven.context(() =>
    ReactDOM.render(
      <Provider store={store}>
        {isMobile() ? <div>No mobile support yet</div> : <Router />}
      </Provider>,
      document.getElementById('root')
    )
  );
} else {
  ReactDOM.render(
    <Provider store={store}>
      {isMobile() ? <div>No mobile support yet</div> : <Router />}
    </Provider>,
    document.getElementById('root')
  );
}
