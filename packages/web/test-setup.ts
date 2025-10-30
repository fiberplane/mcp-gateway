/**
 * Test setup for React component tests
 *
 * Registers happy-dom globally to provide DOM APIs in Bun's test environment.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
