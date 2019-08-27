import * as Koa from 'koa';
import * as Router from 'koa-router';
const app = new Koa();
const router = new Router();

import { ANSWER } from '@loop/magic';

router.get('/answer', (ctx, next) => {
  ctx.body = `The Answer to the Ultimate Question of Life, the Universe, and Everything is: ${ANSWER}`;
});

app.use(router.routes());
app.use(router.allowedMethods());
app.listen(3000);
