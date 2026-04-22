import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { FunctionEvent, FunctionResponse } from '../netlify/functions/_lib/http';

type HandlerModule = {
  handler: (event: FunctionEvent) => Promise<FunctionResponse> | FunctionResponse;
};

const functionModuleLoaders: Record<string, () => Promise<HandlerModule>> = {
  'api-ninjas-electricvehicle': () => import('../netlify/functions/api-ninjas-electricvehicle'),
  'contact-submit': () => import('../netlify/functions/contact-submit'),
  'create-enquiry': () => import('../netlify/functions/create-enquiry'),
  'deepl-translate': () => import('../netlify/functions/deepl-translate'),
  'gemini-enrich-model': () => import('../netlify/functions/gemini-enrich-model'),
  'gemini-chat': () => import('../netlify/functions/gemini-chat'),
  'ocm-reference-data': () => import('../netlify/functions/ocm-reference-data'),
  'ocm-stations': () => import('../netlify/functions/ocm-stations'),
};

const normalizeHeaders = (headers: IncomingMessage['headers']) =>
  Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(', ') : value ?? '',
    ]),
  );

const readBody = (req: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

export const netlifyFunctionsPlugin = (): Plugin => ({
  name: 'netlify-functions-dev-proxy',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
      const requestUrl = req.url ?? '';
      if (!requestUrl.startsWith('/.netlify/functions/')) {
        next();
        return;
      }

      const url = new URL(requestUrl, `http://${req.headers.host ?? 'localhost:3000'}`);
      const functionName = url.pathname.replace('/.netlify/functions/', '').split('/')[0];
      const loadModule = functionModuleLoaders[functionName];

      if (!loadModule) {
        next();
        return;
      }

      try {
        const body = await readBody(req);
        const module = await loadModule();
        const event: FunctionEvent = {
          httpMethod: req.method,
          path: url.pathname,
          rawUrl: url.toString(),
          headers: normalizeHeaders(req.headers),
          queryStringParameters: Object.fromEntries(url.searchParams.entries()),
          body,
          isBase64Encoded: false,
        };

        const response = await module.handler(event);
        res.statusCode = response.statusCode;
        Object.entries(response.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        res.end(response.body);
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            error: (error as Error).message || 'Unhandled function error.',
          }),
        );
      }
    });
  },
});
