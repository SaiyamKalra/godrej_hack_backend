import elasticsearch from "./elastic.search.js";

export async function createMessageIndex() {
  if (!process.env.ELASTIC_SEARCH_URL) return;
  try {
    const exists = await elasticsearch.indices.exists({
      index: "messages",
    });

    if (!exists) {
      await elasticsearch.indices.create({
        index: "messages",
        mappings: {
          properties: {
            messageId: { type: "keyword" },
            chatId: { type: "keyword" },
            userId: { type: "keyword" },
            title: { type: "text" },
            role: { type: "keyword" },
            content: { type: "text" },
            createdAt: { type: "date" },
          },
        },
      });
    }
  } catch (err) {
    console.warn("Failed to create/check Elasticsearch index:", err);
  }
}

export async function indexMessage(message: {
  messageId: string;
  chatId: string;
  userId: string;
  title: string;
  role: string;
  content: string;
  createdAt: Date;
}) {
  if (!process.env.ELASTIC_SEARCH_URL) return;
  try {
    await elasticsearch.index({
      index: "messages",
      id: message.messageId,
      document: message,
    });
  } catch (err) {
    console.warn("Failed to index message in Elasticsearch:", err);
  }
}

export async function searchMessages(
  userId: string,
  query: string
) {
  if (!process.env.ELASTIC_SEARCH_URL) return [];
  try {
    const result = await elasticsearch.search({
      index: "messages",
      size: 20,

      query: {
        bool: {
          must: {
            bool: {
              should: [
                {
                  // Fuzzy matching — handles typos like "waerhouse" → "warehouse"
                  multi_match: {
                    query,
                    fields: ["title^2", "content"],
                    fuzziness: "AUTO",
                    prefix_length: 1,
                  },
                },
                {
                  // Prefix matching — handles partial words like "war" → "warehouse"
                  multi_match: {
                    query,
                    fields: ["title^2", "content"],
                    type: "phrase_prefix",
                  },
                },
              ],
              minimum_should_match: 1,
            },
          },

          filter: {
            term: {
              userId,
            },
          },
        },
      },

      collapse: {
        field: "chatId",
      },

      // Sort by relevance first, then by recency
      sort: [
        "_score",
        {
          createdAt: {
            order: "desc",
          },
        },
      ],
    });

    return result.hits.hits.map((hit) => hit._source);
  } catch (err) {
    console.warn("Elasticsearch searchMessages error:", err);
    return [];
  }
}

export async function deleteMessagesByChat(
  chatId: string,
  userId: string
) {
  if (!process.env.ELASTIC_SEARCH_URL) return;
  try {
    await elasticsearch.deleteByQuery({
      index: "messages",
      query: {
        bool: {
          filter: [
            {
              term: {
                chatId,
              },
            },
            {
              term: {
                userId,
              },
            },
          ],
        },
      },
    });
  } catch (err) {
    console.warn("Elasticsearch deleteMessagesByChat error:", err);
  }
}