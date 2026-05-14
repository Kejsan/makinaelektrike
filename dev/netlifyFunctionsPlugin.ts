import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { FunctionEvent, FunctionResponse } from '../netlify/functions/_lib/http';

type HandlerModule = {
  handler: (event: FunctionEvent) => Promise<FunctionResponse> | FunctionResponse;
};

const functionModuleLoaders: Record<string, () => Promise<HandlerModule>> = {
  'access-invite-accept': () => import('../netlify/functions/access-invite-accept'),
  'access-invite-lookup': () => import('../netlify/functions/access-invite-lookup'),
  'admin-access-list': () => import('../netlify/functions/admin-access-list'),
  'admin-access-lookup': () => import('../netlify/functions/admin-access-lookup'),
  'admin-access-update': () => import('../netlify/functions/admin-access-update'),
  'admin-audit-list': () => import('../netlify/functions/admin-audit-list'),
  'admin-blog-save': () => import('../netlify/functions/admin-blog-save'),
  'admin-blog-update': () => import('../netlify/functions/admin-blog-update'),
  'admin-dealer-account-activate': () => import('../netlify/functions/admin-dealer-account-activate'),
  'admin-dealer-lookup': () => import('../netlify/functions/admin-dealer-lookup'),
  'admin-dealer-owner-update': () => import('../netlify/functions/admin-dealer-owner-update'),
  'admin-dealer-plan-update': () => import('../netlify/functions/admin-dealer-plan-update'),
  'admin-dealer-save': () => import('../netlify/functions/admin-dealer-save'),
  'admin-dealer-status-update': () => import('../netlify/functions/admin-dealer-status-update'),
  'admin-entity-note-create': () => import('../netlify/functions/admin-entity-note-create'),
  'admin-invite-create': () => import('../netlify/functions/admin-invite-create'),
  'admin-invite-list': () => import('../netlify/functions/admin-invite-list'),
  'admin-invite-revoke': () => import('../netlify/functions/admin-invite-revoke'),
  'admin-listing-lookup': () => import('../netlify/functions/admin-listing-lookup'),
  'admin-listing-update': () => import('../netlify/functions/admin-listing-update'),
  'admin-model-lookup': () => import('../netlify/functions/admin-model-lookup'),
  'admin-model-save': () => import('../netlify/functions/admin-model-save'),
  'admin-model-update': () => import('../netlify/functions/admin-model-update'),
  'admin-notification-list': () => import('../netlify/functions/admin-notification-list'),
  'admin-placement-analytics': () => import('../netlify/functions/admin-placement-analytics'),
  'admin-placement-bootstrap': () => import('../netlify/functions/admin-placement-bootstrap'),
  'admin-placement-list': () => import('../netlify/functions/admin-placement-list'),
  'admin-placement-order-save': () => import('../netlify/functions/admin-placement-order-save'),
  'admin-placement-save': () => import('../netlify/functions/admin-placement-save'),
  'admin-station-lookup': () => import('../netlify/functions/admin-station-lookup'),
  'admin-station-update': () => import('../netlify/functions/admin-station-update'),
  'admin-user-lookup': () => import('../netlify/functions/admin-user-lookup'),
  'admin-user-status-update': () => import('../netlify/functions/admin-user-status-update'),
  'api-ninjas-electricvehicle': () => import('../netlify/functions/api-ninjas-electricvehicle'),
  'contact-submit': () => import('../netlify/functions/contact-submit'),
  'create-enquiry': () => import('../netlify/functions/create-enquiry'),
  'dealer-media-upload': () => import('../netlify/functions/dealer-media-upload'),
  'dealer-placement-list': () => import('../netlify/functions/dealer-placement-list'),
  'dealer-placement-order-update': () => import('../netlify/functions/dealer-placement-order-update'),
  'dealer-placement-request-create': () => import('../netlify/functions/dealer-placement-request-create'),
  'dealer-staff-invite-create': () => import('../netlify/functions/dealer-staff-invite-create'),
  'dealer-staff-invite-revoke': () => import('../netlify/functions/dealer-staff-invite-revoke'),
  'dealer-staff-list': () => import('../netlify/functions/dealer-staff-list'),
  'dealer-staff-member-update': () => import('../netlify/functions/dealer-staff-member-update'),
  'deepl-translate': () => import('../netlify/functions/deepl-translate'),
  'gemini-enrich-model': () => import('../netlify/functions/gemini-enrich-model'),
  'gemini-chat': () => import('../netlify/functions/gemini-chat'),
  'internal-guide-content': () => import('../netlify/functions/internal-guide-content'),
  'listing-media-upload': () => import('../netlify/functions/listing-media-upload'),
  'model-media-upload': () => import('../netlify/functions/model-media-upload'),
  'ocm-reference-data': () => import('../netlify/functions/ocm-reference-data'),
  'ocm-stations': () => import('../netlify/functions/ocm-stations'),
  'public-placement-resolve': () => import('../netlify/functions/public-placement-resolve'),
  'public-placement-track': () => import('../netlify/functions/public-placement-track'),
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

const handleFunctionRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => {
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
};

export const netlifyFunctionsPlugin = (): Plugin => ({
  name: 'netlify-functions-dev-proxy',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(handleFunctionRequest);
  },
  configurePreviewServer(server) {
    server.middlewares.use(handleFunctionRequest);
  },
});
