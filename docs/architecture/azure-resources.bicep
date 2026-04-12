// PeelAway Logic - Enterprise Azure Architecture
// This template provisions the full enterprise version of the PeelAway Logic
// job search pipeline system.
//
// Current portfolio deployment uses: GitHub Pages + Anthropic API + F0 Search
// This template shows the Azure-native equivalent at scale.
//
// Deploy: az deployment group create --resource-group peelaway-portfolio-rg
//         --template-file azure-resources.bicep
//         --parameters environment=dev
//
// NOTE: This is a documentation-only template demonstrating enterprise Azure
// architecture knowledge. It is not deployed as part of this portfolio project.

// ============================================================
// PARAMETERS
// ============================================================

param location string = resourceGroup().location

@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string = 'dev'

param appName string = 'peelaway'

// ============================================================
// VARIABLES
// ============================================================

var tags = {
  application: 'PeelAway Logic'
  environment: environment
  managedBy: 'Bicep'
}

// ============================================================
// 1. KEY VAULT
// Purpose: Centralized secret storage for OpenAI API keys,
//          Azure AI Search admin keys, and any future service
//          credentials. Replaces the user-entered API keys in
//          the portfolio version with managed identity bindings,
//          so secrets never touch browser localStorage or env files.
// Why Key Vault: Azure-native secret store with RBAC, audit logs,
//               and automatic key rotation support. Required for
//               any production workload handling third-party API keys.
// ============================================================

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${appName}-kv-${environment}'
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      // Standard SKU: hardware-backed keys, RBAC, private endpoints.
      // Premium adds HSM-backed keys - not needed at this scale.
      name: 'standard'
    }
    tenantId: subscription().tenantId
    // Soft delete: retains deleted secrets for 90 days (required by Azure policy).
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    // Purge protection: prevents permanent deletion during retention window.
    // Critical for prod - protects against accidental or malicious key destruction.
    enablePurgeProtection: true
    // RBAC authorization model (replaces legacy access policies).
    // Grants fine-grained control: e.g., Static Web App MI gets Key Vault Secrets User,
    // never Key Vault Administrator.
    enableRbacAuthorization: true
  }
}

// ============================================================
// 2a. LOG ANALYTICS WORKSPACE
// Purpose: Central log sink for all Azure resources in this
//          deployment. App Insights, ADF, and Static Web Apps
//          all forward telemetry here, enabling cross-resource
//          KQL queries (e.g., correlate token usage with search
//          latency and pipeline session state).
// Why Log Analytics: Required backend for App Insights workspace-based
//                   mode, and enables Azure Monitor Workbooks for
//                   token usage dashboards.
// ============================================================

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${appName}-logs-${environment}'
  location: location
  tags: tags
  properties: {
    sku: {
      // PerGB2018: pay-per-ingested-GB. Better than legacy fixed-tier for
      // variable workloads like job pipeline runs (bursty, not constant).
      name: 'PerGB2018'
    }
    retentionInDays: environment == 'prod' ? 90 : 30
  }
}

// ============================================================
// 2b. APPLICATION INSIGHTS
// Purpose: Observability layer for the React frontend and any
//          API routes in Static Web Apps. Tracks:
//          - OpenAI token usage per pipeline run (custom events)
//          - Search query latency and result counts
//          - Pipeline phase completion rates (Scout -> Review -> Tailor)
//          - JS errors and page load performance
// Why App Insights: Purpose-built for web apps; integrates directly
//                  with Static Web Apps and provides the Application
//                  Map view to trace calls across Search -> OpenAI.
// ============================================================

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${appName}-insights-${environment}'
  location: location
  tags: tags
  // 'web' kind enables browser SDK telemetry + server-side correlation.
  kind: 'web'
  properties: {
    Application_Type: 'web'
    // Workspace-based mode: telemetry stored in Log Analytics, not legacy
    // App Insights storage. Required for cross-resource KQL queries.
    WorkspaceResourceId: logAnalyticsWorkspace.id
    // Leave IP masking enabled by default for GDPR compliance
    // (job seekers are end users whose location data warrants protection).
    DisableIpMasking: false
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ============================================================
// 3. AZURE AI SEARCH
// Purpose: Powers full-text and semantic search across scored
//          job results. In the pipeline, the Review phase stores
//          scored job JSON into a search index so users can
//          re-query, filter by score, and sort by relevance
//          without re-calling OpenAI on every interaction.
// Why Azure AI Search vs. client-side filter: Enables server-side
//          facets (location, score range, company), pagination, and
//          semantic ranking without shipping all results to the browser.
// Portfolio note: Portfolio uses F0 free tier via direct REST calls.
//          This resource + SDK replaces that with managed identity auth
//          and enterprise index management (aliases, analyzers, synonyms).
// ============================================================

resource search 'Microsoft.Search/searchServices@2023-11-01' = {
  name: '${appName}-search-${environment}'
  location: location
  tags: tags
  sku: {
    // Free tier for dev: 50MB storage, 3 indexes, no SLA.
    // Basic for prod: 2GB/partition, SLA, up to 3 replicas for HA.
    // Standard (S1+) would add semantic ranking and higher throughput.
    name: environment == 'prod' ? 'basic' : 'free'
  }
  properties: {
    replicaCount: environment == 'prod' ? 2 : 1
    partitionCount: 1
    // Public access for dev; prod should use private endpoint + shared
    // private link to restrict access to Static Web Apps backend only.
    publicNetworkAccess: 'enabled'
    // Disable local (key-based) auth in prod; use managed identity exclusively.
    disableLocalAuth: environment == 'prod' ? true : false
  }
}

// ============================================================
// 4. AZURE OPENAI SERVICE
// Purpose: LLM backbone for the Review (scoring), Tailor (resume
//          rewrite), and Cover Letter pipeline phases.
// Why Azure OpenAI vs. Anthropic Claude (portfolio version):
//          Azure OpenAI provides: managed identity auth (no API keys
//          in code), VNet integration, content filtering policies,
//          usage quotas per deployment, and is required for many
//          enterprise compliance frameworks (SOC2, FedRAMP).
// Semantic Kernel note: The semantic-kernel-demo directory already
//          has AzureChatCompletion configured - this resource is the
//          missing Azure-side binding. Wire it up with the Static Web
//          Apps managed identity as the Cognitive Services OpenAI User role.
// ============================================================

resource openAIService 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: '${appName}-openai-${environment}'
  location: location
  tags: tags
  // Kind 'OpenAI' selects the Azure OpenAI endpoint class, distinct from
  // Cognitive Services Vision or Speech accounts.
  kind: 'OpenAI'
  sku: {
    // S0 is the only billable SKU for Azure OpenAI. Quotas are managed
    // at the deployment level (capacity field below), not the account SKU.
    name: 'S0'
  }
  properties: {
    // Disable API key auth in prod; all callers use managed identity.
    disableLocalAuth: environment == 'prod' ? true : false
    publicNetworkAccess: 'Enabled'
    customSubDomainName: '${appName}-openai-${environment}'
  }
}

// Model deployment: gpt-4o-mini
// Why gpt-4o-mini: Optimized cost/quality ratio for structured extraction
//   tasks (job scoring JSON, resume diff). Faster and ~10x cheaper than
//   gpt-4o for the high-volume Review phase (one call per job result).
//   Reserve a gpt-4o deployment for Cover Letter generation where the
//   quality premium justifies cost.
resource openAIDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: openAIService
  name: 'gpt-4o-mini'
  sku: {
    // GlobalStandard routes to lowest-latency Azure region automatically.
    // Standard (regional) is an alternative if data residency is required.
    name: 'GlobalStandard'
    capacity: 10 // TPM quota in thousands (10K TPM for dev/staging)
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o-mini'
      version: '2024-07-18'
    }
  }
}

// ============================================================
// 5. COSMOS DB (NoSQL API)
// Purpose: Pipeline session state persistence. Replaces the
//          current localStorage approach, enabling:
//          - Cross-device resume sessions ("continue on mobile")
//          - Server-side pipeline analytics (drop-off rates per phase)
//          - Audit trail for scored jobs and resume versions
//          - Multi-tab safety (no stale localStorage state)
// Why Cosmos DB over SQL: Document model matches the pipeline's
//          JSON-native state shape (jobResults[], resumeChunks[], etc.)
//          with no schema migration overhead as the pipeline evolves.
//          NoSQL API avoids ORM complexity for a single-container design.
// Why Serverless: Pipeline sessions are bursty (active during job search
//          sprints, idle otherwise). Serverless billing at $0.25/1M RU
//          vs. provisioned 400 RU/s ($23/mo minimum) is correct for this
//          workload. Revisit provisioned at >$50/mo Serverless cost.
// ============================================================

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: '${appName}-state-${environment}'
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: environment == 'prod' ? true : false
      }
    ]
    capabilities: [
      {
        // Serverless capacity mode: no provisioned throughput, pay per RU consumed.
        name: 'EnableServerless'
      }
    ]
    consistencyPolicy: {
      // Session consistency: strong within a single user's session, eventual
      // across regions. Correct for pipeline state (user reads own writes).
      defaultConsistencyLevel: 'Session'
    }
    // Disable key-based auth in prod; use managed identity (Cosmos DB Built-in
    // Data Contributor role on the Static Web Apps MI).
    disableLocalAuth: environment == 'prod' ? true : false
  }
}

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: '${appName}-db'
  properties: {
    resource: {
      id: '${appName}-db'
    }
  }
}

resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDatabase
  name: 'pipeline-sessions'
  properties: {
    resource: {
      id: 'pipeline-sessions'
      // Partition by userId: distributes load evenly across users and allows
      // efficient single-partition queries for "get all sessions for user X".
      // Avoid partitioning by sessionId - that would scatter per-session reads.
      partitionKey: {
        paths: [
          '/userId'
        ]
        kind: 'Hash'
      }
      // TTL: auto-expire sessions after 90 days of inactivity.
      // Keeps storage cost low without a dedicated cleanup job.
      defaultTtl: 7776000 // 90 days in seconds
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          { path: '/userId/?' }
          { path: '/phase/?' }
          { path: '/createdAt/?' }
        ]
        excludedPaths: [
          // Exclude large blob fields from indexing to reduce RU cost.
          // resumeText and jobResults[] are retrieved by session ID, not scanned.
          { path: '/resumeText/?' }
          { path: '/jobResults/*' }
        ]
      }
    }
  }
}

// ============================================================
// 6. AZURE STATIC WEB APPS
// Purpose: Hosting for the React frontend + managed API backend.
//          Replaces GitHub Pages with:
//          - Built-in authentication (AAD, GitHub, Google providers)
//          - Managed API routes (Azure Functions) co-deployed with frontend
//          - Staging environments per PR branch (preview deployments)
//          - Global CDN with automatic SSL
//          - Managed identity for Key Vault / Cosmos DB access (no secrets in CI)
// Why SWA over App Service: SWA's Free tier covers this workload with
//          zero infrastructure management. App Service adds cost and
//          complexity with no benefit for a static React app + light API.
// Deployment note: Uses the same GitHub Actions workflow as the current
//          GitHub Pages deployment. Add the SWA_DEPLOYMENT_TOKEN secret
//          and swap actions/deploy-pages for Azure/static-web-apps-deploy.
// ============================================================

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${appName}-web-${environment}'
  location: location
  tags: tags
  sku: {
    // Free tier: 100GB bandwidth/mo, custom domains, built-in auth.
    // Standard tier ($9/mo) adds private endpoints and bring-your-own-functions.
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: 'https://github.com/your-org/peelaway-logic'
    branch: environment == 'prod' ? 'main' : environment
    buildProperties: {
      appLocation: '/'
      outputLocation: 'build'
    }
  }
}

// App Settings: wire up resource endpoints at deploy time.
// Injected as environment variables into the SWA build and API routes.
// In prod, values like COSMOS_ENDPOINT are read; secrets are fetched from
// Key Vault by the managed identity at runtime (not stored here).
resource staticWebAppSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    APPINSIGHTS_INSTRUMENTATIONKEY: appInsights.properties.InstrumentationKey
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.properties.ConnectionString
    AZURE_SEARCH_ENDPOINT: search.properties.endpoint
    AZURE_OPENAI_ENDPOINT: openAIService.properties.endpoint
    COSMOS_ENDPOINT: cosmosAccount.properties.documentEndpoint
    KEY_VAULT_URI: keyVault.properties.vaultUri
    ENVIRONMENT: environment
  }
}

// ============================================================
// 7. AZURE DATA FACTORY (optional - enterprise job data ingestion)
// Purpose: Moves the Scout phase job fetching (Adzuna, JSearch,
//          RSS feeds) from client-side browser API calls to
//          scheduled server-side ADF pipelines with:
//          - Retry logic and exponential backoff on source rate limits
//          - Incremental load (only fetch new jobs since last run)
//          - Monitoring and alerting via Log Analytics
//          - Parameterized pipelines per job source connector
// Why ADF vs. Azure Functions: ADF's visual pipeline designer and
//          built-in connectors (HTTP, REST, Cosmos DB sink) reduce
//          boilerplate vs. hand-rolled Functions. ADF also provides
//          native Cosmos DB sink activity for direct index writes.
// Cost note: ADF is billed per activity run (~$0.001/run). At 4 job
//          sources x 24 scheduled runs/day = ~$0.10/day for dev.
//          Disable scheduled triggers in non-prod to minimize cost.
// ============================================================

resource dataFactory 'Microsoft.DataFactory/factories@2018-06-01' = {
  name: '${appName}-adf-${environment}'
  location: location
  tags: tags
  identity: {
    // System-assigned MI: grant this identity Key Vault Secrets User
    // so ADF pipelines can retrieve API keys without hardcoding credentials
    // in linked service definitions.
    type: 'SystemAssigned'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
  }
}

// ============================================================
// OUTPUTS
// Used by downstream CI/CD steps (secret seeding scripts, smoke tests)
// and by the SWA app settings block above.
// ============================================================

// Search endpoint injected into Static Web Apps for client-side queries.
output searchEndpoint string = search.properties.endpoint

// Default hostname for the deployed frontend (e.g., lively-forest-xxx.azurestaticapps.net).
// Map a custom domain via CNAME to this value.
output webUrl string = staticWebApp.properties.defaultHostname

// Key Vault URI for post-deploy secret seeding scripts.
// Example: az keyvault secret set --vault-name <name> --name openai-key --value <key>
output keyVaultUri string = keyVault.properties.vaultUri
