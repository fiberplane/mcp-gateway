import type { FC } from "hono/jsx";

interface AddServerFormProps {
  showTitle?: boolean;
}

export const AddServerForm: FC<AddServerFormProps> = ({ showTitle = true }) => {
  return (
    <div>
      {showTitle && <h2>Add Server</h2>}
      <form action="/ui/add-server" method="post" class="grid">
        <label>
          Server Name
          <input type="text" name="name" placeholder="my-server" required />
        </label>

        <label>
          Server URL
          <input
            type="url"
            name="url"
            placeholder="http://localhost:3001/mcp"
            required
          />
        </label>

        <div>
          <button type="submit">Add Server</button>
          <button type="reset">Reset</button>
        </div>
      </form>
    </div>
  );
};
