// Type augmentation for OpenTUI to support key and ref on custom components
// This fixes the missing IntrinsicAttributes in OpenTUI's JSX namespace

import type React from "react";

// Augment OpenTUI's JSX namespace via jsx-runtime (what TypeScript uses with jsxImportSource)
declare module "@opentui/react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicAttributes {
      key?: React.Key;
    }
  }
}

// Also augment jsx-dev-runtime for development mode
declare module "@opentui/react/jsx-dev-runtime" {
  namespace JSX {
    interface IntrinsicAttributes {
      key?: React.Key;
    }
  }
}
