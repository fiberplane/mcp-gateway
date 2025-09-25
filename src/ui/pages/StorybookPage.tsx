import type { FC } from "hono/jsx";
import { ToolCall, ToolCallStories } from "../components/events/ToolCall.js";
import { Layout } from "../Layout.js";

export const StorybookPage: FC = () => {
  return (
    <Layout>
      <table class="header">
        <tr>
          <td colspan="2" rowspan="2" class="width-auto">
            <h1 class="title">Component Storybook</h1>
            <span class="subtitle">MCP Gateway UI Components</span>
          </td>
          <th>Version</th>
          <td class="width-min">v0.1.0</td>
        </tr>
        <tr>
          <th>Updated</th>
          <td class="width-min">
            <time style="white-space: pre;">
              {new Date().toISOString().split("T")[0]}
            </time>
          </td>
        </tr>
        <tr>
          <th class="width-min">Purpose</th>
          <td class="width-auto">Component examples and design testing</td>
          <th class="width-min">Status</th>
          <td>Development</td>
        </tr>
      </table>

      <nav id="TOC" role="doc-toc">
        <h2 id="toc-title">Components</h2>
        <ul class="incremental">
          <li>
            <a href="#tool-call" id="toc-tool-call">
              Tool Call
            </a>
          </li>
        </ul>
      </nav>

      <h2 id="tool-call">Tool Call</h2>
      <p>
        Displays MCP tool call requests and responses with proper handling of
        success/error states.
      </p>

      <div id="tool-call-examples">
        <h3>Successful Tool Call</h3>
        <ToolCall data={ToolCallStories.successful} expanded={true} />

        <h3>Error Tool Call</h3>
        <ToolCall data={ToolCallStories.error} expanded={true} />

        <h3>Pending Tool Call</h3>
        <ToolCall data={ToolCallStories.pending} expanded={true} />

        <h3>Tool Call Without Session</h3>
        <ToolCall data={ToolCallStories.noSession} expanded={false} />
      </div>

      <nav>
        <a href="/ui">← Back to Home</a>
      </nav>
    </Layout>
  );
};
