const { NodeSDK } = require('@opentelemetry/sdk-node')
const {
  getNodeAutoInstrumentations,
} = require('@opentelemetry/auto-instrumentations-node')
const {
  OTLPTraceExporter,
} = require('@opentelemetry/exporter-trace-otlp-http')
const {
  OTLPMetricExporter,
} = require('@opentelemetry/exporter-metrics-otlp-http')
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics')

if (
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT &&
  process.env.OTEL_EXPORTER_OTLP_HEADERS
) {
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  })

  sdk.start()
  console.log('OpenTelemetry initialized')
} else {
  console.log('OpenTelemetry not initialized, required environment variables are missing')
}