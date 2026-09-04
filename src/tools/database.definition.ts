export const databaseToolDefinition = {
  type: "function",

  function: {
    name: "database_query",

    description:
      "Retrieve information about the currently authenticated user's own account. " +
      "Use this tool when the user asks about their name, email, or account information. " +
      "The application automatically determines the authenticated user. " +
      "Never ask for or provide a userId.",

    parameters: {
      type: "object",

      required: [
        "table",
        "operation",
      ],

      properties: {
        table: {
          type: "string",

          enum: [
            "user",
          ],

          description:
            "The database table. Always use exactly 'user' for account information.",
        },

        operation: {
          type: "string",

          enum: [
            "findUnique",
            "findMany",
            "count",
          ],

          description:
            "The database operation to perform. " +
            "Use findUnique to retrieve the authenticated user's account information.",
        },

        filters: {
          type: "object",

          description:
            "Optional filters. Never include userId because the application supplies the authenticated user ID.",
        },
      },
    },
  },
};