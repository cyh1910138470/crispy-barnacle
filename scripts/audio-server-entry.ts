// 内置音源服务的打包入口：直接启动服务器，绕过 app.ts 的「直接运行」判断
// （app.ts 依赖 import.meta.url 比较，bundle 成 CJS 后不可靠）
import { startServer } from '../qq-music-api/src/server';

startServer();
