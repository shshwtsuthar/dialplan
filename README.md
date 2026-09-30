# dialplan

A call-routing decision service. When a call arrives, the phone switch asks
the API "where should this ring?" and gets an answer from the business's
dialplan rules. The website plays the part of the switch.

Work in progress: the architecture write-up lands with the full build.

## Layout

| Path              | What                                                         |
| ----------------- | ------------------------------------------------------------ |
| `shared/`         | zod schemas shared by the API and the web app                |
| `api/`            | Lambda handlers (TypeScript, bundled with esbuild)           |
| `web/`            | Next.js static export, hosted on Amplify                     |
| `infra/`          | Terraform for everything the app runs on                     |
| `infra/bootstrap` | One-time setup: state bucket, GitHub OIDC provider, CI roles |
| `scripts/`        | Deploy helpers used by CI and for local iteration            |

## Bootstrap (once, from a laptop)

```sh
cd infra/bootstrap
AWS_PROFILE=dialplan terraform init
AWS_PROFILE=dialplan terraform apply
```

Then put the `state_bucket` output in `infra/versions.tf`, and set the GitHub
variables `AWS_PLAN_ROLE_ARN` (repository) and `AWS_DEPLOY_ROLE_ARN` (on the
`production` environment, restricted to `main`). The bootstrap state stays
local on purpose; keep `infra/bootstrap/terraform.tfstate` safe.
