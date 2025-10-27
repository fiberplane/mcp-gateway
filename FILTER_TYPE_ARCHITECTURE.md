# Filter Type System Architecture Diagram

## Type System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    FilterFieldTypeMap                           │
│                  (Single Source of Truth)                       │
│                                                                 │
│  method: string      ┐                                          │
│  sessionId: string   │ String fields                            │
│  serverName: string  │                                          │
│  clientName: string  ┘                                          │
│                                                                 │
│  duration: number    ┐                                          │
│  httpStatus: number  ┘ Number fields                            │
│                                                                 │
│  timestamp: Date       Date field                               │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      OperatorTypeMap                            │
│                  (Maps types to operators)                      │
│                                                                 │
│  string: "eq" | "neq" | "contains" | "startsWith" | "endsWith" │
│  number: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"           │
│  Date: "before" | "after" | "between"                          │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              FilterOperator<F extends FilterField>              │
│                  (Automatic constraint mapping)                 │
│                                                                 │
│  FilterOperator<"method"> = "eq" | "neq" | "contains" | ...    │
│  FilterOperator<"duration"> = "eq" | "neq" | "gt" | ...        │
│  FilterOperator<"timestamp"> = "before" | "after" | "between"  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│       FilterValue<F extends FilterField, O extends ...>         │
│                  (Value type based on operator)                 │
│                                                                 │
│  FilterValue<"duration", "gt"> = number                         │
│  FilterValue<"timestamp", "before"> = Date                      │
│  FilterValue<"timestamp", "between"> = [Date, Date]            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│          TypedFilter<F extends FilterField, O extends ...>      │
│                    (Generic filter type)                        │
│                                                                 │
│  {                                                              │
│    readonly id: string;                                         │
│    readonly field: F;                                           │
│    readonly operator: O;                                        │
│    readonly value: FilterValue<F, O>;                          │
│    readonly enabled: boolean;                                   │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Filter (Union Type)                          │
│               (All possible filter combinations)                │
│                                                                 │
│  TypedFilter<"method", "eq"> |                                  │
│  TypedFilter<"method", "contains"> |                            │
│  TypedFilter<"duration", "gt"> |                                │
│  TypedFilter<"timestamp", "before"> |                           │
│  TypedFilter<"timestamp", "between"> |                          │
│  ... (all valid combinations)                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Architecture

```
┌──────────────┐
│   User Input │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                  createFilter() Helper                        │
│  - Type-safe filter creation                                 │
│  - Automatic type inference                                  │
│  - Generates unique ID                                       │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                   Zod Validation                             │
│  - Runtime type checking                                     │
│  - Schema validation                                         │
│  - Error generation                                          │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                  Filter State (Immer)                        │
│  {                                                           │
│    search: string,                                           │
│    filters: readonly Filter[],                               │
│    quickFilters: { ... }                                     │
│  }                                                           │
└──────────────────────┬───────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌────────────────┐           ┌────────────────┐
│ URL Params     │           │  API Request   │
│ (Serialized)   │           │  (Converted)   │
└────────────────┘           └───────┬────────┘
                                     │
                      ┌──────────────┴──────────────┐
                      ▼                             ▼
              ┌───────────────┐           ┌────────────────┐
              │ Server-Side   │           │ Client-Side    │
              │ Filters       │           │ Filters        │
              │ (LogQuery     │           │ (Browser       │
              │  Options)     │           │  Filtering)    │
              └───────┬───────┘           └───────┬────────┘
                      │                           │
                      ▼                           │
              ┌───────────────┐                   │
              │   API Call    │                   │
              │  (Fetch Logs) │                   │
              └───────┬───────┘                   │
                      │                           │
                      ▼                           │
              ┌───────────────┐                   │
              │  API Response │                   │
              │  (ApiLogEntry[])                  │
              └───────┬───────┘                   │
                      │                           │
                      └───────────┬───────────────┘
                                  ▼
                      ┌────────────────────┐
                      │  Filtered Results  │
                      │  (Display in UI)   │
                      └────────────────────┘
```

## Type Narrowing Example

```
Filter type (union of all possible filters)
│
├─ Check: filter.field === "duration"
│  │
│  └─ Narrows to: TypedFilter<"duration", NumberOperator>
│     │
│     ├─ filter.operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
│     └─ filter.value: number
│
├─ Check: filter.field === "method"
│  │
│  └─ Narrows to: TypedFilter<"method", StringOperator>
│     │
│     ├─ filter.operator: "eq" | "neq" | "contains" | "startsWith" | "endsWith"
│     └─ filter.value: string
│
└─ Check: filter.field === "timestamp"
   │
   └─ Narrows to: TypedFilter<"timestamp", DateOperator>
      │
      ├─ filter.operator: "before" | "after" | "between"
      └─ filter.value: Date | [Date, Date]
         │
         ├─ if operator === "between" → value: [Date, Date]
         └─ else → value: Date
```

## State Management Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         FilterState                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ search: string                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ filters: readonly Filter[]                                │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ { id, field: "duration", operator: "gt", value: 100 │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ { id, field: "method", operator: "contains", value  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ quickFilters: {                                           │  │
│  │   showErrors: boolean,                                    │  │
│  │   showSuccessOnly: boolean,                               │  │
│  │   showSlowRequests: boolean                               │  │
│  │ }                                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ FilterAction  │
                    │ (Discriminated│
                    │  Union)       │
                    └───────┬───────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ SET_SEARCH    │   │ ADD_FILTER    │   │ UPDATE_FILTER │
│ payload:      │   │ payload:      │   │ payload:      │
│   string      │   │   Filter      │   │   { id, ... } │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                    ┌───────────────┐
                    │filterReducer()│
                    │  (with Immer) │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  New State    │
                    │  (Immutable)  │
                    └───────────────┘
```

## API Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       FilterState                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              convertFiltersToStrategy()                         │
│  Analyzes each filter and determines:                           │
│  - Can API handle this filter? → Server-side                    │
│  - API limitation? → Client-side                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        ▼                                     ▼
┌──────────────────┐               ┌──────────────────┐
│  Server-Side     │               │  Client-Side     │
│  Filters         │               │  Filters         │
└────────┬─────────┘               └────────┬─────────┘
         │                                  │
         ▼                                  │
┌──────────────────────────────────────┐   │
│     LogQueryOptions                  │   │
│  {                                   │   │
│    method?: string,                  │   │
│    sessionId?: string,               │   │
│    serverName?: string,              │   │
│    after?: string,                   │   │
│    before?: string,                  │   │
│    ...                               │   │
│  }                                   │   │
└────────┬─────────────────────────────┘   │
         │                                  │
         ▼                                  │
┌──────────────────────────────────────┐   │
│      api.getLogs(options)            │   │
└────────┬─────────────────────────────┘   │
         │                                  │
         ▼                                  │
┌──────────────────────────────────────┐   │
│   ApiLogEntry[] (from server)        │   │
└────────┬─────────────────────────────┘   │
         │                                  │
         └──────────────┬───────────────────┘
                        ▼
         ┌──────────────────────────────────┐
         │  applyClientSideFilters()        │
         │  - Filter duration > threshold   │
         │  - Filter httpStatus ranges      │
         │  - String contains/startsWith    │
         └──────────────┬───────────────────┘
                        ▼
         ┌──────────────────────────────────┐
         │  Filtered ApiLogEntry[]          │
         │  (Final results for display)     │
         └──────────────────────────────────┘
```

## URL Serialization Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     FilterState                                 │
│  {                                                              │
│    search: "initialize",                                        │
│    filters: [                                                   │
│      { field: "duration", operator: "gt", value: 1000 },       │
│      { field: "method", operator: "contains", value: "tool" }  │
│    ],                                                           │
│    quickFilters: { showErrors: true }                          │
│  }                                                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              serializeFilterState()                             │
│  Maps filter objects to compact string format                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FilterURLParams                               │
│  {                                                              │
│    search: "initialize",                                        │
│    filters: "duration:gt:1000,method:contains:tool",           │
│    quick: "showErrors"                                          │
│  }                                                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                       URL                                       │
│  /logs?search=initialize&                                       │
│        filters=duration:gt:1000,method:contains:tool&           │
│        quick=showErrors                                         │
└─────────────────────────────────────────────────────────────────┘

                           │
                           │ (User shares/bookmarks URL)
                           │
                           ▼

┌─────────────────────────────────────────────────────────────────┐
│              deserializeFilterState()                           │
│  - Parses URL params                                            │
│  - Splits filter strings                                        │
│  - Validates with Zod schemas                                   │
│  - Gracefully handles invalid filters                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Restored FilterState                               │
│  {                                                              │
│    search: "initialize",                                        │
│    filters: [                                                   │
│      { field: "duration", operator: "gt", value: 1000 },       │
│      { field: "method", operator: "contains", value: "tool" }  │
│    ],                                                           │
│    quickFilters: { showErrors: true }                          │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
┌────────────────────────────────────────────────────────────────┐
│                      LogsPage                                  │
│  - Manages FilterState with useReducer                         │
│  - Fetches filtered logs                                       │
│  - Handles URL synchronization                                 │
└───────────────────────────┬────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ FilterBar    │   │  LogTable    │   │  QuickFilters│
│              │   │              │   │              │
│ - Search     │   │ - Display    │   │ - Show errors│
│ - Add filter │   │   logs       │   │ - Success    │
│              │   │ - Pagination │   │ - Slow reqs  │
└──────┬───────┘   └──────────────┘   └──────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────────────┐
│                   FilterList                                   │
│  - Renders active filters                                      │
│  - Toggle/remove filters                                       │
└───────────────────────────┬────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ StringFilter │   │ NumberFilter │   │  DateFilter  │
│  Chip        │   │  Chip        │   │  Chip        │
│              │   │              │   │              │
│ - Field      │   │ - Field      │   │ - Field      │
│ - Operator   │   │ - Operator   │   │ - Operator   │
│ - Value      │   │ - Value      │   │ - Value      │
│ - Edit/Del   │   │ - Edit/Del   │   │ - Edit/Del   │
└──────────────┘   └──────────────┘   └──────────────┘
```

## Error Handling Flow

```
                        User Input
                            │
                            ▼
                    ┌───────────────┐
                    │  Zod Schema   │
                    │  Validation   │
                    └───────┬───────┘
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
┌───────────────┐                       ┌───────────────┐
│   Success     │                       │    Failure    │
│               │                       │               │
│ { valid: true │                       │ { valid: false│
│   filter: ... }                       │   error: {    │
└───────────────┘                       │     type,     │
                                        │     message,  │
                                        │     field     │
                                        │   }           │
                                        └───────┬───────┘
                                                │
                        ┌───────────────────────┼───────────────────────┐
                        ▼                       ▼                       ▼
                ┌───────────────┐       ┌───────────────┐     ┌───────────────┐
                │invalid_field  │       │invalid_operator       │invalid_value  │
                │               │       │               │       │               │
                │"Unknown field │       │"'gt' not valid│       │"Value must be │
                │ 'foo'"        │       │ for strings"  │       │ positive"     │
                └───────────────┘       └───────────────┘       └───────────────┘
                        │                       │                       │
                        └───────────────────────┼───────────────────────┘
                                                ▼
                                        ┌───────────────┐
                                        │  Error Toast  │
                                        │  or Message   │
                                        └───────────────┘
```

## Type Inference Chain

```
createFilter("duration", "gt", 1000)
     │
     ├─ F inferred as "duration"
     │
     ├─ O constrained by FilterOperator<"duration">
     │  └─ O = "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
     │
     ├─ O inferred as "gt" (from literal)
     │
     ├─ FilterValue<"duration", "gt"> computed
     │  └─ "gt" extends "between"? No
     │  └─ Result: number
     │
     └─ Return type: TypedFilter<"duration", "gt">
        └─ {
             id: string,
             field: "duration",
             operator: "gt",
             value: number,
             enabled: boolean
           }
```

## Summary

This architecture provides:

1. **Type Safety** - Invalid combinations caught at compile time
2. **Type Inference** - Minimal annotations needed
3. **Runtime Validation** - Zod ensures external data is valid
4. **Immutability** - Readonly types + Immer for updates
5. **Hybrid Filtering** - Server + client-side filtering
6. **URL Persistence** - Bookmark/share filters
7. **Error Handling** - Type-safe error states
8. **Extensibility** - Easy to add new fields/operators

The discriminated union pattern enables exhaustive type checking, while mapped types provide automatic operator constraints based on field types.
