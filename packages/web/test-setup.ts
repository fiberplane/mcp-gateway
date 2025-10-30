/**
 * Test setup for React component tests
 *
 * Registers happy-dom globally to provide DOM APIs in Bun's test environment.
 * Imports jest-dom matchers for enhanced assertions.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import "@testing-library/jest-dom";

GlobalRegistrator.register();
