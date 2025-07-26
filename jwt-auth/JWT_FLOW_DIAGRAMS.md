# JWT Bearer Token Flow - Visual Diagrams

This document provides comprehensive Mermaid diagrams showing how JWT Bearer Token Flow works with Salesforce and AWS Lambda.

## 1. Complete JWT Authentication Flow

```mermaid
sequenceDiagram
    participant L as AWS Lambda
    participant JM as JWT Manager
    participant SF as Salesforce
    participant CA as Connected App
    
    Note over L,CA: Lambda Invocation Starts
    
    L->>JM: getConnection(config)
    
    alt Token in Cache & Valid
        JM-->>L: Return cached connection
    else No valid token
        Note over JM: Generate JWT Token
        JM->>JM: Create JWT assertion<br/>- iss: clientId<br/>- sub: username<br/>- aud: instanceUrl<br/>- exp: 3 minutes
        JM->>JM: Sign with private key<br/>(RS256 algorithm)
        
        Note over JM,SF: Token Exchange
        JM->>SF: POST /services/oauth2/token<br/>grant_type=jwt-bearer<br/>assertion=<JWT>
        SF->>CA: Validate JWT signature<br/>with uploaded certificate
        CA-->>SF: Signature valid ✅
        SF->>SF: Verify user permissions<br/>and app access
        SF-->>JM: Return access_token<br/>+ instance_url
        
        Note over JM: Cache & Create Connection
        JM->>JM: Cache token (3 min TTL)
        JM->>JM: Create JSForce connection<br/>with access token
        JM-->>L: Return connection
    end
    
    Note over L,SF: Use Connection
    L->>SF: API calls via JSForce<br/>(query, create, update, etc.)
    SF-->>L: API responses
    
    Note over L: Lambda Response
    L-->>L: Process results & return
```

## 2. Automation Setup Process

```mermaid
flowchart TD
    A[Start Automation] --> B{Authentication Method}
    
    B -->|Username/Password| C[Login to Salesforce]
    B -->|Access Token| D[Use Existing Token]
    
    C --> E[Connected to Salesforce ✅]
    D --> E
    
    E --> F[Generate RSA Key Pair]
    F --> G[Private Key<br/>private_key.pem]
    F --> H[Public Certificate<br/>public.crt]
    
    G --> I[Create Connected App Metadata]
    H --> I
    
    I --> J[Connected App XML<br/>- OAuth settings<br/>- Digital signature<br/>- Certificate content<br/>- Scopes & policies]
    
    J --> K[Deploy via Metadata API]
    K --> L[Salesforce Processing<br/>2-10 minutes]
    
    L --> M{Activation Check}
    M -->|Not Ready| N[Wait 30 seconds]
    N --> M
    M -->|Ready| O[Test JWT Token Exchange]
    
    O --> P{Test Successful?}
    P -->|No| Q[Retry or Fail]
    P -->|Yes| R[Generate Config Files]
    
    R --> S[.env.jwt<br/>Environment Variables]
    R --> T[jwt-config.json<br/>Configuration File]
    R --> U[Private Keys<br/>Secure Storage]
    
    S --> V[Setup Complete ✅]
    T --> V
    U --> V
    
    style A fill:#e1f5fe
    style V fill:#c8e6c9
    style L fill:#fff3e0
    style Q fill:#ffcdd2
```

## 3. What Gets Created in Salesforce

```mermaid
graph TB
    subgraph "Salesforce Org"
        CA[Connected App<br/>JWT_Lambda_Integration]
        
        subgraph "OAuth Configuration"
            OS[OAuth Settings ✅]
            CB[Callback URL<br/>login.salesforce.com/oauth2/success]
            DS[Digital Signatures ✅]
            CERT[Uploaded Certificate<br/>public.crt content]
        end
        
        subgraph "OAuth Scopes"
            API[Access and manage data<br/>api]
            RT[Refresh token<br/>refresh_token, offline_access]
            ID[Basic information<br/>id, profile, email]
        end
        
        subgraph "Security Policies"
            PU[Permitted Users<br/>All users may self-authorize]
            IP[IP Relaxation<br/>Relax IP restrictions]
            RT_POL[Refresh Token Policy<br/>Valid until revoked]
        end
        
        CA --> OS
        CA --> API
        CA --> PU
        
        OS --> CB
        OS --> DS
        OS --> CERT
        
        API --> RT
        API --> ID
        
        PU --> IP
        PU --> RT_POL
    end
    
    subgraph "Generated Artifacts"
        CK[Consumer Key<br/>3MVG9YDQS5WtC11...]
        PK[Private Key<br/>-----BEGIN PRIVATE KEY-----]
        PC[Public Certificate<br/>-----BEGIN CERTIFICATE-----]
    end
    
    CA -.-> CK
    CERT -.-> PC
    DS -.-> PK
    
    style CA fill:#e3f2fd
    style CK fill:#c8e6c9
    style PK fill:#ffecb3
    style PC fill:#f3e5f5
```

## 4. Lambda Environment Setup

```mermaid
graph LR
    subgraph "AWS Lambda Function"
        subgraph "Environment Variables"
            CID[SF_CLIENT_ID<br/>Consumer Key from Connected App]
            PK[SF_PRIVATE_KEY<br/>Private key content<br/>with \n escaped]
            UN[SF_USERNAME<br/>Salesforce username]
            IU[SF_INSTANCE_URL<br/>https://company.salesforce.com]
        end
        
        subgraph "Lambda Code"
            JM[JWT Connection Manager<br/>Singleton instance]
            JH[Lambda Handler<br/>Business logic]
            JSF[JSForce Library<br/>Salesforce API client]
        end
        
        subgraph "Runtime Dependencies"
            JWT_LIB[jsonwebtoken<br/>JWT signing]
            JSFORCE[jsforce<br/>Salesforce integration]
            NODE[Node.js 18+<br/>Runtime environment]
        end
    end
    
    subgraph "AWS Security (Recommended)"
        SM[AWS Secrets Manager<br/>Store private key securely]
        IAM[IAM Role<br/>Lambda execution permissions]
        VPC[VPC Configuration<br/>Network security]
    end
    
    CID --> JM
    PK --> JM
    UN --> JM
    IU --> JM
    
    JM --> JH
    JH --> JSF
    
    JM --> JWT_LIB
    JSF --> JSFORCE
    JSFORCE --> NODE
    
    PK -.->|Production| SM
    JM -.-> IAM
    JH -.-> VPC
    
    style JM fill:#e1f5fe
    style SM fill:#c8e6c9
    style PK fill:#ffecb3
```

## 5. JWT Token Lifecycle in Lambda

```mermaid
stateDiagram-v2
    [*] --> ColdStart: Lambda Invocation
    
    ColdStart --> CheckCache: Initialize JWT Manager
    
    CheckCache --> TokenValid: Token exists in cache
    CheckCache --> GenerateJWT: No valid token
    
    TokenValid --> UseConnection: Token not expired<br/>(< 3 minutes old)
    TokenValid --> GenerateJWT: Token expired
    
    GenerateJWT --> CreateAssertion: Generate JWT assertion
    CreateAssertion --> SignJWT: Sign with private key<br/>(RS256 algorithm)
    SignJWT --> ExchangeToken: POST to Salesforce<br/>/oauth2/token
    
    ExchangeToken --> TokenReceived: Salesforce validates<br/>& returns access_token
    ExchangeToken --> TokenError: Invalid signature<br/>or permissions
    
    TokenReceived --> CacheToken: Store in memory cache<br/>(3 min TTL)
    CacheToken --> CreateConnection: New JSForce connection
    
    CreateConnection --> UseConnection: Connection ready
    UseConnection --> APICall: Execute Salesforce APIs
    
    APICall --> WarmContainer: Lambda response sent
    WarmContainer --> CheckCache: Next invocation<br/>(if container reused)
    
    TokenError --> [*]: Lambda error response
    
    note right of CacheToken
        Token cached for container lifetime
        Subsequent invocations reuse token
        until expiry (3 minutes)
    end note
    
    note right of WarmContainer
        Container may be reused
        for ~15 minutes
        Cache persists across invocations
    end note
```

## 6. Security Architecture

```mermaid
graph TB
    subgraph "Security Layers"
        subgraph "Certificate-Based Authentication"
            RSA[RSA Key Pair<br/>2048-bit encryption]
            PRIV[Private Key<br/>Lambda environment only]
            PUB[Public Certificate<br/>Uploaded to Salesforce]
            SIG[Digital Signature<br/>JWT signed with private key]
        end
        
        subgraph "Token Security"
            SHORT[Short-lived Tokens<br/>3 minutes expiry]
            SCOPE[Limited OAuth Scopes<br/>Principle of least privilege]
            AUD[Audience Validation<br/>Instance URL verification]
            ISS[Issuer Validation<br/>Consumer Key verification]
        end
        
        subgraph "Network Security"
            TLS[TLS 1.2+ Encryption<br/>All API communications]
            IP[IP Relaxation<br/>Lambda dynamic IPs]
            HTTPS[HTTPS Only<br/>No plain HTTP allowed]
        end
        
        subgraph "AWS Security Integration"
            SM[Secrets Manager<br/>Private key storage]
            IAM[IAM Roles<br/>Lambda permissions]
            VPC[VPC Endpoints<br/>Private network access]
            KMS[KMS Encryption<br/>Environment variables]
        end
    end
    
    RSA --> PRIV
    RSA --> PUB
    PRIV --> SIG
    PUB --> SIG
    
    SIG --> SHORT
    SHORT --> SCOPE
    SCOPE --> AUD
    AUD --> ISS
    
    TLS --> IP
    IP --> HTTPS
    
    PRIV -.->|Production| SM
    SM --> IAM
    IAM --> VPC
    VPC --> KMS
    
    style RSA fill:#e3f2fd
    style SHORT fill:#c8e6c9
    style TLS fill:#fff3e0
    style SM fill:#f3e5f5
```

## 7. Performance Optimization Flow

```mermaid
graph TD
    subgraph "Lambda Container Lifecycle"
        CS[Cold Start<br/>~2-3 seconds]
        INIT[Initialize JWT Manager<br/>Singleton pattern]
        GEN[Generate First JWT<br/>~200ms]
        CACHE[Cache Token<br/>In-memory storage]
        
        WS[Warm Start<br/>~50-100ms]
        CHECK[Check Cached Token<br/>~1ms]
        REUSE[Reuse Valid Token<br/>Skip generation]
        
        CS --> INIT
        INIT --> GEN
        GEN --> CACHE
        
        WS --> CHECK
        CHECK --> REUSE
        CHECK -->|Expired| GEN
    end
    
    subgraph "Token Management Strategy"
        TTL[3-minute Token TTL<br/>Balance security vs performance]
        BUFFER[30-second Buffer<br/>Prevent edge-case expiry]
        CLEANUP[Automatic Cleanup<br/>Remove expired tokens]
        
        CACHE --> TTL
        TTL --> BUFFER
        BUFFER --> CLEANUP
    end
    
    subgraph "Connection Reuse Benefits"
        MULTI[Multiple API Calls<br/>Same connection instance]
        BATCH[Batch Operations<br/>Single authentication]
        STREAM[Streaming APIs<br/>Persistent connection]
        
        REUSE --> MULTI
        MULTI --> BATCH
        BATCH --> STREAM
    end
    
    subgraph "Performance Metrics"
        COLD_TIME[Cold Start: ~2.5s total<br/>JWT generation: ~200ms<br/>Connection setup: ~100ms]
        WARM_TIME[Warm Start: ~100ms total<br/>Cache lookup: ~1ms<br/>Connection reuse: ~50ms]
        THROUGHPUT[Throughput: 100+ req/min<br/>Per container instance<br/>Limited by Salesforce API limits]
    end
    
    GEN -.-> COLD_TIME
    REUSE -.-> WARM_TIME
    MULTI -.-> THROUGHPUT
    
    style CS fill:#ffcdd2
    style WS fill:#c8e6c9
    style TTL fill:#e1f5fe
    style THROUGHPUT fill:#f3e5f5
```

## 8. Error Handling & Recovery

```mermaid
flowchart TD
    START[Lambda Invocation] --> GET_CONN[Get JWT Connection]
    
    GET_CONN --> JWT_GEN{Generate JWT}
    
    JWT_GEN -->|Success| TOKEN_EXCHANGE[Exchange for Access Token]
    JWT_GEN -->|Key Error| KEY_ERR[Private Key Issues<br/>- Invalid format<br/>- Missing key<br/>- Permissions]
    
    TOKEN_EXCHANGE --> VALIDATE{Salesforce Validation}
    
    VALIDATE -->|Success| CREATE_CONN[Create JSForce Connection]
    VALIDATE -->|JWT Invalid| JWT_ERR[JWT Signature Error<br/>- Certificate mismatch<br/>- Expired assertion<br/>- Invalid claims]
    VALIDATE -->|User Error| USER_ERR[User Permission Error<br/>- User not authorized<br/>- App not approved<br/>- Insufficient privileges]
    VALIDATE -->|Client Error| CLIENT_ERR[Client Configuration Error<br/>- Invalid consumer key<br/>- App not found<br/>- Wrong instance URL]
    
    CREATE_CONN --> API_CALL[Execute Salesforce API]
    
    API_CALL --> SUCCESS[Return Results]
    API_CALL --> API_ERR[API Error<br/>- Rate limits<br/>- Invalid query<br/>- Network timeout]
    
    KEY_ERR --> RETRY{Retry Logic}
    JWT_ERR --> RETRY
    USER_ERR --> RETRY
    CLIENT_ERR --> RETRY
    API_ERR --> RETRY
    
    RETRY -->|Retryable| WAIT[Wait & Retry<br/>Exponential backoff]
    RETRY -->|Fatal| FAIL[Return Error Response<br/>Log for monitoring]
    
    WAIT --> GET_CONN
    
    SUCCESS --> END[Lambda Success Response]
    FAIL --> END
    
    style SUCCESS fill:#c8e6c9
    style FAIL fill:#ffcdd2
    style KEY_ERR fill:#ffecb3
    style JWT_ERR fill:#ffecb3
    style USER_ERR fill:#ffecb3
    style CLIENT_ERR fill:#ffecb3
    style API_ERR fill:#ffecb3
```

## 9. Deployment Architecture

```mermaid
graph TB
    subgraph "Development Environment"
        DEV_SF[Salesforce Sandbox]
        DEV_KEYS[Development Keys<br/>dev-private.key]
        DEV_APP[Connected App<br/>JWT_Lambda_Dev]
        DEV_LAMBDA[Lambda Function<br/>Development stage]
    end
    
    subgraph "Production Environment"
        PROD_SF[Salesforce Production]
        PROD_KEYS[Production Keys<br/>Stored in Secrets Manager]
        PROD_APP[Connected App<br/>JWT_Lambda_Prod]
        PROD_LAMBDA[Lambda Function<br/>Production stage]
    end
    
    subgraph "CI/CD Pipeline"
        REPO[Git Repository<br/>Code + Infrastructure]
        BUILD[Build Process<br/>npm install, compile]
        TEST[Automated Tests<br/>JWT flow validation]
        DEPLOY[Deployment<br/>AWS SAM/CDK/Terraform]
    end
    
    subgraph "Monitoring & Observability"
        CW[CloudWatch Logs<br/>Lambda execution logs]
        METRICS[CloudWatch Metrics<br/>Duration, errors, throttles]
        ALARMS[CloudWatch Alarms<br/>Error rate, latency]
        DASH[Dashboard<br/>JWT auth success rate]
    end
    
    DEV_SF --> DEV_APP
    DEV_KEYS --> DEV_APP
    DEV_APP --> DEV_LAMBDA
    
    PROD_SF --> PROD_APP
    PROD_KEYS --> PROD_APP
    PROD_APP --> PROD_LAMBDA
    
    REPO --> BUILD
    BUILD --> TEST
    TEST --> DEPLOY
    DEPLOY --> DEV_LAMBDA
    DEPLOY --> PROD_LAMBDA
    
    DEV_LAMBDA --> CW
    PROD_LAMBDA --> CW
    CW --> METRICS
    METRICS --> ALARMS
    ALARMS --> DASH
    
    style DEV_SF fill:#e3f2fd
    style PROD_SF fill:#c8e6c9
    style PROD_KEYS fill:#ffecb3
    style DASH fill:#f3e5f5
```

## Summary

These diagrams illustrate:

1. **JWT Authentication Flow**: Complete sequence from Lambda invocation to Salesforce API calls
2. **Automation Process**: How the setup script creates everything automatically
3. **Salesforce Configuration**: What gets created in your Salesforce org
4. **Lambda Setup**: Required environment variables and dependencies
5. **Token Lifecycle**: How tokens are generated, cached, and reused
6. **Security Architecture**: Multi-layered security approach
7. **Performance Optimization**: Caching strategy and container reuse
8. **Error Handling**: Comprehensive error scenarios and recovery
9. **Deployment Architecture**: Development to production pipeline

The JWT Bearer Token Flow provides a secure, performant, and scalable solution for Salesforce integration in AWS Lambda environments.