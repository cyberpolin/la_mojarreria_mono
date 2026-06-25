# TAKU Service Model

TAKU is split into sellable developer services and a subscription/control
service. The control service manages access, billing, configuration, and
visibility for the runtime services.

## Services

### TAKU WhatsApp Bridge

Runtime service: `apps/wa-service`

Commercial role: sellable developer infrastructure.

This service provides WhatsApp connectivity for developers and products that
need to send, receive, and observe WhatsApp messages.

Responsibilities:

- WhatsApp session lifecycle.
- QR pairing and connection status.
- Message send and receive APIs.
- Webhook events for inbound/outbound activity.
- Runtime health and connection diagnostics.
- Tenant-aware API access.

It should stay focused on transport. It should not own subscription plans,
billing, broad customer management, or product packaging.

### TAKU Bot Runtime

Runtime service: `apps/bot-service`

Commercial role: sellable developer automation service.

This service provides customer-relation bot behavior on top of messaging
channels. It is the automation layer that can decide how to respond, route,
classify, or trigger workflows.

Responsibilities:

- Bot handlers and response workflows.
- Customer conversation automation.
- Third-party AI/provider integrations.
- Bot runtime configuration.
- Bot event processing.
- Developer-facing automation APIs.

It should stay focused on bot execution and automation. Subscription ownership,
tenant onboarding, billing, and service provisioning belong to the control
service.

### TAKU Control

Control services: `apps/taku-api-service` and `apps/taku-web`

Commercial role: subscription and control service.

TAKU Control is the SaaS layer that sells, provisions, configures, and monitors
the TAKU runtime services. `taku-api-service` is the backend control plane.
`taku-web` is the customer/admin control panel.

Responsibilities:

- Tenant accounts.
- Authentication and authorization.
- Products, plans, and subscriptions.
- Billing and payment status.
- Service provisioning.
- API keys and credentials.
- Runtime service configuration.
- Usage, logs, and status dashboards.
- Documentation and onboarding.
- Admin/customer self-service.

TAKU Control can grow into customer service, CRM, analytics, campaigns, and
support workflows, but its core responsibility is controlling access to the
sellable TAKU services.

## Product Packaging

The commercial packages should map to customer value, not necessarily to
internal process boundaries.

| Product              | Backing service                           | Buyer-facing value                                                         |
| -------------------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| TAKU WhatsApp Bridge | `apps/wa-service`                         | WhatsApp API, sessions, webhooks, and message transport.                   |
| TAKU Bot Runtime     | `apps/bot-service`                        | Bot automation and customer-relation workflows.                            |
| TAKU Control         | `apps/taku-api-service` + `apps/taku-web` | Subscription portal, tenant management, configuration, usage, and billing. |

## Dependency Shape

TAKU Control provisions and configures the runtime services.

```text
taku-web
  -> taku-api-service
      -> provisions/configures:
          wa-service
          bot-service
```

External developer usage should go directly to the runtime service APIs after
TAKU Control has authorized and provisioned access.

```text
Developer application
  -> wa-service API
  -> bot-service API

Customer/admin user
  -> taku-web
      -> taku-api-service
```

## Ownership Boundaries

### `taku-api-service`

Owns durable business and subscription state:

- tenants
- users
- plans
- subscriptions
- API keys
- service entitlements
- service configuration
- usage and billing metadata

It should be the source of truth for whether a tenant can use a service.

### `taku-web`

Owns the customer/admin experience:

- signup and onboarding
- subscription management
- payment and billing screens
- service setup forms
- API key management UI
- docs and examples
- logs/status views

It should call `taku-api-service`; it should not directly own runtime behavior.

### `wa-service`

Owns WhatsApp transport only:

- sessions
- QR status
- connection state
- message transport
- WhatsApp webhooks/events

It should validate tenant/API access, then execute transport work.

### `bot-service`

Owns automation runtime only:

- bot handler execution
- conversation automation
- integration calls
- bot-specific status/logging

It should validate tenant/API access, then execute automation work.

## Runtime Access Model

The control service should issue credentials and service entitlements. Runtime
services should validate those credentials before performing work.

Recommended flow:

```text
1. Customer subscribes in taku-web.
2. taku-web calls taku-api-service.
3. taku-api-service creates tenant/service entitlement/API key.
4. Runtime service receives requests with that API key or service token.
5. Runtime service validates access with local config or taku-api-service.
6. Runtime service executes the request and records usage/logs.
```

## What Not To Mix

Avoid putting subscription logic inside `wa-service` or `bot-service`.

Avoid putting WhatsApp session logic inside `taku-api-service`.

Avoid putting bot execution logic inside `taku-web`.

This separation keeps each sellable service independently understandable while
TAKU Control remains the product layer that packages and monetizes them.
