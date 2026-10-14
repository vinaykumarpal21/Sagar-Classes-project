'use strict';

/**
 * Sagar Classes – backend service.
 *
 * The website itself is static (data lives in the browser), so this service only does
 * monitoring work:
 *   GET  /health              liveness check (used by Docker healthcheck)
 *   GET  /metrics             Prometheus metrics (scraped by Prometheus)
 *   POST /track/pageview      anonymous page-view counter, called by frontend/js/layout.js
 */

const express = require('express');
const client = require('prom-client');

const PORT = Number(process.env.PORT) || 3000;

/* Only these page names are accepted, so a visitor can never create unlimited metric labels. */
const KNOWN_PAGES = new Set([
  'index.html', 'about.html', 'academic.html', 'admin.html', 'attendance.html',
  'contact.html', 'facility.html', 'functions.html', 'staff.html', 'toppers.html'
]);

/* ---------- metrics ---------- */
const register = new client.Registry();
register.setDefaultLabels({ service: 'sagar-classes-backend' });
client.collectDefaultMetrics({ register });          // CPU, memory, event-loop lag, GC …

const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests handled by the backend',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register]
});

const pageViews = new client.Counter({
  name: 'sagar_page_views_total',
  help: 'Website page views, by page',
  labelNames: ['page'],
  registers: [register]
});

/* ---------- app ---------- */
const app = express();
app.disable('x-powered-by');

/* Record count + duration of every request; `route` is the matched pattern, never the raw URL. */
app.use((req, res, next) => {
  const stop = httpDuration.startTimer();
  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: req.route ? req.route.path : 'unmatched',
      status: res.statusCode
    };
    httpRequests.inc(labels);
    stop(labels);
  });
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    console.error('Could not collect metrics:', err);
    res.status(500).end();
  }
});

app.post('/track/pageview', express.json({ limit: '1kb', type: '*/*' }), (req, res) => {
  const page = req.body && typeof req.body.page === 'string' ? req.body.page.toLowerCase() : '';
  if (KNOWN_PAGES.has(page)) pageViews.inc({ page });
  res.status(204).end();                              // always quiet – never break the website
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

/* Malformed JSON etc. */
app.use((err, req, res, next) => {          // eslint-disable-line no-unused-vars
  res.status(err.status || 500).json({ error: 'Bad request' });
});

const server = app.listen(PORT, () => {
  console.log(`Sagar Classes backend listening on port ${PORT}`);
});

/* Clean shutdown when Docker stops the container. */
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
